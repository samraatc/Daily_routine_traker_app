import { type PrismaClient, type Task } from '@prisma/client';

import { ForbiddenError, NotFoundError } from '../../errors.js';
import type { CreateTaskInput, UpdateTaskInput } from '@app/types';

export type TasksService = ReturnType<typeof createTasksService>;

export function createTasksService(prisma: PrismaClient) {
  return {
    async list(userId: string, opts: { includeDeleted?: boolean; dayOfWeek?: number } = {}) {
      const where: any = { userId };
      if (!opts.includeDeleted) where.deletedAt = null;
      if (opts.dayOfWeek !== undefined) where.repeatDays = { has: opts.dayOfWeek };
      return prisma.task.findMany({
        where,
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      });
    },

    async get(userId: string, taskId: string): Promise<Task> {
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (!task || task.deletedAt) throw new NotFoundError('task');
      if (task.userId !== userId) throw new NotFoundError('task');
      return task;
    },

    async create(userId: string, input: CreateTaskInput): Promise<Task> {
      const last = await prisma.task.findFirst({
        where: { userId, deletedAt: null },
        orderBy: { orderIndex: 'desc' },
      });
      const nextOrder = last ? last.orderIndex + 100 : 100;
      return prisma.task.create({
        data: {
          userId,
          title: input.title,
          description: input.description ?? null,
          category: input.category ?? 'other',
          time: input.time ?? null,
          repeatDays: input.repeatDays,
          remindEnabled: input.remindEnabled ?? false,
          quietHoursOverride: input.quietHoursOverride ?? false,
          linkedBookId: input.linkedBookId ?? null,
          orderIndex: nextOrder,
        },
      });
    },

    async update(userId: string, taskId: string, input: UpdateTaskInput): Promise<Task> {
      const existing = await this.get(userId, taskId);
      return prisma.task.update({
        where: { id: existing.id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description ?? null } : {}),
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.time !== undefined ? { time: input.time ?? null } : {}),
          ...(input.repeatDays !== undefined ? { repeatDays: input.repeatDays } : {}),
          ...(input.remindEnabled !== undefined ? { remindEnabled: input.remindEnabled } : {}),
          ...(input.quietHoursOverride !== undefined
            ? { quietHoursOverride: input.quietHoursOverride }
            : {}),
          ...(input.linkedBookId !== undefined ? { linkedBookId: input.linkedBookId ?? null } : {}),
        },
      });
    },

    async softDelete(userId: string, taskId: string): Promise<void> {
      const existing = await this.get(userId, taskId);
      await prisma.task.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() },
      });
    },

    async reorder(userId: string, taskId: string, orderIndex: number): Promise<Task> {
      const existing = await this.get(userId, taskId);
      if (existing.userId !== userId) throw new ForbiddenError();
      return prisma.task.update({
        where: { id: existing.id },
        data: { orderIndex },
      });
    },
  };
}

export function serializeTask(t: Task) {
  return {
    id: t.id,
    userId: t.userId,
    title: t.title,
    description: t.description,
    category: t.category,
    time: t.time,
    repeatDays: t.repeatDays,
    remindEnabled: t.remindEnabled,
    quietHoursOverride: t.quietHoursOverride,
    linkedBookId: t.linkedBookId,
    orderIndex: t.orderIndex,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    deletedAt: t.deletedAt ? t.deletedAt.toISOString() : null,
  };
}
