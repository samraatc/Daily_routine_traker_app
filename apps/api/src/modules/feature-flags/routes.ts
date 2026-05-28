import { createHash } from 'node:crypto';

import { type FastifyInstance } from 'fastify';

export default async function featureFlagsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  /**
   * GET /feature-flags — resolve enabled flags for the caller.
   * Deterministic hash over (userId + flagKey) gives the same answer every time.
   */
  app.get('/', async (req) => {
    const flags = await app.prisma.featureFlag.findMany({});
    const resolved: Record<string, boolean> = {};
    for (const f of flags) {
      if (!f.enabled) {
        resolved[f.key] = false;
        continue;
      }
      if (f.rolloutPercent >= 100) {
        resolved[f.key] = true;
        continue;
      }
      if (f.rolloutPercent <= 0) {
        resolved[f.key] = false;
        continue;
      }
      const h = createHash('sha256').update(`${req.user.id}:${f.key}`).digest();
      // First 4 bytes → unsigned int → bucket 0..99
      const bucket =
        (((h[0]! << 24) | (h[1]! << 16) | (h[2]! << 8) | h[3]!) >>> 0) % 100;
      resolved[f.key] = bucket < f.rolloutPercent;
    }
    return resolved;
  });
}
