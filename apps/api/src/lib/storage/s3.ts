/**
 * S3-compatible storage driver. Stub returning placeholder URLs for the dev
 * MinIO setup. Production replaces with `@aws-sdk/client-s3` + signed URLs.
 *
 * When STORAGE_DRIVER=s3, set:
 *   S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET_FILES
 */
import { Readable } from 'node:stream';

import { loadConfig } from '../../config.js';
import type { StorageDriver } from './index.js';

export async function createS3Storage(): Promise<StorageDriver> {
  const cfg = loadConfig();
  const endpoint = cfg.S3_ENDPOINT ?? 'http://localhost:9000';
  const bucket = cfg.S3_BUCKET_FILES;

  return {
    driverName: 's3',

    async createUploadIntent({ fileKey }) {
      const expiresAt = new Date(Date.now() + 15 * 60_000);
      return {
        fileKey,
        // Real impl: AWS SDK getSignedUrl(s3, new PutObjectCommand({Bucket, Key}), {expiresIn: 900})
        uploadUrl: `${endpoint}/${bucket}/${fileKey}`,
        expiresAt,
      };
    },

    async putObject() {
      throw new Error('S3 putObject not implemented in stub; switch to STORAGE_DRIVER=mongodb');
    },

    async getObject() {
      throw new Error('S3 getObject not implemented in stub');
    },

    async deleteObject() {
      // no-op stub
    },

    async createReadUrl(fileKey, ttlSeconds = 15 * 60) {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      return {
        url: `${endpoint}/${bucket}/${fileKey}`,
        expiresAt,
      };
    },

    async close() {
      /* no pooled connections in this stub */
    },
  };
}

// Suppress unused-import for the Readable type — kept for parity with mongodb.ts.
export type _R = Readable;
