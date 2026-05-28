import { type FastifyInstance } from 'fastify';

import { UnauthorizedError } from '../../errors.js';
import { createAuthService } from './service.js';
import { loginInputSchema, refreshInputSchema, registerInputSchema } from './schema.js';

export default async function authRoutes(app: FastifyInstance) {
  const svc = createAuthService(app.prisma);

  app.post('/register', async (req, reply) => {
    const input = registerInputSchema.parse(req.body);
    const user = await svc.register(input);
    const accessToken = await reply.jwtSign(
      { sub: user.id, role: user.role, freshAuthAt: Math.floor(Date.now() / 1000) },
      { expiresIn: '15m' },
    );
    const refreshToken = await reply.jwtSign(
      { sub: user.id, role: user.role, freshAuthAt: Math.floor(Date.now() / 1000), kind: 'refresh' },
      { expiresIn: '7d' },
    );
    return reply.code(201).send({
      accessToken,
      refreshToken,
      user: svc.publicProfile(user),
    });
  });

  app.post('/login', async (req, reply) => {
    const { email, password } = loginInputSchema.parse(req.body);
    const user = await svc.login(email, password);
    const accessToken = await reply.jwtSign(
      { sub: user.id, role: user.role, freshAuthAt: Math.floor(Date.now() / 1000) },
      { expiresIn: '15m' },
    );
    const refreshToken = await reply.jwtSign(
      { sub: user.id, role: user.role, freshAuthAt: Math.floor(Date.now() / 1000), kind: 'refresh' },
      { expiresIn: '7d' },
    );
    return { accessToken, refreshToken, user: svc.publicProfile(user) };
  });

  app.post('/refresh', async (req, reply) => {
    const { refreshToken } = refreshInputSchema.parse(req.body);
    try {
      const decoded = (await app.jwt.verify(refreshToken)) as {
        sub: string;
        role: 'user' | 'contributor' | 'moderator' | 'admin' | 'super_admin';
        kind?: string;
      };
      if (decoded.kind !== 'refresh') throw new UnauthorizedError();
      const user = await svc.findById(decoded.sub);
      if (!user || user.suspendedAt) throw new UnauthorizedError();
      const accessToken = await reply.jwtSign(
        { sub: user.id, role: user.role, freshAuthAt: Math.floor(Date.now() / 1000) },
        { expiresIn: '15m' },
      );
      const newRefresh = await reply.jwtSign(
        { sub: user.id, role: user.role, freshAuthAt: Math.floor(Date.now() / 1000), kind: 'refresh' },
        { expiresIn: '7d' },
      );
      return { accessToken, refreshToken: newRefresh };
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }
  });

  app.post('/logout', { preHandler: app.authenticate }, async () => {
    // Stateless JWT logout — client deletes tokens. Production hardening:
    // maintain a refresh-token revocation list in Redis.
    return { ok: true };
  });

  app.get('/me', { preHandler: app.authenticate }, async (req) => {
    const user = await svc.findById(req.user.id);
    if (!user) throw new UnauthorizedError();
    return svc.publicProfile(user);
  });
}
