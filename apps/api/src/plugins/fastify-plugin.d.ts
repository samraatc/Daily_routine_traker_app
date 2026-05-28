// Minimal local typing for fastify-plugin (workspaces resolve at runtime).
declare module 'fastify-plugin' {
  import type { FastifyPluginAsync, FastifyPluginCallback } from 'fastify';
  type AnyPlugin = FastifyPluginAsync | FastifyPluginCallback;
  const fp: <T extends AnyPlugin>(
    plugin: T,
    options?: { name?: string; fastify?: string; dependencies?: string[] },
  ) => T;
  export default fp;
}
