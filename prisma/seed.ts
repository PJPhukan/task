import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createPermissions } from 'permly';
import { postgresAdapter } from 'permly/postgres';

loadEnv({ path: '.env.local' });
loadEnv();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error('DATABASE_URL is required');

const pool = new Pool({ connectionString: dbUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create test users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@example.com',
      isActive: true,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@example.com' },
    update: {},
    create: {
      name: 'Manager User',
      email: 'manager@example.com',
      isActive: true,
    },
  });

  const member = await prisma.user.upsert({
    where: { email: 'member@example.com' },
    update: {},
    create: {
      name: 'Member User',
      email: 'member@example.com',
      isActive: true,
    },
  });

  const viewer = await prisma.user.upsert({
    where: { email: 'viewer@example.com' },
    update: {},
    create: {
      name: 'Viewer User',
      email: 'viewer@example.com',
      isActive: true,
    },
  });

  console.log('Users created:');
  console.log(`  Admin: ${admin.id}`);
  console.log(`  Manager: ${manager.id}`);
  console.log(`  Member: ${member.id}`);
  console.log(`  Viewer: ${viewer.id}`);

  // Setup permly
  const perms = createPermissions({
    adapter: postgresAdapter(pool, { schema: 'permly' }),
    permissions: [
      'project.create',
      'project.delete',
      'project.update',
      'board.create',
      'board.update',
      'board.delete',
      'column.manage',
      'task.create',
      'task.update',
      'task.move',
      'task.delete',
      'comment.create',
      'comment.update',
      'comment.delete',
      'attachment.upload',
      'attachment.delete',
      'label.manage',
      'member.manage',
      'role.manage',
      'user.manage',
      'report.view.all',
    ],
    roles: ['admin', 'manager', 'member', 'viewer'],
  });

  await perms.sync();

  // Assign roles
  await perms.user(admin.id).assignRole('admin');
  await perms.user(manager.id).assignRole('manager');
  await perms.user(member.id).assignRole('member');
  await perms.user(viewer.id).assignRole('viewer');

  console.log('Roles assigned');

  // Grant permissions to roles (regardless of whether roles are newly created)
  await perms.role('admin').givePermission('*');
  await perms.role('manager').syncPermissions([
    'project.update',
    'member.manage',
    'task.create',
    'task.update',
    'task.move',
    'task.delete',
    'comment.create',
    'comment.update',
    'comment.delete',
    'attachment.upload',
    'attachment.delete',
    'label.manage',
  ]);
  await perms.role('member').syncPermissions([
    'task.create',
    'task.update',
    'task.move',
    'comment.create',
    'attachment.upload',
  ]);
  // viewer role has no permissions (read-only)

  console.log('Permissions granted');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
