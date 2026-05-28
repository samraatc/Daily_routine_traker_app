import { z } from 'zod';

export const registerInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(100).optional(),
  timezone: z.string().max(50).optional(),
  locale: z.string().max(10).optional(),
});

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export const refreshInputSchema = z.object({
  refreshToken: z.string().min(10),
});
