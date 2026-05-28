import { z } from 'zod';

import { uuidSchema } from './common.js';
import { roleSchema } from './enums.js';

export const moderationDecisionSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type ModerationDecisionInput = z.infer<typeof moderationDecisionSchema>;

export const adminUserUpdateSchema = z.object({
  role: roleSchema.optional(),
  suspended: z.boolean().optional(),
});
export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;

export const broadcastSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
  deepLink: z.string().max(500).optional(),
  audience: z
    .object({
      roles: z.array(roleSchema).optional(),
      timezones: z.array(z.string()).optional(),
      minLastActiveDays: z.number().int().min(0).optional(),
      maxLastActiveDays: z.number().int().min(0).optional(),
    })
    .default({}),
  urgent: z.boolean().default(false),
});
export type BroadcastInput = z.infer<typeof broadcastSchema>;

export const broadcastResponseSchema = z.object({
  broadcastId: uuidSchema,
  estimatedAudience: z.number().int().min(0),
  requiresSuperAdminApproval: z.boolean(),
});
export type BroadcastResponse = z.infer<typeof broadcastResponseSchema>;

export const auditLogEntrySchema = z.object({
  id: uuidSchema,
  actorId: uuidSchema.nullable(),
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: uuidSchema.nullable(),
  diff: z.unknown(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;

export const dashboardSchema = z.object({
  users: z.object({ dau: z.number(), mau: z.number() }),
  readingMinutes: z.object({ today: z.number(), week: z.number(), month: z.number() }),
  completionRate: z.number().min(0).max(100),
  pendingModerationCount: z.number().int(),
  openReportsCount: z.number().int(),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
