import { z } from 'zod';

import { uuidSchema } from './common.js';
import { reportReasonSchema, reportStatusSchema } from './enums.js';

export const reportSchema = z.object({
  id: uuidSchema,
  reporterId: uuidSchema,
  bookId: uuidSchema,
  reason: reportReasonSchema,
  detail: z.string().nullable(),
  status: reportStatusSchema,
  resolvedById: uuidSchema.nullable(),
  resolvedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type Report = z.infer<typeof reportSchema>;

export const createReportSchema = z.object({
  reason: reportReasonSchema,
  detail: z.string().max(500).optional(),
});
export type CreateReportInput = z.infer<typeof createReportSchema>;
