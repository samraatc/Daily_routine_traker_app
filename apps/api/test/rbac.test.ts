import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { getApp, registerAndLogin, resetDatabase } from './helpers.js';

describe('RBAC on admin routes', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    const app = await getApp();
    await app.close();
  });

  it('rejects regular user from /admin/*', async () => {
    const app = await getApp();
    const { accessToken } = await registerAndLogin(app, 'alice@example.com');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/dashboard',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('allows moderator to read moderation queue', async () => {
    const app = await getApp();
    const { userId } = await registerAndLogin(app, 'mod@example.com');
    // Upgrade to moderator directly via Prisma (no public role-upgrade endpoint).
    await app.prisma.user.update({ where: { id: userId }, data: { role: 'moderator' } });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'mod@example.com', password: 'password123' },
    });
    const token = login.json().accessToken;
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/moderation',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('moderator cannot edit feature flags (admin-only)', async () => {
    const app = await getApp();
    const { userId } = await registerAndLogin(app, 'mod@example.com');
    await app.prisma.user.update({ where: { id: userId }, data: { role: 'moderator' } });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'mod@example.com', password: 'password123' },
    });
    const token = login.json().accessToken;
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/feature-flags',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
