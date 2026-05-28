import { type FastifyInstance } from 'fastify';

import {
  createCompletionSchema,
  listCompletionsQuerySchema,
  uuidSchema,
} from '@app/types';

import { toDateString } from '../../lib/time.js';
import { createCompletionsService } from './service.js';

export default async function completionsRoutes(app: FastifyInstance) {
  const svc = createCompletionsService(app.prisma);

  app.addHook('preHandler', app.authenticate);

  app.get('/', async (req) => {
    const query = listCompletionsQuerySchema.parse(req.query);
    const rows = await svc.list(req.user.id, query);
    return rows.map((c) => ({
      id: c.id,
      taskId: c.taskId,
      userId: c.userId,
      completedAt: toDateString(c.completedAt),
      skipped: c.skipped,
      createdAt: c.createdAt.toISOString(),
    }));
  });

  app.post('/', async (req, reply) => {
    const input = createCompletionSchema.parse(req.body);
    const result = await svc.markDone(req.user.id, input);
    return reply.code(result.isNew ? 201 : 200).send({
      completion: result.completion,
      streak: result.streak,
    });
  });

  app.delete('/:id', async (req, reply) => {
    const id = uuidSchema.parse((req.params as { id: string }).id);
    await svc.undo(req.user.id, id);
    return reply.code(204).send();
  });
}
