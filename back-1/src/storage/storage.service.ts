import {
  BadRequestException,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import type { NextFunction, Request, Response } from 'express';
import { mkdir, readdir, readFile, unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import type { Readable } from 'stream';
import { createS3Client, s3Configured } from './s3';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fileType = require('file-type') as {
  fromBuffer: (buf: Buffer) => Promise<{ mime: string } | undefined>;
};

export const UPLOADS_DIR = join(process.cwd(), 'uploads');

/** Folders under /uploads; nothing else is ever stored or served */
export type UploadFolder = 'logos' | 'wa-media' | 'catalog';
const FOLDERS: UploadFolder[] = ['logos', 'wa-media', 'catalog'];
const KEY_RE = /^(logos|wa-media|catalog)\/[\w-][\w.-]*$/;

const IMAGE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

// Content type for objects copied from disk, whose type was never recorded
const EXT_TYPE: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.mp4': 'video/mp4',
  '.3gp': 'video/3gpp',
  '.pdf': 'application/pdf',
};

// Shown in the page (img/video/audio); any other file is only ever handed over as a download
const INLINE_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.ogg',
  '.mp3',
  '.m4a',
  '.aac',
  '.mp4',
  '.3gp',
]);

/** Headers for every /uploads response: nothing served from here can run in the browser */
export function setUploadHeaders(res: Response, key: string) {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  // Even if opened directly, a sandboxed response gets no scripts, forms or plugins
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  );
  if (!INLINE_EXT.has(extname(key).toLowerCase())) {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment');
  }
}

/**
 * Uploaded files (logos, WhatsApp media). With S3_* set they go to MinIO;
 * otherwise to the local uploads folder. Either way the public URL stays /uploads/<key>.
 */
@Injectable()
export class StorageService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | null = null;
  private bucketReady: Promise<void> | null = null;

  get enabled() {
    return s3Configured();
  }

  private get bucket() {
    return process.env.S3_UPLOADS_BUCKET ?? 'gymos-uploads';
  }

  private get s3() {
    this.client ??= createS3Client();
    return this.client;
  }

  private ensureBucket() {
    this.bucketReady ??= this.s3
      .send(new HeadBucketCommand({ Bucket: this.bucket }))
      .then(() => undefined)
      .catch(async () => {
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
      })
      .catch((e: unknown) => {
        // Let the next call try again instead of caching the failure
        this.bucketReady = null;
        throw e;
      });
    return this.bucketReady;
  }

  /** Stores the bytes and returns the public path, e.g. /uploads/logos/123.png */
  async put(key: string, body: Buffer, contentType: string) {
    if (!KEY_RE.test(key)) throw new Error(`Invalid storage key: ${key}`);
    if (this.enabled) {
      await this.ensureBucket();
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    } else {
      const path = join(UPLOADS_DIR, key);
      await mkdir(join(path, '..'), { recursive: true });
      await writeFile(path, body);
    }
    return `/uploads/${key}`;
  }

  /** Checks the real file type (not the name the browser sent) before storing */
  async putImage(folder: UploadFolder, body: Buffer, prefix = '') {
    const detected = await fileType.fromBuffer(body.subarray(0, 4100));
    const ext = detected && IMAGE_EXT[detected.mime];
    if (!ext) throw new BadRequestException('Archivo de imagen inválido');
    return this.put(
      `${folder}/${prefix}${Date.now()}.${ext}`,
      body,
      detected.mime,
    );
  }

  /** Bytes of a stored file by its public path (disk first, then MinIO); null when missing */
  async read(url: string | null | undefined) {
    const key = url?.startsWith('/uploads/') ? url.slice(9) : null;
    if (!key || !KEY_RE.test(key)) return null;
    const type = EXT_TYPE[extname(key)] ?? 'application/octet-stream';
    const local = await readFile(join(UPLOADS_DIR, key)).catch(() => null);
    if (local) return { body: local, type };
    if (!this.enabled) return null;
    try {
      const obj = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const bytes = await obj.Body?.transformToByteArray();
      return bytes
        ? { body: Buffer.from(bytes), type: obj.ContentType ?? type }
        : null;
    } catch {
      return null;
    }
  }

  /** Removes a file by its public path; anything outside /uploads is ignored */
  async remove(url: string | null | undefined) {
    const key = url?.startsWith('/uploads/') ? url.slice(9) : null;
    if (!key || !KEY_RE.test(key)) return;
    // Older files may still live on disk, newer ones in MinIO
    await unlink(join(UPLOADS_DIR, key)).catch(() => undefined);
    if (this.enabled) {
      await this.s3
        .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
        .catch((e: unknown) =>
          this.logger.warn(`[Storage] Could not delete ${key}: ${String(e)}`),
        );
    }
  }

  /** Mounted after the static /uploads handler: serves from MinIO what isn't on disk */
  async serve(req: Request, res: Response, next: NextFunction) {
    if (!this.enabled || (req.method !== 'GET' && req.method !== 'HEAD')) {
      return next();
    }
    const key = decodeURIComponent(req.path.replace(/^\//, ''));
    if (!KEY_RE.test(key)) return next();

    try {
      const obj = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      res.setHeader(
        'Content-Type',
        obj.ContentType ?? EXT_TYPE[extname(key)] ?? 'application/octet-stream',
      );
      if (obj.ContentLength) res.setHeader('Content-Length', obj.ContentLength);
      if (obj.ETag) res.setHeader('ETag', obj.ETag);
      setUploadHeaders(res, key);
      const body = obj.Body as Readable;
      if (req.method === 'HEAD') {
        body.destroy();
        return res.end();
      }
      body.on('error', () => res.destroy());
      body.pipe(res);
    } catch (e) {
      const status = (e as { $metadata?: { httpStatusCode?: number } })
        .$metadata?.httpStatusCode;
      if (status === 404) return next();
      this.logger.error(`[Storage] Could not read ${key}: ${String(e)}`);
      res.status(502).end();
    }
  }

  onApplicationBootstrap() {
    if (!this.enabled) return;
    void this.copyLocalFiles().catch((e: unknown) =>
      this.logger.error(`[Storage] Copying local files failed: ${String(e)}`),
    );
  }

  /** One-off move to MinIO: uploads any file that is still only on disk */
  private async copyLocalFiles() {
    await this.ensureBucket();
    const existing = new Set<string>();
    let token: string | undefined;
    do {
      const page = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          ContinuationToken: token,
        }),
      );
      for (const o of page.Contents ?? []) existing.add(o.Key!);
      token = page.NextContinuationToken;
    } while (token);

    let copied = 0;
    for (const folder of FOLDERS) {
      const names = await readdir(join(UPLOADS_DIR, folder)).catch(
        () => [] as string[],
      );
      for (const name of names) {
        const key = `${folder}/${name}`;
        if (existing.has(key) || !KEY_RE.test(key)) continue;
        const type = EXT_TYPE[extname(name).toLowerCase()];
        if (!type) continue;
        await this.s3.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: await readFile(join(UPLOADS_DIR, key)),
            ContentType: type,
          }),
        );
        copied++;
      }
    }
    if (copied)
      this.logger.log(`[Storage] Copied ${copied} local files to MinIO`);
  }
}
