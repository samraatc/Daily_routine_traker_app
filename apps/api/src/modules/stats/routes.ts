import { type FastifyInstance } from 'fastify';

import { addDays, dayOfWeek, todayInZone } from '../../lib/time.js';

export default async function statsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  /** GET /stats/weekly — last 7 days of completion ratios. */
  app.get('/weekly', async (req) => {
    const user = await app.prisma.user.findUniqueOrThrow({ where: { id: req.user.id } });
    const today = todayInZone(user.timezone);
    const days: { date: string; done: number; total: number; percent: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = addDays(today, -i);
      const dow = dayOfWeek(date);
      const dateUtc = new Date(`${date}T00:00:00Z`);

      const total = await app.prisma.task.count({
        where: {
          userId: req.user.id,
          repeatDays: { has: dow },
          createdAt: { lte: dateUtc },
          OR: [{ deletedAt: null }, { deletedAt: { gt: dateUtc } }],
        },
      });
      const done = await app.prisma.completion.count({
        where: {
          userId: req.user.id,
          completedAt: dateUtc,
          skipped: false,
        },
      });
      const percent = total === 0 ? 0 : Math.round((done / total) * 100);
      days.push({ date, done, total, percent });
    }
    return { days };
  });

  /** GET /stats/streaks */
  app.get('/streaks', async (req) => {
    const s = await app.prisma.streak.findUnique({ where: { userId: req.user.id } });
    return {
      currentStreak: s?.currentStreak ?? 0,
      longestStreak: s?.longestStreak ?? 0,
      lastCompletedDate: s?.lastCompletedDate?.toISOString().slice(0, 10) ?? null,
    };
  });

  /** GET /stats/categories — completion ratio per category, last 7 days. */
  app.get('/categories', async (req) => {
    const user = await app.prisma.user.findUniqueOrThrow({ where: { id: req.user.id } });
    const today = todayInZone(user.timezone);
    const start = addDays(today, -6);

    const tasks = await app.prisma.task.findMany({
      where: { userId: req.user.id, deletedAt: null },
      select: { id: true, category: true, repeatDays: true },
    });

    const buckets = new Map<string, { done: number; total: number }>();

    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i);
      const dow = dayOfWeek(date);
      const dateUtc = new Date(`${date}T00:00:00Z`);
      const scheduled = tasks.filter((t) => t.repeatDays.includes(dow));
      for (const t of scheduled) {
        const cat = String(t.category);
        const b = buckets.get(cat) ?? { done: 0, total: 0 };
        b.total += 1;
        const done = await app.prisma.completion.findUnique({
          where: {
            taskId_userId_completedAt: {
              taskId: t.id,
              userId: req.user.id,
              completedAt: dateUtc,
            },
          },
        });
        if (done && !done.skipped) b.done += 1;
        buckets.set(cat, b);
      }
    }

    const items = [...buckets.entries()].map(([category, b]) => ({
      category,
      done: b.done,
      total: b.total,
      percent: b.total === 0 ? 0 : Math.round((b.done / b.total) * 100),
    }));
    return { items };
  });

  /** GET /stats/reading — minutes per day, last 7 days. */
  app.get('/reading', async (req) => {
    const user = await app.prisma.user.findUniqueOrThrow({ where: { id: req.user.id } });
    const today = todayInZone(user.timezone);

    const rows = await app.prisma.readingProgress.findMany({
      where: { userId: req.user.id },
      select: { secondsRead: true, lastReadAt: true },
    });

    // Per-day bucketing: dump everything that has touched the last 7 days.
    const days = new Map<string, number>();
    for (let i = 6; i >= 0; i--) days.set(addDays(today, -i), 0);

    let totalSeconds = 0;
    for (const r of rows) {
      const dateStr = r.lastReadAt.toISOString().slice(0, 10);
      if (days.has(dateStr)) {
        days.set(dateStr, (days.get(dateStr) ?? 0) + r.secondsRead);
      }
      totalSeconds += r.secondsRead;
    }

    return {
      totalMinutes: Math.round(totalSeconds / 60),
      days: [...days.entries()].map(([date, seconds]) => ({
        date,
        minutes: Math.round(seconds / 60),
      })),
    };
  });
}
