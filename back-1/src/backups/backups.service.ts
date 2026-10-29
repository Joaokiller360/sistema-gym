import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  type S3Client,
  type _Object,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { createS3Client, s3Configured } from '../storage/s3';

export type BackupKind = 'db' | 'uploads';

export interface BackupFile {
  key: string;
  kind: BackupKind;
  size: number;
  createdAt: string;
}

export interface BackupRun {
  startedAt: string;
  finishedAt: string | null;
  trigger: 'cron' | 'manual';
  ok: boolean | null;
  files: string[];
  error: string | null;
}

const PREFIX: Record<BackupKind, string> = {
  db: 'db/',
  uploads: 'uploads/',
};

// Prisma-only URL params that pg_dump rejects ("invalid URI query parameter")
const PRISMA_PARAMS = [
  'schema',
  'connection_limit',
  'pool_timeout',
  'pgbouncer',
  'statement_cache_size',
  'socket_timeout',
];

const UPLOADS_DIR = join(process.cwd(), 'uploads');

@Injectable()
export class BackupsService {
  private readonly logger = new Logger(BackupsService.name);
  private client: S3Client | null = null;
  private bucketReady = false;
  private lastRun: BackupRun | null = null;

  get enabled() {
    return s3Configured() && Boolean(process.env.S3_BUCKET);
  }

  private get bucket() {
    return process.env.S3_BUCKET!;
  }

  private get retentionDays() {
    const days = Number(process.env.BACKUP_RETENTION_DAYS ?? 14);
    return Number.isFinite(days) && days > 0 ? days : 14;
  }

  private assertEnabled() {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'Backups sin configurar: faltan S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY o S3_SECRET_KEY',
      );
    }
  }

  private get storage() {
    this.assertEnabled();
    this.client ??= createS3Client();
    return this.client;
  }

  config() {
    return {
      enabled: this.enabled,
      bucket: this.enabled ? this.bucket : null,
      retentionDays: this.retentionDays,
      schedule: process.env.BACKUP_CRON ?? '0 4 * * *',
      running: this.lastRun?.finishedAt === null,
      lastRun: this.lastRun,
    };
  }

  // Env read at load time: Docker passes it as a real variable
  @Cron(process.env.BACKUP_CRON ?? '0 4 * * *', {
    timeZone: process.env.BACKUP_TIMEZONE ?? 'America/Guayaquil',
  })
  async scheduled() {
    if (!this.enabled) return;
    await this.run('cron').catch(() => undefined);
  }

  /** Starts a backup without waiting for it; the panel polls config() for the result */
  startManual() {
    if (this.lastRun?.finishedAt === null) {
      throw new ConflictException('Ya hay una copia en curso');
    }
    this.assertEnabled();
    void this.run('manual').catch(() => undefined);
    return { started: true };
  }

  private async run(trigger: BackupRun['trigger']) {
    if (this.lastRun?.finishedAt === null) return;
    const run: BackupRun = {
      startedAt: new Date().toISOString(),
      finishedAt: null,
      trigger,
      ok: null,
      files: [],
      error: null,
    };
    this.lastRun = run;
    const stamp = run.startedAt.replace(/[:.]/g, '-');

    try {
      await this.ensureBucket();
      run.files.push(await this.backupDatabase(stamp));
      if (existsSync(UPLOADS_DIR)) {
        run.files.push(await this.backupUploads(stamp));
      }
      await this.prune();
      run.ok = true;
      this.logger.log(`[Backup] ${trigger} OK: ${run.files.join(', ')}`);
    } catch (e) {
      run.ok = false;
      run.error = e instanceof Error ? e.message : String(e);
      this.logger.error(`[Backup] ${trigger} failed: ${run.error}`);
      throw e;
    } finally {
      run.finishedAt = new Date().toISOString();
    }
  }

  private async ensureBucket() {
    if (this.bucketReady) return;
    const s3 = this.storage;
    try {
      await s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
    this.bucketReady = true;
  }

  /** pg_dump custom format: already compressed, restorable with pg_restore */
  private backupDatabase(stamp: string) {
    const url = new URL(process.env.DATABASE_URL!);
    for (const p of PRISMA_PARAMS) url.searchParams.delete(p);
    // Via env, so the password doesn't show up in the process list
    const password = decodeURIComponent(url.password);
    url.password = '';
    return this.streamCommand(
      'pg_dump',
      ['--format=custom', '--no-owner', '--no-privileges', url.toString()],
      `${PREFIX.db}${stamp}.dump`,
      'application/octet-stream',
      { PGPASSWORD: password },
    );
  }

  private backupUploads(stamp: string) {
    return this.streamCommand(
      'tar',
      ['-czf', '-', '-C', UPLOADS_DIR, '.'],
      `${PREFIX.uploads}${stamp}.tar.gz`,
      'application/gzip',
    );
  }

  /** Pipes the command's stdout straight to S3, so nothing touches the disk */
  private async streamCommand(
    cmd: string,
    args: string[],
    key: string,
    contentType: string,
    env: Record<string, string> = {},
  ) {
    const child = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });
    let stderr = '';
    child.stderr.on('data', (d: Buffer) => {
      stderr = (stderr + d.toString()).slice(-2000);
    });
    const exited = new Promise<void>((resolve, reject) => {
      child.on('error', (e) => reject(new Error(`${cmd}: ${e.message}`)));
      child.on('close', (code) =>
        code === 0
          ? resolve()
          : reject(
              new Error(`${cmd} salió con código ${code}: ${stderr.trim()}`),
            ),
      );
    });

    const upload = new Upload({
      client: this.storage,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: child.stdout,
        ContentType: contentType,
      },
    });

    try {
      await Promise.all([exited, upload.done()]);
    } catch (e) {
      child.kill();
      await upload.abort().catch(() => undefined);
      // A half-written object would look like a valid backup
      await this.remove([key]).catch(() => undefined);
      throw e;
    }
    return key;
  }

  async list(): Promise<BackupFile[]> {
    const s3 = this.storage;
    const objects: _Object[] = [];
    let token: string | undefined;
    do {
      const page = await s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          ContinuationToken: token,
        }),
      );
      objects.push(...(page.Contents ?? []));
      token = page.NextContinuationToken;
    } while (token);

    return objects
      .map<BackupFile>((o) => ({
        key: o.Key!,
        kind: o.Key!.startsWith(PREFIX.uploads) ? 'uploads' : 'db',
        size: o.Size ?? 0,
        createdAt: (o.LastModified ?? new Date(0)).toISOString(),
      }))
      .filter(
        (f) => f.key.startsWith(PREFIX.db) || f.key.startsWith(PREFIX.uploads),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Short-lived link; S3_PUBLIC_ENDPOINT when MinIO is only reachable internally by the API */
  async downloadUrl(key: string) {
    this.assertKey(key);
    const s3 = this.storage;
    const signer = process.env.S3_PUBLIC_ENDPOINT
      ? createS3Client(process.env.S3_PUBLIC_ENDPOINT)
      : s3;
    const url = await getSignedUrl(
      signer,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: 300 },
    );
    return { url };
  }

  async delete(key: string) {
    this.assertKey(key);
    await this.remove([key]);
    return { deleted: key };
  }

  private async prune() {
    const cutoff = Date.now() - this.retentionDays * 86_400_000;
    const files = await this.list();
    // Never leave the bucket without a database copy
    const newestDb = files.find((f) => f.kind === 'db')?.key;
    const old = files
      .filter((f) => f.key !== newestDb && Date.parse(f.createdAt) < cutoff)
      .map((f) => f.key);
    if (old.length) await this.remove(old);
  }

  private async remove(keys: string[]) {
    for (let i = 0; i < keys.length; i += 1000) {
      await this.storage.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })) },
        }),
      );
    }
  }

  private assertKey(key: string) {
    const valid = /^(db|uploads)\/[\w.-]+\.(dump|tar\.gz)$/.test(key);
    if (!valid) throw new BadRequestException('Copia inválida');
  }
}
