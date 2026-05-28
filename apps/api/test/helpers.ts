import { PrismaClient } from '@prisma/client';
import { type FastifyInstance } from 'fastify';

import { buildServer } from '../src/server.js';

let cachedApp: FastifyInstance | null = null;
let cachedPrisma: PrismaClient | null = null;

export async function getApp(): Promise<FastifyInstance> {
  if (cachedApp) return cachedApp;
  // Ensure required envs for the config schema.
  process.env.NODE_ENV ??= 'test';
  process.env.JWT_SECRET ??=
    'test-test-test-test-test-test-test-test-test-test-test';
  process.env.DATABASE_URL ??= 'postgresql://app:app@localhost:5432/app_test?schema=public';
  process.env.LOG_LEVEL ??= 'error';
  cachedApp = await buildServer();
  await cachedApp.ready();
  return cachedApp;
}

export async function getPrisma(): Promise<PrismaClient> {
  if (cachedPrisma) return cachedPrisma;
  cachedPrisma = (await getApp()).prisma;
  return cachedPrisma;
}

export async function resetDatabase(): Promise<void> {
  const prisma = await getPrisma();
  // Truncate everything in dependency order. Skipped in CI where containers
  // start fresh per run.
  await prisma.$transaction([
    prisma.auditLog.deleteMany({}),
    prisma.notificationLog.deleteMany({}),
    prisma.deviceToken.deleteMany({}),
    prisma.bookmark.deleteMany({}),
    prisma.readingProgress.deleteMany({}),
    prisma.bookDownload.deleteMany({}),
    prisma.report.deleteMany({}),
    prisma.completion.deleteMany({}),
    prisma.task.deleteMany({}),
    prisma.book.deleteMany({}),
    prisma.streak.deleteMany({}),
    prisma.featureFlag.deleteMany({}),
    prisma.user.deleteMany({}),
    prisma.bookCategory.deleteMany({}),
  ]);
}

export async function registerAndLogin(
  app: FastifyInstance,
  email: string,
  password = 'password123',
): Promise<{ accessToken: string; userId: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password, name: email.split('@')[0] },
  });
  if (res.statusCode !== 201) {
    throw new Error(`register failed: ${res.statusCode} ${res.payload}`);
  }
  const body = res.json();
  return { accessToken: body.accessToken, userId: body.user.id };
}
