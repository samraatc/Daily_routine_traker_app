import { describe, expect, it } from 'vitest';

import { getApp } from './helpers.js';

describe('GET /health', () => {
  it('returns ok', async () => {
    const app = await getApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
  });
});

describe('GET /version', () => {
  it('returns metadata', async () => {
    const app = await getApp();
    const res = await app.inject({ method: 'GET', url: '/version' });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('@app/api');
  });
});
