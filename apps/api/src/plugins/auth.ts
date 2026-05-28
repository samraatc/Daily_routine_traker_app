import jwtPlugin from '@fastify/jwt';
import { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { loadConfig } from '../config.js';
import { UnauthorizedError } from '../errors.js';
import type { Role } from '@app/types';

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; role: Role; freshAuthAt: number };
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; role: Role; freshAuthAt: number };
    user: { id: string; role: Role; freshAuthAt: number };
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  const cfg = loadConfig();

  await app.register(jwtPlugin, {
    secret: cfg.JWT_SECRET,
    sign: { expiresIn: cfg.JWT_ACCESS_TTL },
    formatUser: (payload) => ({
      id: payload.sub,
      role: payload.role,
      freshAuthAt: payload.freshAuthAt,
    }),
  });

  // Verifier helper attached to instance for routes to call directly.
  app.decorate('authenticate', async (req: any) => {
    try {
      await req.jwtVerify();
    } catch {
      throw new UnauthorizedError();
    }
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: any) => Promise<void>;
  }
}
