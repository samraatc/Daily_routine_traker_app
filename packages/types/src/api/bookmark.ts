import { z } from 'zod';

import { uuidSchema } from './common.js';

export const bookmarkSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  bookId: uuidSchema,
  locator: z.string(),
  note: z.string().nullable(),
  color: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type Bookmark = z.infer<typeof bookmarkSchema>;

export const createBookmarkSchema = z.object({
  bookId: uuidSchema,
  locator: z.string().min(1).max(2000),
  note: z.string().max(1000).optional(),
  color: z.enum(['yellow', 'green', 'blue', 'pink']).optional(),
});
export type CreateBookmarkInput = z.infer<typeof createBookmarkSchema>;
