import { type FastifyRequest } from 'fastify';
import { type PrismaClient } from '@prisma/client';

export type AuditArgs = {
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  diff?: unknown;
  req?: FastifyRequest;
};

/** Writes an AuditLog row. Idempotent re-callers are fine — log rows are append-only. */
export async function writeAudit(prisma: PrismaClient, args: AuditArgs): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: args.actorId,
      action: args.action,
      targetType: args.targetType ?? null,
      targetId: args.targetId ?? null,
      diff: args.diff === undefined ? undefined : (args.diff as any),
      ip: args.req?.ip ?? null,
      userAgent: (args.req?.headers['user-agent'] as string | undefined) ?? null,
    },
  });
}
