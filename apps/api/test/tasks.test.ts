import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { getApp, registerAndLogin, resetDatabase } from './helpers.js';

describe('tasks CRUD', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    const app = await getApp();
    await app.close();
  });

  it('full CRUD round-trip', async () => {
    const app = await getApp();
    const { accessToken } = await registerAndLogin(app, 'alice@example.com');
    const auth = { authorization: `Bearer ${accessToken}` };

    // Create
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: auth,
      payload: {
        title: 'Meditate',
        category: 'morning',
        time: '06:30',
        repeatDays: [1, 2, 3, 4, 5],
        remindEnabled: true,
      },
    });
    expect(create.statusCode).toBe(201);
    const task = create.json();
    expect(task.title).toBe('Meditate');
    expect(task.repeatDays).toEqual([1, 2, 3, 4, 5]);

    // Read list
    const list = await app.inject({ method: 'GET', url: '/api/v1/tasks', headers: auth });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(1);

    // Update
    const upd = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${task.id}`,
      headers: auth,
      payload: { title: 'Meditate 10 min' },
    });
    expect(upd.statusCode).toBe(200);
    expect(upd.json().title).toBe('Meditate 10 min');

    // Soft-delete
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/tasks/${task.id}`,
      headers: auth,
    });
    expect(del.statusCode).toBe(204);

    const listAfter = await app.inject({ method: 'GET', url: '/api/v1/tasks', headers: auth });
    expect(listAfter.json()).toHaveLength(0);
  });

  it('rejects access to another user', async () => {
    const app = await getApp();
    const alice = await registerAndLogin(app, 'alice@example.com');
    const bob = await registerAndLogin(app, 'bob@example.com');

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { title: 'Private', category: 'other', repeatDays: [1] },
    });
    const taskId = create.json().id;

    const bobAccess = await app.inject({
      method: 'GET',
      url: `/api/v1/tasks/${taskId}`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(bobAccess.statusCode).toBe(404); // hidden via 404 (not 403) by design
  });

  it('rejects invalid repeatDays', async () => {
    const app = await getApp();
    const { accessToken } = await registerAndLogin(app, 'alice@example.com');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { title: 'Bad', category: 'other', repeatDays: [9] },
    });
    expect(res.statusCode).toBe(422);
  });
});
