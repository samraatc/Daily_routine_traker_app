import { PrismaClient } from '@prisma/client';
import { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

let singleton: PrismaClient | null = null;

export const prismaPlugin = fp(async (app: FastifyInstance) => {
  if (!singleton) {
    singleton = new PrismaClient({
      log: app.log.level === 'debug' ? ['query', 'warn', 'error'] : ['warn', 'error'],
    });
    await singleton.$connect();
  }
  app.decorate('prisma', singleton);
  app.addHook('onClose', async () => {
    await singleton?.$disconnect();
    singleton = null;
  });
});
