import { type FastifyInstance, type FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { ForbiddenError } from '../errors.js';
import { ROLE_RANK, type Role } from '@app/types';

export const rbacPlugin = fp(async (app: FastifyInstance) => {
  app.decorate('requireRole', (minRole: Role) => async (req: FastifyRequest) => {
    if (!req.user) throw new ForbiddenError();
    if (ROLE_RANK[req.user.role] < ROLE_RANK[minRole]) throw new ForbiddenError();
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    requireRole: (minRole: Role) => (req: FastifyRequest) => Promise<void>;
  }
}
