import { z } from 'zod';

import { uuidSchema } from './common.js';

export const readingProgressSchema = z.object({
  userId: uuidSchema,
  bookId: uuidSchema,
  currentLocator: z.string().nullable(),
  percent: z.number().min(0).max(100),
  secondsRead: z.number().int().min(0),
  lastReadAt: z.string().datetime(),
});
export type ReadingProgress = z.infer<typeof readingProgressSchema>;

export const updateReadingProgressSchema = z.object({
  currentLocator: z.string().max(2000).optional(),
  percent: z.number().min(0).max(100).optional(),
  /** Increment to add to `secondsRead` (not the absolute value). */
  secondsReadDelta: z.number().int().min(0).max(86_400).optional(),
});
export type UpdateReadingProgressInput = z.infer<typeof updateReadingProgressSchema>;
