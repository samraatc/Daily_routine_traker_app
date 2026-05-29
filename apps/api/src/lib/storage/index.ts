/**
 * File-storage driver interface. Two implementations:
 *   - mongodb (MongoDB GridFS) — default
 *   - s3      (S3-compatible)  — stub; flesh out when needed
 *
 * Selected at boot via STORAGE_DRIVER env var (see config.ts).
 */
import { Readable } from 'node:stream';

import { loadConfig } from '../../config.js';

export type UploadIntent = {
  /** Logical object key (e.g. "users/<uid>/books/<bid>.pdf"). */
  fileKey: string;
  /** Public URL the client should PUT the bytes to. */
  uploadUrl: string;
  /** When the URL expires. */
  expiresAt: Date;
};

export interface StorageDriver {
  readonly driverName: 'mongodb' | 's3';

  /** Mint an upload intent for the client. */
  createUploadIntent(args: {
    fileKey: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<UploadIntent>;

  /** Server-side: persist a stream of bytes under the given key. */
  putObject(args: {
    fileKey: string;
    contentType: string;
    stream: Readable;
  }): Promise<{ sizeBytes: number }>;

  /** Open a read stream for the object. */
  getObject(fileKey: string): Promise<{ stream: Readable; contentType: string; sizeBytes: number }>;

  /** Hard-delete an object. */
  deleteObject(fileKey: string): Promise<void>;

  /** Issue a short-lived read URL (for streaming the book to a client). */
  createReadUrl(fileKey: string, ttlSeconds?: number): Promise<{ url: string; expiresAt: Date }>;

  /** Shut down any pooled connections. */
  close(): Promise<void>;
}

let driverInstance: StorageDriver | null = null;

export async function getStorage(): Promise<StorageDriver> {
  if (driverInstance) return driverInstance;
  const cfg = loadConfig();
  if (cfg.STORAGE_DRIVER === 'mongodb') {
    const { createMongoStorage } = await import('./mongodb.js');
    driverInstance = await createMongoStorage();
  } else {
    const { createS3Storage } = await import('./s3.js');
    driverInstance = await createS3Storage();
  }
  return driverInstance;
}

export async function closeStorage(): Promise<void> {
  if (driverInstance) {
    await driverInstance.close();
    driverInstance = null;
  }
}
