/**
 * Deterministic seed: 1 super_admin + 1 admin + 1 moderator + 2 users,
 * 9 categories, 5 books, 7 days of completions for Alice.
 *
 * Run: `pnpm db:seed`
 */
import { PrismaClient, Role, TaskCategory } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `cred:scrypt:${salt.toString('base64')}:${derived.toString('base64')}`;
}

const CATEGORIES = [
  { name: 'Self-help', slug: 'self-help', icon: 'lightbulb', orderIndex: 0 },
  { name: 'Productivity', slug: 'productivity', icon: 'target', orderIndex: 1 },
  { name: 'Fiction', slug: 'fiction', icon: 'feather', orderIndex: 2 },
  { name: 'Non-fiction', slug: 'non-fiction', icon: 'book', orderIndex: 3 },
  { name: 'Study / Reference', slug: 'study', icon: 'graduation-cap', orderIndex: 4 },
  { name: 'Health & Fitness', slug: 'health', icon: 'heart', orderIndex: 5 },
  { name: 'Spirituality', slug: 'spirituality', icon: 'sun', orderIndex: 6 },
  { name: 'Children', slug: 'children', icon: 'smile', orderIndex: 7 },
  { name: 'Other', slug: 'other', icon: 'folder', orderIndex: 8 },
];

async function main() {
  // Categories
  for (const cat of CATEGORIES) {
    await prisma.bookCategory.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    });
  }

  // Users
  const users = [
    { email: 'super@example.com', name: 'Super Admin', role: Role.super_admin, pw: 'password123' },
    { email: 'admin@example.com', name: 'Admin User', role: Role.admin, pw: 'password123' },
    { email: 'mod@example.com', name: 'Mod User', role: Role.moderator, pw: 'password123' },
    { email: 'alice@example.com', name: 'Alice', role: Role.user, pw: 'password123' },
    { email: 'bob@example.com', name: 'Bob', role: Role.user, pw: 'password123' },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        timezone: 'UTC',
        locale: 'en',
        avatarUrl: hashPassword(u.pw),
        streak: { create: {} },
      },
    });
  }

  const alice = await prisma.user.findUniqueOrThrow({ where: { email: 'alice@example.com' } });

  // Idempotent task seeding: skip if Alice already has tasks
  const existingTasks = await prisma.task.count({ where: { userId: alice.id, deletedAt: null } });
  if (existingTasks === 0) {
    await prisma.task.createMany({
      data: [
        {
          userId: alice.id,
          title: 'Morning meditation',
          category: TaskCategory.morning,
          time: '06:30',
          repeatDays: [0, 1, 2, 3, 4, 5, 6],
          remindEnabled: true,
          orderIndex: 100,
        },
        {
          userId: alice.id,
          title: 'Read for 30 minutes',
          category: TaskCategory.reading,
          time: '07:30',
          repeatDays: [0, 1, 2, 3, 4, 5, 6],
          remindEnabled: true,
          orderIndex: 200,
        },
        {
          userId: alice.id,
          title: 'Workout',
          category: TaskCategory.health,
          time: '17:00',
          repeatDays: [1, 3, 5],
          remindEnabled: true,
          orderIndex: 300,
        },
        {
          userId: alice.id,
          title: 'Plan tomorrow',
          category: TaskCategory.evening,
          time: '21:30',
          repeatDays: [0, 1, 2, 3, 4],
          remindEnabled: true,
          orderIndex: 400,
        },
      ],
    });
  }

  // 7 days of completions for Alice's first task
  const firstTask = await prisma.task.findFirstOrThrow({
    where: { userId: alice.id, deletedAt: null },
    orderBy: { orderIndex: 'asc' },
  });

  const today = new Date();
  for (let d = 0; d < 7; d++) {
    const day = new Date(today.getTime() - d * 86_400_000);
    const ymd = day.toISOString().slice(0, 10);
    try {
      await prisma.completion.create({
        data: {
          taskId: firstTask.id,
          userId: alice.id,
          completedAt: new Date(`${ymd}T00:00:00Z`),
          skipped: false,
        },
      });
    } catch {
      /* already seeded that day */
    }
  }

  // Streak reflecting the 7-day run
  await prisma.streak.update({
    where: { userId: alice.id },
    data: { currentStreak: 7, longestStreak: 7, lastCompletedDate: today },
  });

  // Sample books
  await prisma.book.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      ownerId: alice.id,
      title: 'Atomic Habits',
      author: 'James Clear',
      description: 'Tiny changes, remarkable results.',
      fileKey: 'seed/atomic-habits.pdf',
      format: 'pdf',
      sizeBytes: BigInt(4_280_193),
      pageCount: 320,
      visibility: 'public',
      tags: ['productivity', 'habits'],
      rightsAcceptedAt: new Date(),
    },
  });

  await prisma.book.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      ownerId: alice.id,
      title: 'Deep Work',
      author: 'Cal Newport',
      fileKey: 'seed/deep-work.pdf',
      format: 'pdf',
      sizeBytes: BigInt(3_142_857),
      pageCount: 304,
      visibility: 'pending_review',
      tags: ['focus', 'productivity'],
    },
  });

  // eslint-disable-next-line no-console
  console.warn('Seed complete.');
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
