import prisma from '@/server/lib/prisma';
import { getPerms, setupPermissions } from '@/server/lib/permly';
import { hashPassword } from '@better-auth/utils/password';

const DEV_PASSWORD = 'development123';

const SEEDED_EMAILS = [
  'admin@example.com',
  'manager@example.com',
  'member@example.com',
  'viewer@example.com',
  'developer@example.com',
  'qa@example.com',
  'deployment@example.com',
];

export async function reseedDatabase() {
  const hashedPassword = await hashPassword(DEV_PASSWORD);

  // Upsert seeded users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { name: 'Admin User', emailVerified: true, status: 'ACTIVE', isActive: true },
    create: {
      name: 'Admin User',
      email: 'admin@example.com',
      emailVerified: true,
      status: 'ACTIVE',
      isActive: true,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@example.com' },
    update: { name: 'Manager User', emailVerified: true, status: 'ACTIVE', isActive: true },
    create: {
      name: 'Manager User',
      email: 'manager@example.com',
      emailVerified: true,
      status: 'ACTIVE',
      isActive: true,
    },
  });

  const member = await prisma.user.upsert({
    where: { email: 'member@example.com' },
    update: { name: 'Member User', emailVerified: true, status: 'ACTIVE', isActive: true },
    create: {
      name: 'Member User',
      email: 'member@example.com',
      emailVerified: true,
      status: 'ACTIVE',
      isActive: true,
    },
  });

  const viewer = await prisma.user.upsert({
    where: { email: 'viewer@example.com' },
    update: { name: 'Viewer User', emailVerified: true, status: 'ACTIVE', isActive: true },
    create: {
      name: 'Viewer User',
      email: 'viewer@example.com',
      emailVerified: true,
      status: 'ACTIVE',
      isActive: true,
    },
  });

  const developer = await prisma.user.upsert({
    where: { email: 'developer@example.com' },
    update: { name: 'Developer User', emailVerified: true, status: 'ACTIVE', isActive: true },
    create: {
      name: 'Developer User',
      email: 'developer@example.com',
      emailVerified: true,
      status: 'ACTIVE',
      isActive: true,
    },
  });

  const qa = await prisma.user.upsert({
    where: { email: 'qa@example.com' },
    update: { name: 'QA User', emailVerified: true, status: 'ACTIVE', isActive: true },
    create: {
      name: 'QA User',
      email: 'qa@example.com',
      emailVerified: true,
      status: 'ACTIVE',
      isActive: true,
    },
  });

  const deployment = await prisma.user.upsert({
    where: { email: 'deployment@example.com' },
    update: { name: 'Deployment User', emailVerified: true, status: 'ACTIVE', isActive: true },
    create: {
      name: 'Deployment User',
      email: 'deployment@example.com',
      emailVerified: true,
      status: 'ACTIVE',
      isActive: true,
    },
  });

  // Create Better Auth credentials for each user
  const users = [admin, manager, member, viewer, developer, qa, deployment];
  for (const user of users) {
    await prisma.account.deleteMany({ where: { userId: user.id } });
    await prisma.account.create({
      data: {
        userId: user.id,
        providerId: 'credential',
        accountId: user.id,
        password: hashedPassword,
      },
    });
  }

  // Setup permissions
  await setupPermissions();
  const perms = getPerms();

  // Assign roles
  await perms.user(admin.id).assignRole('admin');
  await perms.user(manager.id).assignRole('manager');
  await perms.user(member.id).assignRole('member');
  await perms.user(viewer.id).assignRole('viewer');
  await perms.user(developer.id).assignRole('developer');
  await perms.user(qa.id).assignRole('qa');
  await perms.user(deployment.id).assignRole('deployment');

  // Grant permissions to roles
  await perms.role('admin').givePermission('*');
  await perms.role('manager').syncPermissions([
    'project.update',
    'member.manage',
    'task.create',
    'task.update',
    'task.move',
    'task.delete',
    'comment.create',
    'comment.delete.any',
    'attachment.upload',
    'attachment.delete.any',
    'label.manage',
  ]);
  await perms.role('member').syncPermissions([
    'task.create',
    'task.update',
    'task.move',
    'task.delete.own',
    'comment.create',
    'attachment.upload',
  ]);
  await perms.role('developer').syncPermissions([
    'task.create',
    'task.update',
    'task.move',
    'comment.create',
    'attachment.upload',
  ]);
  await perms.role('qa').syncPermissions([
    'task.create',
    'task.update',
    'task.move',
    'comment.create',
    'attachment.upload',
  ]);
  await perms.role('deployment').syncPermissions([
    'task.update',
    'task.move',
    'comment.create',
    'attachment.upload',
  ]);
}

export async function cleanupNonSeededUsers() {
  const nonSeeded = await prisma.user.findMany({
    where: { NOT: { email: { in: SEEDED_EMAILS } } },
    select: { id: true },
  });

  if (nonSeeded.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: nonSeeded.map(u => u.id) } },
    });
  }
}
