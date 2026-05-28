import { z } from 'zod';

import { isoDateSchema, uuidSchema } from './common.js';

export const streakSchema = z.object({
  userId: uuidSchema,
  currentStreak: z.number().int().min(0),
  longestStreak: z.number().int().min(0),
  lastCompletedDate: isoDateSchema.nullable(),
});
export type Streak = z.infer<typeof streakSchema>;

/** GET /stats/weekly */
export const weeklyStatsSchema = z.object({
  days: z.array(
    z.object({
      date: isoDateSchema,
      done: z.number().int().min(0),
      total: z.number().int().min(0),
      percent: z.number().min(0).max(100),
    }),
  ),
});
export type WeeklyStats = z.infer<typeof weeklyStatsSchema>;

/** GET /stats/categories */
export const categoryStatsSchema = z.object({
  items: z.array(
    z.object({
      category: z.string(),
      done: z.number().int().min(0),
      total: z.number().int().min(0),
      percent: z.number().min(0).max(100),
    }),
  ),
});
export type CategoryStats = z.infer<typeof categoryStatsSchema>;

/** GET /stats/reading */
export const readingStatsSchema = z.object({
  totalMinutes: z.number().int().min(0),
  days: z.array(
    z.object({
      date: isoDateSchema,
      minutes: z.number().int().min(0),
    }),
  ),
});
export type ReadingStats = z.infer<typeof readingStatsSchema>;
