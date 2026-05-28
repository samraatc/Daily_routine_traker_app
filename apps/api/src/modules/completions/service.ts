import { type PrismaClient } from '@prisma/client';

import { NotFoundError } from '../../errors.js';
import { todayInZone, toDateString } from '../../lib/time.js';
import { recomputeStreak } from './streak.js';
import type { CreateCompletionInput, ListCompletionsQuery } from '@app/types';

export type CompletionsService = ReturnType<typeof createCompletionsService>;

export function createCompletionsService(prisma: PrismaClient) {
  return {
    async list(userId: string, query: ListCompletionsQuery) {
      return prisma.completion.findMany({
        where: {
          userId,
          ...(query.taskId ? { taskId: query.taskId } : {}),
          ...(query.from || query.to
            ? {
                completedAt: {
                  ...(query.from ? { gte: new Date(`${query.from}T00:00:00Z`) } : {}),
                  ...(query.to ? { lte: new Date(`${query.to}T00:00:00Z`) } : {}),
                },
              }
            : {}),
        },
        orderBy: { completedAt: 'desc' },
        take: 200,
      });
    },

    /** Idempotent: a second call with the same (task, day) returns the original. */
    async markDone(userId: string, input: CreateCompletionInput) {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      const task = await prisma.task.findUnique({ where: { id: input.taskId } });
      if (!task || task.deletedAt || task.userId !== userId) throw new NotFoundError('task');

      const dateStr = input.completedAt ?? todayInZone(user.timezone);
      const completedAt = new Date(`${dateStr}T00:00:00Z`);

      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.completion.findUnique({
          where: { taskId_userId_completedAt: { taskId: task.id, userId, completedAt } },
        });

        const completion =
          existing ??
          (await tx.completion.create({
            data: {
              taskId: task.id,
              userId,
              completedAt,
              skipped: input.skipped,
            },
          }));

        const streak = await recomputeStreak(tx, userId);
        return { completion, streak, isNew: !existing };
      });

      return {
        completion: {
          id: result.completion.id,
          taskId: result.completion.taskId,
          userId: result.completion.userId,
          completedAt: toDateString(result.completion.completedAt),
          skipped: result.completion.skipped,
          createdAt: result.completion.createdAt.toISOString(),
        },
        streak: {
          currentStreak: result.streak.currentStreak,
          longestStreak: result.streak.longestStreak,
          lastCompletedDate: result.streak.lastCompletedDate
            ? toDateString(result.streak.lastCompletedDate)
            : null,
        },
        isNew: result.isNew,
      };
    },

    async undo(userId: string, completionId: string) {
      const c = await prisma.completion.findUnique({ where: { id: completionId } });
      if (!c || c.userId !== userId) throw new NotFoundError('completion');
      await prisma.$transaction(async (tx) => {
        await tx.completion.delete({ where: { id: c.id } });
        await recomputeStreak(tx, userId);
      });
    },
  };
}
