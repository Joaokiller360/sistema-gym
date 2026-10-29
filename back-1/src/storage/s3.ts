import { S3Client } from '@aws-sdk/client-s3';

/** MinIO / S3 credentials shared by the file storage and the backups */
export function s3Configured() {
  return Boolean(
    process.env.S3_ENDPOINT &&
    process.env.S3_ACCESS_KEY &&
    process.env.S3_SECRET_KEY,
  );
}

export function createS3Client(endpoint = process.env.S3_ENDPOINT) {
  return new S3Client({
    endpoint,
    region: process.env.S3_REGION ?? 'us-east-1',
    // MinIO serves buckets as paths, not subdomains
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY!,
      secretAccessKey: process.env.S3_SECRET_KEY!,
    },
  });
}
