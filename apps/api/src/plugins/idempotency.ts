import { type FastifyInstance, type FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    idempotencyKey: string | null;
  }
}

/**
 * Reads X-Idempotency-Key off mutating requests and exposes it on the request.
 * In production this is backed by Redis with 24h TTL. For now we expose the
 * header and document the contract — modules can dedupe by querying the DB
 * (POST /completions uses a UNIQUE constraint instead).
 */
export const idempotencyPlugin = fp(async (app: FastifyInstance) => {
  app.addHook('preHandler', async (req: FastifyRequest) => {
    const header = req.headers['x-idempotency-key'];
    const key = typeof header === 'string' ? header.trim().slice(0, 200) : null;
    req.idempotencyKey = key && key.length > 0 ? key : null;
  });
});
