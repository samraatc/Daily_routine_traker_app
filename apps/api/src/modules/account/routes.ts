import { type FastifyInstance } from 'fastify';

import { writeAudit } from '../../lib/audit.js';

export default async function accountRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  /** GET /account/export — returns the caller's data as JSON. */
  app.get('/export', async (req) => {
    const userId = req.user.id;
    const [user, tasks, completions, books, progress, bookmarks] = await Promise.all([
      app.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      app.prisma.task.findMany({ where: { userId } }),
      app.prisma.completion.findMany({ where: { userId } }),
      app.prisma.book.findMany({ where: { ownerId: userId } }),
      app.prisma.readingProgress.findMany({ where: { userId } }),
      app.prisma.bookmark.findMany({ where: { userId } }),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        timezone: user.timezone,
        locale: user.locale,
        createdAt: user.createdAt.toISOString(),
      },
      tasks,
      completions,
      books: books.map((b) => ({ ...b, sizeBytes: Number(b.sizeBytes) })),
      progress,
      bookmarks,
    };
  });

  /** DELETE /account — cascade + tombstone. */
  app.delete('/', async (req, reply) => {
    const userId = req.user.id;
    await app.prisma.$transaction(async (tx) => {
      await tx.completion.deleteMany({ where: { userId } });
      await tx.task.deleteMany({ where: { userId } });
      await tx.readingProgress.deleteMany({ where: { userId } });
      await tx.bookmark.deleteMany({ where: { userId } });
      await tx.bookDownload.deleteMany({ where: { userId } });
      await tx.report.deleteMany({ where: { reporterId: userId } });
      await tx.notificationLog.deleteMany({ where: { userId } });
      await tx.deviceToken.deleteMany({ where: { userId } });
      await tx.book.updateMany({
        where: { ownerId: userId },
        data: { deletedAt: new Date() },
      });
      await tx.streak.deleteMany({ where: { userId } });

      // Tombstone the User row instead of deleting (preserves AuditLog FKs).
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `anonymous+${userId}@deleted.local`,
          name: null,
          avatarUrl: null,
          suspendedAt: new Date(),
        },
      });
    });
    await writeAudit(app.prisma, {
      actorId: userId,
      action: 'account.delete',
      targetType: 'User',
      targetId: userId,
      req,
    });
    return reply.code(204).send();
  });
}
