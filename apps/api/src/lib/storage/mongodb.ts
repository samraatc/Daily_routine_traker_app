/**
 * MongoDB GridFS implementation of the storage driver.
 *
 * GridFS splits files into 255KB chunks across two collections per bucket:
 *   <bucket>.files   — metadata
 *   <bucket>.chunks  — binary chunks
 *
 * Books up to 50MB fit comfortably; cover thumbnails are small.
 *
 * Upload flow with MongoDB (different from S3 pre-signed URLs):
 *   1. Client → POST /books/upload-url → returns uploadUrl pointing back at our API
 *   2. Client → PUT <uploadUrl> with the file bytes
 *   3. Server streams the body straight into GridFS via putObject()
 */
import { Readable } from 'node:stream';

import { GridFSBucket, MongoClient, ObjectId } from 'mongodb';

import { loadConfig } from '../../config.js';
import type { StorageDriver, UploadIntent } from './index.js';

export async function createMongoStorage(): Promise<StorageDriver> {
  const cfg = loadConfig();
  if (!cfg.MONGODB_URL) {
    throw new Error('MONGODB_URL is required when STORAGE_DRIVER=mongodb');
  }

  const client = new MongoClient(cfg.MONGODB_URL, { maxPoolSize: 10 });
  await client.connect();
  const db = client.db();
  const bucket = new GridFSBucket(db, { bucketName: cfg.MONGODB_BUCKET_FILES });

  // Used to back the "presigned-style" upload URL: a per-intent token grants
  // write permission to a single fileKey.
  const intents = db.collection<{
    _id: ObjectId;
    token: string;
    fileKey: string;
    contentType: string;
    sizeBytes: number;
    expiresAt: Date;
    consumed: boolean;
  }>('upload_intents');
  await intents.createIndex({ token: 1 }, { unique: true });
  await intents.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  function baseUrl(): string {
    return process.env.PUBLIC_API_URL ?? `http://localhost:${cfg.PORT}/api/v1`;
  }

  return {
    driverName: 'mongodb',

    async createUploadIntent({ fileKey, contentType, sizeBytes }) {
      const token = `up_${ObjectId.createFromTime(Math.floor(Date.now() / 1000)).toString()}_${Math.random().toString(36).slice(2, 12)}`;
      const expiresAt = new Date(Date.now() + 15 * 60_000);
      await intents.insertOne({
        _id: new ObjectId(),
        token,
        fileKey,
        contentType,
        sizeBytes,
        expiresAt,
        consumed: false,
      });
      const url = `${baseUrl()}/books/upload-stream/${encodeURIComponent(token)}`;
      return { fileKey, uploadUrl: url, expiresAt } satisfies UploadIntent;
    },

    async putObject({ fileKey, contentType, stream }) {
      // Drop any prior version with the same fileKey to keep things idempotent.
      const existing = bucket.find({ filename: fileKey });
      for await (const doc of existing) {
        await bucket.delete(doc._id);
      }

      const uploadStream = bucket.openUploadStream(fileKey, {
        contentType,
        metadata: { fileKey },
      });
      let sizeBytes = 0;
      stream.on('data', (chunk) => {
        sizeBytes += chunk.length;
      });

      await new Promise<void>((resolve, reject) => {
        stream.on('error', reject);
        uploadStream.on('error', reject);
        uploadStream.on('finish', () => resolve());
        stream.pipe(uploadStream);
      });

      return { sizeBytes };
    },

    async getObject(fileKey) {
      const file = await db
        .collection<{ length: number; contentType?: string }>(
          `${cfg.MONGODB_BUCKET_FILES}.files`,
        )
        .findOne({ filename: fileKey });
      if (!file) throw new Error(`Object not found: ${fileKey}`);
      const stream = bucket.openDownloadStreamByName(fileKey);
      return {
        stream: stream as unknown as Readable,
        contentType: file.contentType ?? 'application/octet-stream',
        sizeBytes: file.length,
      };
    },

    async deleteObject(fileKey) {
      const files = bucket.find({ filename: fileKey });
      for await (const doc of files) {
        await bucket.delete(doc._id);
      }
    },

    async createReadUrl(fileKey, ttlSeconds = 15 * 60) {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      // Read URLs are simple authenticated paths in MongoDB mode — the client's
      // Bearer JWT is required. The API enforces ownership in the route handler.
      const url = `${baseUrl()}/books/stream?key=${encodeURIComponent(fileKey)}`;
      return { url, expiresAt };
    },

    async close() {
      await client.close();
    },
  };
}

/** Internal: consume an upload-intent token. Exported for the route handler. */
export async function consumeUploadIntent(
  client: MongoClient,
  bucketName: string,
  token: string,
): Promise<{ fileKey: string; contentType: string; sizeBytes: number } | null> {
  const db = client.db();
  const intents = db.collection<{
    token: string;
    fileKey: string;
    contentType: string;
    sizeBytes: number;
    expiresAt: Date;
    consumed: boolean;
  }>('upload_intents');
  const found = await intents.findOneAndUpdate(
    { token, consumed: false, expiresAt: { $gt: new Date() } },
    { $set: { consumed: true } },
  );
  if (!found) return null;
  return {
    fileKey: found.fileKey,
    contentType: found.contentType,
    sizeBytes: found.sizeBytes,
  };
}
