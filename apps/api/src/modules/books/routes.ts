import { randomUUID } from 'node:crypto';

import { type FastifyInstance } from 'fastify';

import { ForbiddenError, NotFoundError, ValidationError } from '../../errors.js';
import { writeAudit } from '../../lib/audit.js';
import { getStorage } from '../../lib/storage/index.js';
import { loadConfig } from '../../config.js';
import {
  createReportSchema,
  listBooksQuerySchema,
  registerBookSchema,
  updateBookSchema,
  uploadUrlInputSchema,
  uuidSchema,
} from '@app/types';

function serializeBook(b: any) {
  return {
    id: b.id,
    ownerId: b.ownerId,
    title: b.title,
    author: b.author,
    description: b.description,
    format: b.format,
    sizeBytes: typeof b.sizeBytes === 'bigint' ? Number(b.sizeBytes) : b.sizeBytes,
    pageCount: b.pageCount,
    visibility: b.visibility,
    categoryId: b.categoryId,
    tags: b.tags,
    downloadsCount: b.downloadsCount,
    coverUrl: null,
    readUrl: null,
    readUrlExpiresAt: null,
    rejectionReason: b.rejectionReason,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

export default async function booksRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  /** POST /books/upload-url — mint an upload intent and a URL the client PUTs to. */
  app.post('/upload-url', async (req) => {
    const input = uploadUrlInputSchema.parse(req.body);
    const bookId = randomUUID();
    const fileKey = `users/${req.user.id}/books/${bookId}.${input.format}`;
    const storage = await getStorage();
    const intent = await storage.createUploadIntent({
      fileKey,
      contentType:
        input.format === 'pdf' ? 'application/pdf' : 'application/epub+zip',
      sizeBytes: input.sizeBytes,
    });
    return {
      bookId,
      fileKey: intent.fileKey,
      uploadUrl: intent.uploadUrl,
      expiresAt: intent.expiresAt.toISOString(),
      maxBytes: 50 * 1024 * 1024,
      storageDriver: storage.driverName,
    };
  });

  /**
   * PUT /books/upload-stream/:token — the actual binary destination when the
   * storage driver is MongoDB GridFS. The :token is the single-use credential
   * issued by /upload-url.
   *
   * Body is the raw file binary (content-type matches what /upload-url asked for).
   */
  app.put(
    '/upload-stream/:token',
    { config: { rawBody: true }, bodyLimit: 50 * 1024 * 1024 + 1024 },
    async (req, reply) => {
      const cfg = loadConfig();
      if (cfg.STORAGE_DRIVER !== 'mongodb') {
        throw new ValidationError(
          'This endpoint is only used when STORAGE_DRIVER=mongodb',
        );
      }
      const token = decodeURIComponent((req.params as { token: string }).token);
      const { MongoClient } = await import('mongodb');
      const { consumeUploadIntent } = await import('../../lib/storage/mongodb.js');
      if (!cfg.MONGODB_URL) throw new ValidationError('MONGODB_URL not configured');
      const client = new MongoClient(cfg.MONGODB_URL);
      try {
        await client.connect();
        const intent = await consumeUploadIntent(client, cfg.MONGODB_BUCKET_FILES, token);
        if (!intent) throw new NotFoundError('upload intent');
        const storage = await getStorage();
        const result = await storage.putObject({
          fileKey: intent.fileKey,
          contentType: intent.contentType,
          stream: req.raw,
        });
        return reply.code(204).send();
      } finally {
        await client.close();
      }
    },
  );

  /** POST /books — register a book after the upload completes. */
  app.post('/', async (req, reply) => {
    const input = registerBookSchema.parse(req.body);
    const fileKey = `users/${req.user.id}/books/${input.bookId}.pdf`;
    // Best effort: read the actual size from storage.
    let sizeBytes = BigInt(0);
    try {
      const storage = await getStorage();
      const obj = await storage.getObject(fileKey);
      sizeBytes = BigInt(obj.sizeBytes);
      obj.stream.destroy();
    } catch {
      // tolerate registration before upload (clients can call PATCH later)
    }
    const book = await app.prisma.book.create({
      data: {
        id: input.bookId,
        ownerId: req.user.id,
        title: input.title,
        author: input.author ?? null,
        description: input.description ?? null,
        fileKey,
        format: 'pdf',
        sizeBytes,
        visibility: 'private',
        categoryId: input.categoryId ?? null,
        tags: input.tags,
      },
    });
    return reply.code(201).send(serializeBook(book));
  });

  /** GET /books — list with scope + filters. */
  app.get('/', async (req) => {
    const q = listBooksQuerySchema.parse(req.query);
    const where: any = { deletedAt: null };
    if (q.scope === 'mine') where.ownerId = req.user.id;
    else where.visibility = 'public';

    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { author: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    if (q.tag) where.tags = { has: q.tag };

    const orderBy =
      q.sort === 'newest'
        ? { createdAt: 'desc' as const }
        : q.sort === 'most_read'
          ? { downloadsCount: 'desc' as const }
          : { downloadsCount: 'desc' as const };

    const items = await app.prisma.book.findMany({ where, orderBy, take: q.limit });
    return { items: items.map(serializeBook), nextCursor: null };
  });

  /** GET /books/:id */
  app.get('/:id', async (req) => {
    const id = uuidSchema.parse((req.params as { id: string }).id);
    const b = await app.prisma.book.findUnique({ where: { id } });
    if (!b || b.deletedAt) throw new NotFoundError('book');
    const canSee = b.ownerId === req.user.id || b.visibility === 'public';
    if (!canSee) throw new NotFoundError('book');
    return serializeBook(b);
  });

  /** GET /books/stream?key=<fileKey> — stream the raw bytes. Owner or public only. */
  app.get('/stream', async (req, reply) => {
    const key = String((req.query as { key?: string }).key ?? '');
    if (!key) throw new ValidationError('key required');
    const book = await app.prisma.book.findFirst({
      where: { fileKey: key, deletedAt: null },
    });
    if (!book) throw new NotFoundError('book');
    const canSee = book.ownerId === req.user.id || book.visibility === 'public';
    if (!canSee) throw new NotFoundError('book');
    const storage = await getStorage();
    const obj = await storage.getObject(key);
    reply.header('content-type', obj.contentType);
    reply.header('content-length', String(obj.sizeBytes));
    return reply.send(obj.stream);
  });

  /** PATCH /books/:id — update metadata or toggle visibility. */
  app.patch('/:id', async (req) => {
    const id = uuidSchema.parse((req.params as { id: string }).id);
    const input = updateBookSchema.parse(req.body);
    const b = await app.prisma.book.findUnique({ where: { id } });
    if (!b || b.deletedAt) throw new NotFoundError('book');
    if (b.ownerId !== req.user.id) throw new ForbiddenError();

    const data: any = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.author !== undefined ? { author: input.author } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
    };

    // Visibility state machine.
    if (input.visibility !== undefined) {
      if (input.visibility === 'public') {
        if (b.visibility === 'public' || b.visibility === 'pending_review') {
          data.visibility = b.visibility;
        } else {
          data.visibility = 'pending_review';
          if (input.rightsAccepted) data.rightsAcceptedAt = new Date();
        }
      } else if (input.visibility === 'private') {
        data.visibility = 'private';
      }
    }

    const updated = await app.prisma.book.update({ where: { id }, data });
    return serializeBook(updated);
  });

  /** DELETE /books/:id */
  app.delete('/:id', async (req, reply) => {
    const id = uuidSchema.parse((req.params as { id: string }).id);
    const b = await app.prisma.book.findUnique({ where: { id } });
    if (!b || b.deletedAt) throw new NotFoundError('book');
    if (b.ownerId !== req.user.id) throw new ForbiddenError();
    await app.prisma.book.update({ where: { id }, data: { deletedAt: new Date() } });
    // Best-effort: drop the object too.
    try {
      const storage = await getStorage();
      await storage.deleteObject(b.fileKey);
    } catch {
      /* tolerated */
    }
    return reply.code(204).send();
  });

  /** POST /books/:id/report */
  app.post('/:id/report', async (req, reply) => {
    const id = uuidSchema.parse((req.params as { id: string }).id);
    const input = createReportSchema.parse(req.body);
    const b = await app.prisma.book.findUnique({ where: { id } });
    if (!b || b.deletedAt || b.visibility !== 'public') throw new NotFoundError('book');
    const report = await app.prisma.report.create({
      data: {
        reporterId: req.user.id,
        bookId: id,
        reason: input.reason,
        detail: input.detail ?? null,
      },
    });
    await writeAudit(app.prisma, {
      actorId: req.user.id,
      action: 'book.report',
      targetType: 'Book',
      targetId: id,
      diff: { reason: input.reason },
      req,
    });
    return reply.code(201).send({ id: report.id, status: report.status });
  });
}
