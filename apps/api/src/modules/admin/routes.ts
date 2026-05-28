import { type FastifyInstance } from 'fastify';

import { ForbiddenError, NotFoundError } from '../../errors.js';
import { writeAudit } from '../../lib/audit.js';
import {
  adminUserUpdateSchema,
  broadcastSchema,
  moderationDecisionSchema,
  upsertFeatureFlagSchema,
  uuidSchema,
} from '@app/types';

export default async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', app.requireRole('moderator'));

  /** GET /admin/dashboard */
  app.get('/dashboard', async () => {
    const [users, pending, openReports, completions] = await Promise.all([
      app.prisma.user.count(),
      app.prisma.book.count({ where: { visibility: 'pending_review' } }),
      app.prisma.report.count({ where: { status: 'open' } }),
      app.prisma.completion.count({
        where: { completedAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
      }),
    ]);
    const readingSeconds = await app.prisma.readingProgress.aggregate({
      _sum: { secondsRead: true },
    });
    const tasksWithRepeats = await app.prisma.task.count({ where: { deletedAt: null } });
    // Rough approximation; the real implementation reads aggregated views.
    const completionRate =
      tasksWithRepeats === 0 ? 0 : Math.min(100, (completions / (tasksWithRepeats * 30)) * 100);
    return {
      users: { dau: 0, mau: users }, // placeholder; analytics events feed this in prod
      readingMinutes: {
        today: 0,
        week: 0,
        month: Math.round((readingSeconds._sum.secondsRead ?? 0) / 60),
      },
      completionRate: Math.round(completionRate),
      pendingModerationCount: pending,
      openReportsCount: openReports,
    };
  });

  /** GET /admin/moderation?status=pending */
  app.get('/moderation', async (req) => {
    const status = (req.query as { status?: string }).status ?? 'pending';
    const where =
      status === 'pending' ? { visibility: 'pending_review' as const } : { visibility: 'public' as const };
    const items = await app.prisma.book.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    return {
      items: items.map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author,
        ownerId: b.ownerId,
        sizeBytes: Number(b.sizeBytes),
        pageCount: b.pageCount,
        format: b.format,
        createdAt: b.createdAt.toISOString(),
      })),
    };
  });

  /** POST /admin/moderation/:bookId/approve */
  app.post('/moderation/:bookId/approve', async (req) => {
    const bookId = uuidSchema.parse((req.params as { bookId: string }).bookId);
    const before = await app.prisma.book.findUnique({ where: { id: bookId } });
    if (!before) throw new NotFoundError('book');
    if (before.visibility !== 'pending_review') {
      return { id: before.id, visibility: before.visibility };
    }
    const updated = await app.prisma.book.update({
      where: { id: bookId },
      data: {
        visibility: 'public',
        reviewedById: req.user.id,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
    });
    await writeAudit(app.prisma, {
      actorId: req.user.id,
      action: 'book.moderate.approve',
      targetType: 'Book',
      targetId: bookId,
      diff: { from: before.visibility, to: updated.visibility },
      req,
    });
    return { id: updated.id, visibility: updated.visibility };
  });

  /** POST /admin/moderation/:bookId/reject */
  app.post('/moderation/:bookId/reject', async (req) => {
    const bookId = uuidSchema.parse((req.params as { bookId: string }).bookId);
    const input = moderationDecisionSchema.parse(req.body);
    const before = await app.prisma.book.findUnique({ where: { id: bookId } });
    if (!before) throw new NotFoundError('book');
    const updated = await app.prisma.book.update({
      where: { id: bookId },
      data: {
        visibility: 'rejected',
        reviewedById: req.user.id,
        reviewedAt: new Date(),
        rejectionReason: input.reason ?? 'No reason provided',
      },
    });
    await writeAudit(app.prisma, {
      actorId: req.user.id,
      action: 'book.moderate.reject',
      targetType: 'Book',
      targetId: bookId,
      diff: { from: before.visibility, to: 'rejected', reason: input.reason ?? null },
      req,
    });
    return { id: updated.id, visibility: updated.visibility };
  });

  /** PATCH /admin/users/:id — change role or suspend (admin+). */
  app.patch('/users/:id', { preHandler: app.requireRole('admin') }, async (req) => {
    const id = uuidSchema.parse((req.params as { id: string }).id);
    const input = adminUserUpdateSchema.parse(req.body);
    const before = await app.prisma.user.findUnique({ where: { id } });
    if (!before) throw new NotFoundError('user');

    // Only super_admin can grant admin or higher roles.
    if (input.role && input.role !== 'user' && req.user.role !== 'super_admin') {
      if (input.role === 'moderator' && req.user.role === 'admin') {
        // OK — admin can elevate to moderator
      } else {
        throw new ForbiddenError('Role elevation requires super_admin');
      }
    }

    const updated = await app.prisma.user.update({
      where: { id },
      data: {
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.suspended !== undefined
          ? { suspendedAt: input.suspended ? new Date() : null }
          : {}),
      },
    });
    await writeAudit(app.prisma, {
      actorId: req.user.id,
      action: 'user.update',
      targetType: 'User',
      targetId: id,
      diff: {
        role: { from: before.role, to: updated.role },
        suspended: { from: before.suspendedAt, to: updated.suspendedAt },
      },
      req,
    });
    return {
      id: updated.id,
      role: updated.role,
      suspendedAt: updated.suspendedAt?.toISOString() ?? null,
    };
  });

  /** GET / POST /admin/feature-flags (admin+). */
  app.get('/feature-flags', { preHandler: app.requireRole('admin') }, async () => {
    return app.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  });

  app.post('/feature-flags', { preHandler: app.requireRole('admin') }, async (req, reply) => {
    const input = upsertFeatureFlagSchema.parse(req.body);
    const existing = await app.prisma.featureFlag.findUnique({ where: { key: input.key } });
    const f = existing
      ? await app.prisma.featureFlag.update({
          where: { key: input.key },
          data: {
            enabled: input.enabled,
            rolloutPercent: input.rolloutPercent,
            audience: input.audience ?? undefined,
          },
        })
      : await app.prisma.featureFlag.create({
          data: {
            key: input.key,
            enabled: input.enabled,
            rolloutPercent: input.rolloutPercent,
            audience: input.audience ?? undefined,
          },
        });
    await writeAudit(app.prisma, {
      actorId: req.user.id,
      action: existing ? 'flag.update' : 'flag.create',
      targetType: 'FeatureFlag',
      targetId: f.id,
      diff: input,
      req,
    });
    return reply.code(existing ? 200 : 201).send(f);
  });

  /** POST /admin/broadcasts (admin+, super_admin for >10k). */
  app.post('/broadcasts', { preHandler: app.requireRole('admin') }, async (req, reply) => {
    const input = broadcastSchema.parse(req.body);
    // Estimate audience.
    const where: any = {};
    if (input.audience.roles?.length) where.role = { in: input.audience.roles };
    if (input.audience.timezones?.length) where.timezone = { in: input.audience.timezones };
    const estimatedAudience = await app.prisma.user.count({ where });

    const requiresSuperAdminApproval = estimatedAudience > 10_000;
    if (requiresSuperAdminApproval && req.user.role !== 'super_admin') {
      throw new ForbiddenError('Broadcasts > 10k require super_admin');
    }

    // Enqueue would happen here. For now write a log row.
    await app.prisma.notificationLog.create({
      data: {
        userId: req.user.id,
        type: 'broadcast',
        payload: { title: input.title, body: input.body, deepLink: input.deepLink ?? null },
      },
    });

    await writeAudit(app.prisma, {
      actorId: req.user.id,
      action: 'broadcast.send',
      targetType: 'Broadcast',
      diff: { audienceSize: estimatedAudience, urgent: input.urgent },
      req,
    });

    return reply.code(202).send({
      broadcastId: crypto.randomUUID(),
      estimatedAudience,
      requiresSuperAdminApproval,
    });
  });

  /** GET /admin/audit-log */
  app.get('/audit-log', async (req) => {
    const limit = Number((req.query as { limit?: string }).limit ?? 50);
    const rows = await app.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
    return rows.map((r) => ({
      id: r.id,
      actorId: r.actorId,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      diff: r.diff,
      ip: r.ip,
      userAgent: r.userAgent,
      createdAt: r.createdAt.toISOString(),
    }));
  });
}
