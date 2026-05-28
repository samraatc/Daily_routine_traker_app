import { z } from 'zod';

import { uuidSchema } from './common.js';

export const featureFlagSchema = z.object({
  id: uuidSchema,
  key: z.string(),
  enabled: z.boolean(),
  rolloutPercent: z.number().int().min(0).max(100),
  audience: z.record(z.unknown()).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type FeatureFlag = z.infer<typeof featureFlagSchema>;

export const upsertFeatureFlagSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z][a-z0-9_]*$/, 'snake_case, starts with a letter'),
  enabled: z.boolean(),
  rolloutPercent: z.number().int().min(0).max(100).default(0),
  audience: z.record(z.unknown()).nullable().optional(),
});
export type UpsertFeatureFlagInput = z.infer<typeof upsertFeatureFlagSchema>;

/** Response from GET /feature-flags — resolved for the calling user. */
export const resolvedFlagsSchema = z.record(z.boolean());
export type ResolvedFlags = z.infer<typeof resolvedFlagsSchema>;
