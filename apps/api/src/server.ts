import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import Fastify, { type FastifyInstance } from 'fastify';

import { loadConfig } from './config.js';
import {
  authPlugin,
  errorHandlerPlugin,
  idempotencyPlugin,
  prismaPlugin,
  rateLimitPlugin,
  rbacPlugin,
} from './plugins/index.js';
import { registerRoutes } from './modules/index.js';

export async function buildServer(): Promise<FastifyInstance> {
  const cfg = loadConfig();
  const app = Fastify({
    logger:
      cfg.NODE_ENV === 'development'
        ? {
            level: cfg.LOG_LEVEL,
            transport: { target: 'pino-pretty', options: { colorize: true, singleLine: true } },
          }
        : { level: cfg.LOG_LEVEL },
    genReqId: () => `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    trustProxy: true,
  });

  // Order matters: error handler first, then auth before RBAC, etc.
  await app.register(errorHandlerPlugin);
  await app.register(sensible);
  await app.register(cors, { origin: true, credentials: true });
  await app.register(prismaPlugin);
  await app.register(authPlugin);
  await app.register(rbacPlugin);
  await app.register(idempotencyPlugin);
  await app.register(rateLimitPlugin);

  // Health
  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));
  app.get('/version', async () => ({
    name: '@app/api',
    version: '0.0.0',
    env: cfg.NODE_ENV,
  }));

  // Mount modules under /api/v1.
  await app.register(
    async (scoped) => {
      await registerRoutes(scoped);
    },
    { prefix: '/api/v1' },
  );

  return app;
}

// Entrypoint: only run when invoked directly, not when imported by tests.
const isEntrypoint = import.meta.url === `file://${process.argv[1]}`;

if (isEntrypoint) {
  const cfg = loadConfig();
  buildServer()
    .then((app) =>
      app.listen({ port: cfg.PORT, host: '0.0.0.0' }).then(() => {
        app.log.info(`API listening on http://localhost:${cfg.PORT}`);
      }),
    )
    .catch((err) => {
      console.error('Failed to start server', err);
      process.exit(1);
    });
}
