import { randomUUID } from 'node:crypto';

import { type FastifyInstance } from 'fastify';

import { ForbiddenError, NotFoundError } from '../../errors.js';
import { writeAudit } from '../../lib/audit.js';
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

  /** POST /books/upload-url — return a pre-signed PUT URL. Stub in dev. */
  app.post('/upload-url', async (req) => {
    const input = uploadUrlInputSchema.parse(req.body);
    const bookId = randomUUID();
    const fileKey = `users/${req.user.id}/books/${bookId}.${input.format}`;
    const expires = new Date(Date.now() + 15 * 60_000);
    // In dev, return a placeholder URL. The real implementation issues
    // a signed S3 PUT URL.
    const uploadUrl = `http://localhost:9000/${process.env.S3_BUCKET_FILES ?? 'books-files'}/${fileKey}`;
    return {
      bookId,
      fileKey,
      uploadUrl,
      expiresAt: expires.toISOString(),
      maxBytes: 50 * 1024 * 1024,
    };
  });

  /** POST /books — register a book after the upload completes. */
  app.post('/', async (req, reply) => {
    const input = registerBookSchema.parse(req.body);
    const book = await app.prisma.book.create({
      data: {
        id: input.bookId,
        ownerId: req.user.id,
        title: input.title,
        author: input.author ?? null,
        description: input.description ?? null,
        fileKey: `users/${req.user.id}/books/${input.bookId}.pdf`,
        format: 'pdf',
        sizeBytes: BigInt(0),
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
        // private → pending_review only
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
