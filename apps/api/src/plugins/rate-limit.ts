import rateLimit from '@fastify/rate-limit';
import { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { isTest } from '../config.js';

export const rateLimitPlugin = fp(async (app: FastifyInstance) => {
  // Disable in test mode so suites run fast.
  if (isTest()) return;

  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '15 minutes',
    keyGenerator: (req) =>
      // Prefer userId if authenticated, else IP.
      (req.user?.id ?? req.ip),
  });
});
