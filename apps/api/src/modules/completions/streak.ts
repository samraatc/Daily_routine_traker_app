import { type Prisma, type PrismaClient } from '@prisma/client';

import { addDays, dayOfWeek, todayInZone } from '../../lib/time.js';

/**
 * Recomputes the user's streak working backwards from `anchor` (YYYY-MM-DD).
 *
 * Rules (per docs/14-stats-engine.md §3.1):
 *  - A day is "completed" when every scheduled task has either a completion
 *    (`skipped=false`) or is marked skipped (`skipped=true`).
 *  - A day with zero scheduled tasks is "neutral" — doesn't break, doesn't extend.
 *  - Tasks created after the day OR soft-deleted on/before the day are excluded
 *    from that day's "total".
 *
 * We look back at most 365 days (any prior streak is sealed).
 */
export async function recomputeStreak(
  tx: PrismaClient | Prisma.TransactionClient,
  userId: string,
): Promise<{ currentStreak: number; longestStreak: number; lastCompletedDate: Date | null }> {
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
  const anchor = todayInZone(user.timezone);

  let streak = 0;
  let cursor = anchor;
  let lastCompleted: string | null = null;

  for (let i = 0; i < 365; i++) {
    const dow = dayOfWeek(cursor);
    const cursorDate = new Date(`${cursor}T00:00:00Z`);

    const scheduled = await tx.task.count({
      where: {
        userId,
        repeatDays: { has: dow },
        createdAt: { lte: cursorDate },
        OR: [{ deletedAt: null }, { deletedAt: { gt: cursorDate } }],
      },
    });

    if (scheduled === 0) {
      // Neutral: skip
      cursor = addDays(cursor, -1);
      continue;
    }

    const completed = await tx.completion.count({
      where: {
        userId,
        completedAt: cursorDate,
        task: {
          repeatDays: { has: dow },
          createdAt: { lte: cursorDate },
          OR: [{ deletedAt: null }, { deletedAt: { gt: cursorDate } }],
        },
      },
    });

    if (completed >= scheduled) {
      streak += 1;
      if (lastCompleted === null) lastCompleted = cursor;
      cursor = addDays(cursor, -1);
    } else {
      break;
    }
  }

  const existing = await tx.streak.findUnique({ where: { userId } });
  const longest = Math.max(existing?.longestStreak ?? 0, streak);
  const updated = await tx.streak.upsert({
    where: { userId },
    create: {
      userId,
      currentStreak: streak,
      longestStreak: longest,
      lastCompletedDate: lastCompleted ? new Date(`${lastCompleted}T00:00:00Z`) : null,
    },
    update: {
      currentStreak: streak,
      longestStreak: longest,
      lastCompletedDate: lastCompleted ? new Date(`${lastCompleted}T00:00:00Z`) : null,
    },
  });
  return {
    currentStreak: updated.currentStreak,
    longestStreak: updated.longestStreak,
    lastCompletedDate: updated.lastCompletedDate,
  };
}
