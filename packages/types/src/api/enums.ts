import { z } from 'zod';

export const roleSchema = z.enum([
  'user',
  'contributor',
  'moderator',
  'admin',
  'super_admin',
]);
export type Role = z.infer<typeof roleSchema>;

export const ROLE_RANK: Record<Role, number> = {
  user: 0,
  contributor: 1,
  moderator: 2,
  admin: 3,
  super_admin: 4,
};

export const taskCategorySchema = z.enum([
  'morning',
  'work',
  'health',
  'evening',
  'study',
  'reading',
  'other',
]);
export type TaskCategory = z.infer<typeof taskCategorySchema>;

export const bookFormatSchema = z.enum(['pdf', 'epub']);
export type BookFormat = z.infer<typeof bookFormatSchema>;

export const bookVisibilitySchema = z.enum([
  'private',
  'pending_review',
  'public',
  'rejected',
]);
export type BookVisibility = z.infer<typeof bookVisibilitySchema>;

export const bookDownloadStatusSchema = z.enum(['pending', 'ready', 'failed']);
export type BookDownloadStatus = z.infer<typeof bookDownloadStatusSchema>;

export const reportReasonSchema = z.enum([
  'copyright',
  'abuse',
  'spam',
  'inaccurate',
  'other',
]);
export type ReportReason = z.infer<typeof reportReasonSchema>;

export const reportStatusSchema = z.enum(['open', 'resolved', 'dismissed']);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

export const notificationTypeSchema = z.enum(['reminder', 'broadcast', 'system']);
export type NotificationType = z.infer<typeof notificationTypeSchema>;
