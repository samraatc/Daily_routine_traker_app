import { type FastifyInstance } from 'fastify';

import { NotFoundError } from '../../errors.js';
import { registerDeviceSchema, uuidSchema } from '@app/types';

export default async function notificationsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  /** POST /notifications/devices — register or refresh a device token. */
  app.post('/devices', async (req, reply) => {
    const input = registerDeviceSchema.parse(req.body);
    const existing = await app.prisma.deviceToken.findUnique({ where: { token: input.token } });
    const data = {
      userId: req.user.id,
      token: input.token,
      platform: input.platform,
      locale: input.locale ?? null,
      appVersion: input.appVersion ?? null,
      lastSeenAt: new Date(),
      staleAt: null,
    };
    const row = existing
      ? await app.prisma.deviceToken.update({ where: { id: existing.id }, data })
      : await app.prisma.deviceToken.create({ data });
    return reply.code(existing ? 200 : 201).send({
      id: row.id,
      platform: row.platform,
      token: row.token,
      locale: row.locale,
      appVersion: row.appVersion,
      createdAt: row.createdAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
    });
  });

  /** DELETE /notifications/devices/:id */
  app.delete('/devices/:id', async (req, reply) => {
    const id = uuidSchema.parse((req.params as { id: string }).id);
    const d = await app.prisma.deviceToken.findUnique({ where: { id } });
    if (!d || d.userId !== req.user.id) throw new NotFoundError('device');
    await app.prisma.deviceToken.delete({ where: { id } });
    return reply.code(204).send();
  });

  /** GET /notifications/inbox */
  app.get('/inbox', async (req) => {
    const rows = await app.prisma.notificationLog.findMany({
      where: { userId: req.user.id },
      orderBy: { sentAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: ((r.payload as any)?.title as string) ?? '',
      body: ((r.payload as any)?.body as string) ?? '',
      deepLink: ((r.payload as any)?.deepLink as string) ?? null,
      sentAt: r.sentAt.toISOString(),
      openedAt: r.openedAt?.toISOString() ?? null,
    }));
  });
}
