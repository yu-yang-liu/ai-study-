import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { assertUserOwnsFile } from '../security';

export interface S3Config {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
  forcePathStyle: boolean;
  publicBaseUrl?: string;
}

const DEFAULT_PUT_EXPIRES = 300;
const DEFAULT_GET_EXPIRES = 3600;

export function getS3Config(): S3Config {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION ?? 'auto';
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, '');

  if (!endpoint || !accessKey || !secretKey || !bucket) {
    throw new Error('Missing S3 configuration (S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET)');
  }

  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== 'false';

  return {
    endpoint: endpoint.replace(/\/$/, ''),
    accessKey,
    secretKey,
    bucket,
    region,
    forcePathStyle,
    publicBaseUrl: publicBaseUrl || undefined,
  };
}

export function createS3Client(config: S3Config = getS3Config()): S3Client {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    forcePathStyle: config.forcePathStyle,
  });
}

/** Public CDN/base URL if configured, otherwise presigned GET. */
export async function getReadUrl(
  userId: string,
  key: string,
  expiresIn = DEFAULT_GET_EXPIRES,
): Promise<string> {
  assertUserOwnsFile(userId, key);
  const config = getS3Config();

  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl}/${key}`;
  }

  const client = createS3Client(config);
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    { expiresIn },
  );
}

export type PresignedUpload = {
  uploadUrl: string;
  key: string;
  url: string;
};

/** Issue a presigned PUT URL for direct client upload. */
export async function createPresignedUploadUrl(
  userId: string,
  key: string,
  contentType: string,
  expiresIn = DEFAULT_PUT_EXPIRES,
): Promise<PresignedUpload> {
  assertUserOwnsFile(userId, key);
  const config = getS3Config();
  const client = createS3Client(config);

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn },
  );

  const url = await getReadUrl(userId, key);

  return { uploadUrl, key, url };
}

/** Upload via SigV4 PutObject (server-side fallback). */
export async function uploadFile(
  userId: string,
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<string> {
  assertUserOwnsFile(userId, key);
  const config = getS3Config();
  const client = createS3Client(config);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  return getReadUrl(userId, key);
}

/** @deprecated Use getReadUrl — kept for compatibility. */
export async function getDownloadUrl(userId: string, key: string): Promise<string> {
  return getReadUrl(userId, key);
}

/** Delete object via SigV4. */
export async function deleteFile(userId: string, key: string): Promise<void> {
  assertUserOwnsFile(userId, key);
  const config = getS3Config();
  const client = createS3Client(config);

  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
  );
}

/** Legacy-compatible class wrapper. */
export class S3Storage {
  uploadFile = uploadFile;
  getDownloadUrl = getDownloadUrl;
  getReadUrl = getReadUrl;
  createPresignedUploadUrl = createPresignedUploadUrl;
  deleteFile = deleteFile;
}
