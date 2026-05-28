import { z } from 'zod';

import { isoDateSchema, uuidSchema } from './common.js';

export const completionSchema = z.object({
  id: uuidSchema,
  taskId: uuidSchema,
  userId: uuidSchema,
  completedAt: isoDateSchema,
  skipped: z.boolean(),
  createdAt: z.string().datetime(),
});
export type Completion = z.infer<typeof completionSchema>;

export const createCompletionSchema = z.object({
  taskId: uuidSchema,
  /** YYYY-MM-DD in the caller's timezone. Defaults to "today" server-side. */
  completedAt: isoDateSchema.optional(),
  skipped: z.boolean().default(false),
});
export type CreateCompletionInput = z.infer<typeof createCompletionSchema>;

/** POST /completions returns the new completion alongside the updated streak. */
export const completionResponseSchema = z.object({
  completion: completionSchema,
  streak: z.object({
    currentStreak: z.number().int().min(0),
    longestStreak: z.number().int().min(0),
    lastCompletedDate: isoDateSchema.nullable(),
  }),
});
export type CompletionResponse = z.infer<typeof completionResponseSchema>;

export const listCompletionsQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  taskId: uuidSchema.optional(),
});
export type ListCompletionsQuery = z.infer<typeof listCompletionsQuerySchema>;
