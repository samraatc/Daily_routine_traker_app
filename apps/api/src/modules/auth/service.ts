import { type PrismaClient } from '@prisma/client';
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import { ConflictError, UnauthorizedError } from '../../errors.js';
import type { Role } from '@app/types';

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const SALT_LEN = 16;
const KEY_LEN = 64;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const derived = await scrypt(password, salt, KEY_LEN);
  return `scrypt:${salt.toString('base64')}:${derived.toString('base64')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltB64, hashB64] = stored.split(':');
  if (algo !== 'scrypt' || !saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  const derived = await scrypt(password, salt, expected.length);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/**
 * The schema doesn't carry a password column (Clerk is the source of truth
 * in prod). For dev/test we stash the hash in a JSONB column on User via the
 * `mutedCategories`... no — instead we use an out-of-schema fallback table.
 *
 * Pragmatic dev path: store `passwordHash` on the User row by repurposing
 * the `avatarUrl` column when prefixed with `cred:`. This is an explicit
 * dev/test affordance documented inline; production swaps to Clerk.
 */
const PW_PREFIX = 'cred:';

export type AuthService = ReturnType<typeof createAuthService>;

export function createAuthService(prisma: PrismaClient) {
  return {
    async register(input: {
      email: string;
      password: string;
      name?: string;
      timezone?: string;
      locale?: string;
    }) {
      const existing = await prisma.user.findUnique({ where: { email: input.email } });
      if (existing) throw new ConflictError('Email already registered');

      const hash = await hashPassword(input.password);
      const user = await prisma.user.create({
        data: {
          email: input.email,
          name: input.name ?? null,
          timezone: input.timezone ?? 'UTC',
          locale: input.locale ?? 'en',
          avatarUrl: `${PW_PREFIX}${hash}`,
          streak: { create: {} },
        },
        include: { streak: true },
      });
      return user;
    },

    async login(email: string, password: string) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.avatarUrl?.startsWith(PW_PREFIX)) {
        throw new UnauthorizedError('Invalid credentials');
      }
      if (user.suspendedAt) throw new UnauthorizedError('Account suspended');
      const ok = await verifyPassword(password, user.avatarUrl.slice(PW_PREFIX.length));
      if (!ok) throw new UnauthorizedError('Invalid credentials');
      await prisma.user.update({
        where: { id: user.id },
        data: { lastActiveAt: new Date() },
      });
      return user;
    },

    async findById(id: string) {
      return prisma.user.findUnique({ where: { id } });
    },

    publicProfile(u: {
      id: string;
      email: string;
      name: string | null;
      timezone: string;
      locale: string;
      role: Role;
      createdAt: Date;
      lastActiveAt: Date;
      suspendedAt: Date | null;
      avatarUrl: string | null;
      mutedCategories: string[];
      quietHoursStart: string | null;
      quietHoursEnd: string | null;
    }) {
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        // strip the dev credential pretend-column.
        avatarUrl: u.avatarUrl?.startsWith(PW_PREFIX) ? null : u.avatarUrl,
        timezone: u.timezone,
        locale: u.locale,
        role: u.role,
        quietHoursStart: u.quietHoursStart,
        quietHoursEnd: u.quietHoursEnd,
        mutedCategories: u.mutedCategories,
        createdAt: u.createdAt.toISOString(),
        lastActiveAt: u.lastActiveAt.toISOString(),
        suspendedAt: u.suspendedAt?.toISOString() ?? null,
      };
    },
  };
}
