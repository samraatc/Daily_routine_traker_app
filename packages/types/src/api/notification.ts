import { z } from 'zod';

import { uuidSchema } from './common.js';
import { notificationTypeSchema } from './enums.js';

export const deviceTokenSchema = z.object({
  id: uuidSchema,
  platform: z.enum(['ios', 'android']),
  token: z.string(),
  locale: z.string().nullable(),
  appVersion: z.string().nullable(),
  createdAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
});
export type DeviceToken = z.infer<typeof deviceTokenSchema>;

export const registerDeviceSchema = z.object({
  token: z.string().min(1).max(500),
  platform: z.enum(['ios', 'android']),
  locale: z.string().max(10).optional(),
  appVersion: z.string().max(20).optional(),
});
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

export const notificationLogEntrySchema = z.object({
  id: uuidSchema,
  type: notificationTypeSchema,
  title: z.string(),
  body: z.string(),
  deepLink: z.string().nullable(),
  sentAt: z.string().datetime(),
  openedAt: z.string().datetime().nullable(),
});
export type NotificationLogEntry = z.infer<typeof notificationLogEntrySchema>;
