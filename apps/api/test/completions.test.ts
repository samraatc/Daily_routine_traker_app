import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { getApp, registerAndLogin, resetDatabase } from './helpers.js';

describe('completions + streak', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    const app = await getApp();
    await app.close();
  });

  it('is idempotent on (task, day) — a second mark returns 200 with same id', async () => {
    const app = await getApp();
    const { accessToken } = await registerAndLogin(app, 'alice@example.com');
    const auth = { authorization: `Bearer ${accessToken}` };

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: auth,
      payload: { title: 'Meditate', category: 'morning', repeatDays: [0, 1, 2, 3, 4, 5, 6] },
    });
    const taskId = create.json().id;

    const today = new Date().toISOString().slice(0, 10);
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/completions',
      headers: auth,
      payload: { taskId, completedAt: today },
    });
    expect(first.statusCode).toBe(201);
    const firstBody = first.json();
    expect(firstBody.completion.taskId).toBe(taskId);
    expect(firstBody.streak.currentStreak).toBeGreaterThanOrEqual(1);

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/completions',
      headers: auth,
      payload: { taskId, completedAt: today },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().completion.id).toBe(firstBody.completion.id);
  });

  it('extends the streak across consecutive days', async () => {
    const app = await getApp();
    const { accessToken } = await registerAndLogin(app, 'alice@example.com');
    const auth = { authorization: `Bearer ${accessToken}` };

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: auth,
      payload: { title: 'Read', category: 'reading', repeatDays: [0, 1, 2, 3, 4, 5, 6] },
    });
    const taskId = create.json().id;

    const today = new Date();
    const yday = new Date(today.getTime() - 86_400_000);
    const ymd = (d: Date) => d.toISOString().slice(0, 10);

    // Mark yesterday first, then today.
    await app.inject({
      method: 'POST',
      url: '/api/v1/completions',
      headers: auth,
      payload: { taskId, completedAt: ymd(yday) },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/completions',
      headers: auth,
      payload: { taskId, completedAt: ymd(today) },
    });
    expect(res.json().streak.currentStreak).toBe(2);
  });

  it('undo decrements the streak', async () => {
    const app = await getApp();
    const { accessToken } = await registerAndLogin(app, 'alice@example.com');
    const auth = { authorization: `Bearer ${accessToken}` };

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: auth,
      payload: { title: 'Move', category: 'health', repeatDays: [0, 1, 2, 3, 4, 5, 6] },
    });
    const taskId = create.json().id;

    const today = new Date().toISOString().slice(0, 10);
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/completions',
      headers: auth,
      payload: { taskId, completedAt: today },
    });
    const completionId = first.json().completion.id;

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/completions/${completionId}`,
      headers: auth,
    });
    expect(del.statusCode).toBe(204);

    const streaks = await app.inject({
      method: 'GET',
      url: '/api/v1/stats/streaks',
      headers: auth,
    });
    expect(streaks.json().currentStreak).toBe(0);
  });
});
