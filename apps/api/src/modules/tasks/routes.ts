import { type FastifyInstance } from 'fastify';

import {
  createTaskSchema,
  listTasksQuerySchema,
  reorderTaskSchema,
  updateTaskSchema,
  uuidSchema,
} from '@app/types';

import { createTasksService, serializeTask } from './service.js';
import { dayOfWeek } from '../../lib/time.js';

export default async function tasksRoutes(app: FastifyInstance) {
  const svc = createTasksService(app.prisma);

  app.addHook('preHandler', app.authenticate);

  app.get('/', async (req) => {
    const q = listTasksQuerySchema.parse(req.query);
    let dow: number | undefined;
    if (q.date) {
      // Explicit date filter (YYYY-MM-DD).
      dow = dayOfWeek(q.date);
    }
    const tasks = await svc.list(req.user.id, { includeDeleted: q.includeDeleted, dayOfWeek: dow });
    return tasks.map(serializeTask);
  });

  app.post('/', async (req, reply) => {
    const input = createTaskSchema.parse(req.body);
    const task = await svc.create(req.user.id, input);
    return reply.code(201).send(serializeTask(task));
  });

  app.get('/:id', async (req) => {
    const id = uuidSchema.parse((req.params as { id: string }).id);
    return serializeTask(await svc.get(req.user.id, id));
  });

  app.patch('/:id', async (req) => {
    const id = uuidSchema.parse((req.params as { id: string }).id);
    const input = updateTaskSchema.parse(req.body);
    return serializeTask(await svc.update(req.user.id, id, input));
  });

  app.delete('/:id', async (req, reply) => {
    const id = uuidSchema.parse((req.params as { id: string }).id);
    await svc.softDelete(req.user.id, id);
    return reply.code(204).send();
  });

  app.post('/:id/reorder', async (req) => {
    const id = uuidSchema.parse((req.params as { id: string }).id);
    const { orderIndex } = reorderTaskSchema.parse(req.body);
    return serializeTask(await svc.reorder(req.user.id, id, orderIndex));
  });
}
