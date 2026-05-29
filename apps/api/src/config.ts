import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),

  // JWT — dev-mode HS256. In staging+, swap to Clerk JWKS verification.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be ≥ 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  // ── File storage ──
  // STORAGE_DRIVER picks the backend for book files + covers.
  //   'mongodb' (default)  → MongoDB GridFS via MONGODB_URL
  //   's3'                 → S3-compatible (R2, MinIO, AWS S3)
  STORAGE_DRIVER: z.enum(['mongodb', 's3']).default('mongodb'),
  MONGODB_URL: z.string().optional(),
  MONGODB_BUCKET_FILES: z.string().default('books_files'),
  MONGODB_BUCKET_COVERS: z.string().default('books_covers'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('auto'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET_FILES: z.string().default('books-files'),
  S3_BUCKET_COVERS: z.string().default('books-covers'),
  S3_BUCKET_EXPORTS: z.string().default('exports'),

  SENTRY_DSN: z.string().optional(),
});

export type Config = z.infer<typeof envSchema>;

let cached: Config | null = null;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (cached) return cached;
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const lines = Object.entries(flat).map(
      ([k, v]) => `  - ${k}: ${v?.join(', ') ?? 'invalid'}`,
    );
    throw new Error(`Invalid environment variables:\n${lines.join('\n')}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProd = () => loadConfig().NODE_ENV === 'production';
export const isTest = () => loadConfig().NODE_ENV === 'test';
