import { z } from 'zod';

import { isoTimeSchema, uuidSchema } from './common.js';
import { taskCategorySchema } from './enums.js';

export const taskSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  title: z.string(),
  description: z.string().nullable(),
  category: taskCategorySchema,
  time: isoTimeSchema.nullable(),
  repeatDays: z.array(z.number().int().min(0).max(6)),
  remindEnabled: z.boolean(),
  quietHoursOverride: z.boolean(),
  linkedBookId: uuidSchema.nullable(),
  orderIndex: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type Task = z.infer<typeof taskSchema>;

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: taskCategorySchema.default('other'),
  time: isoTimeSchema.nullable().optional(),
  repeatDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  remindEnabled: z.boolean().default(false),
  quietHoursOverride: z.boolean().default(false),
  linkedBookId: uuidSchema.nullable().optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = createTaskSchema.partial();
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const reorderTaskSchema = z.object({
  orderIndex: z.number().int().min(0).max(100_000),
});
export type ReorderTaskInput = z.infer<typeof reorderTaskSchema>;

export const listTasksQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .optional(),
  includeDeleted: z.coerce.boolean().default(false),
});
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
