import { z } from 'zod';

import { isoTimeSchema, uuidSchema } from './common.js';
import { roleSchema, taskCategorySchema } from './enums.js';

export const userSchema = z.object({
  id: uuidSchema,
  email: z.string().email(),
  name: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  timezone: z.string(),
  locale: z.string(),
  role: roleSchema,
  quietHoursStart: isoTimeSchema.nullable(),
  quietHoursEnd: isoTimeSchema.nullable(),
  mutedCategories: z.array(taskCategorySchema),
  createdAt: z.string().datetime(),
  lastActiveAt: z.string().datetime(),
  suspendedAt: z.string().datetime().nullable(),
});
export type User = z.infer<typeof userSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  quietHoursStart: isoTimeSchema.nullable().optional(),
  quietHoursEnd: isoTimeSchema.nullable().optional(),
  mutedCategories: z.array(taskCategorySchema).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
