import { type FastifyInstance } from 'fastify';

import authRoutes from './auth/routes.js';
import tasksRoutes from './tasks/routes.js';
import completionsRoutes from './completions/routes.js';
import statsRoutes from './stats/routes.js';
import booksRoutes from './books/routes.js';
import notificationsRoutes from './notifications/routes.js';
import featureFlagsRoutes from './feature-flags/routes.js';
import adminRoutes from './admin/routes.js';
import accountRoutes from './account/routes.js';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(tasksRoutes, { prefix: '/tasks' });
  await app.register(completionsRoutes, { prefix: '/completions' });
  await app.register(statsRoutes, { prefix: '/stats' });
  await app.register(booksRoutes, { prefix: '/books' });
  await app.register(notificationsRoutes, { prefix: '/notifications' });
  await app.register(featureFlagsRoutes, { prefix: '/feature-flags' });
  await app.register(adminRoutes, { prefix: '/admin' });
  await app.register(accountRoutes, { prefix: '/account' });
}
