import { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError } from 'zod';

import { AppError } from '../errors.js';

export const errorHandlerPlugin = fp(async (app: FastifyInstance) => {
  app.setErrorHandler((err, req, reply) => {
    const traceId = req.id;

    // Fastify built-in validation errors.
    if ((err as any).validation) {
      reply.status(422).send({
        type: 'https://errors.app/validation',
        title: 'Validation failed',
        status: 422,
        errors: (err as any).validation.map((v: any) => ({
          path: v.instancePath || v.params?.missingProperty || '',
          message: v.message ?? 'invalid',
        })),
        traceId,
      });
      return;
    }

    if (err instanceof ZodError) {
      reply.status(422).send({
        type: 'https://errors.app/validation',
        title: 'Validation failed',
        status: 422,
        errors: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        traceId,
      });
      return;
    }

    if (err instanceof AppError) {
      reply.status(err.status).send({
        type: err.type,
        title: err.message,
        status: err.status,
        detail: typeof err.details === 'string' ? err.details : undefined,
        traceId,
      });
      return;
    }

    // Rate-limit plugin errors.
    if ((err as any).statusCode === 429) {
      reply.status(429).send({
        type: 'https://errors.app/rate-limited',
        title: 'Too Many Requests',
        status: 429,
        detail: err.message,
        traceId,
      });
      return;
    }

    req.log.error({ err, traceId }, 'unhandled-error');
    reply.status(500).send({
      type: 'https://errors.app/internal',
      title: 'Internal Server Error',
      status: 500,
      traceId,
    });
  });

  app.setNotFoundHandler((req, reply) => {
    reply.status(404).send({
      type: 'https://errors.app/not-found',
      title: 'Not Found',
      status: 404,
      detail: `${req.method} ${req.url}`,
      traceId: req.id,
    });
  });
});
