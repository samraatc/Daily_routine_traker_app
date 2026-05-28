import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { getApp, resetDatabase } from './helpers.js';

describe('auth', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    const app = await getApp();
    await app.close();
  });

  it('registers and logs in', async () => {
    const app = await getApp();
    const reg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'a@example.com', password: 'password123', name: 'A' },
    });
    expect(reg.statusCode).toBe(201);
    const body = reg.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.user.email).toBe('a@example.com');

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'a@example.com', password: 'password123' },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json().accessToken).toBeTruthy();
  });

  it('rejects bad credentials', async () => {
    const app = await getApp();
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'b@example.com', password: 'password123', name: 'B' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'b@example.com', password: 'WRONG' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects duplicate emails', async () => {
    const app = await getApp();
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'c@example.com', password: 'password123' },
    });
    const dup = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'c@example.com', password: 'password123' },
    });
    expect(dup.statusCode).toBe(409);
  });

  it('requires Bearer auth on protected routes', async () => {
    const app = await getApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('returns the current user via /me', async () => {
    const app = await getApp();
    const reg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'd@example.com', password: 'password123', name: 'D' },
    });
    const token = reg.json().accessToken;
    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe('d@example.com');
    expect(me.json().role).toBe('user');
  });
});
