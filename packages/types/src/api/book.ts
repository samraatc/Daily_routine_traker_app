import { z } from 'zod';

import { uuidSchema } from './common.js';
import { bookFormatSchema, bookVisibilitySchema } from './enums.js';

export const bookSchema = z.object({
  id: uuidSchema,
  ownerId: uuidSchema,
  title: z.string(),
  author: z.string().nullable(),
  description: z.string().nullable(),
  format: bookFormatSchema,
  sizeBytes: z.number().int().nonnegative(),
  pageCount: z.number().int().nullable(),
  visibility: bookVisibilitySchema,
  categoryId: uuidSchema.nullable(),
  tags: z.array(z.string()),
  downloadsCount: z.number().int().nonnegative(),
  coverUrl: z.string().url().nullable(),
  readUrl: z.string().url().nullable(),
  readUrlExpiresAt: z.string().datetime().nullable(),
  rejectionReason: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Book = z.infer<typeof bookSchema>;

export const uploadUrlInputSchema = z.object({
  filename: z.string().min(1).max(200),
  format: bookFormatSchema,
  sizeBytes: z.number().int().min(1).max(52_428_800),
});
export type UploadUrlInput = z.infer<typeof uploadUrlInputSchema>;

export const uploadUrlResponseSchema = z.object({
  bookId: uuidSchema,
  fileKey: z.string(),
  uploadUrl: z.string().url(),
  expiresAt: z.string().datetime(),
  maxBytes: z.number().int(),
});
export type UploadUrlResponse = z.infer<typeof uploadUrlResponseSchema>;

export const registerBookSchema = z.object({
  bookId: uuidSchema,
  title: z.string().min(1).max(300),
  author: z.string().max(200).optional(),
  description: z.string().max(4000).optional(),
  categoryId: uuidSchema.nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(8).default([]),
});
export type RegisterBookInput = z.infer<typeof registerBookSchema>;

export const updateBookSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  author: z.string().max(200).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  categoryId: uuidSchema.nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(8).optional(),
  visibility: bookVisibilitySchema.optional(),
  rightsAccepted: z.boolean().optional(),
});
export type UpdateBookInput = z.infer<typeof updateBookSchema>;

export const listBooksQuerySchema = z.object({
  scope: z.enum(['mine', 'public']).default('public'),
  search: z.string().max(200).optional(),
  category: z.string().max(80).optional(),
  tag: z.string().max(40).optional(),
  sort: z.enum(['newest', 'trending', 'most_read']).default('newest'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type ListBooksQuery = z.infer<typeof listBooksQuerySchema>;
