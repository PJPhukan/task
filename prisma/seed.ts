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

  const developer = await prisma.user.upsert({
    where: { email: 'developer@example.com' },
    update: {},
    create: {
      name: 'Developer User',
      email: 'developer@example.com',
      isActive: true,
    },
  });

  const qa = await prisma.user.upsert({
    where: { email: 'qa@example.com' },
    update: {},
    create: {
      name: 'QA User',
      email: 'qa@example.com',
      isActive: true,
    },
  });

  const deployment = await prisma.user.upsert({
    where: { email: 'deployment@example.com' },
    update: {},
    create: {
      name: 'Deployment User',
      email: 'deployment@example.com',
      isActive: true,
    },
  });

  console.log('Users created:');
  console.log(`  Admin: ${admin.id}`);
  console.log(`  Manager: ${manager.id}`);
  console.log(`  Member: ${member.id}`);
  console.log(`  Viewer: ${viewer.id}`);
  console.log(`  Developer: ${developer.id}`);
  console.log(`  QA: ${qa.id}`);
  console.log(`  Deployment: ${deployment.id}`);

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
    roles: ['admin', 'manager', 'member', 'viewer', 'developer', 'qa', 'deployment'],
  });

  await perms.sync();

  // Assign roles
  await perms.user(admin.id).assignRole('admin');
  await perms.user(manager.id).assignRole('manager');
  await perms.user(member.id).assignRole('member');
  await perms.user(viewer.id).assignRole('viewer');
  await perms.user(developer.id).assignRole('developer');
  await perms.user(qa.id).assignRole('qa');
  await perms.user(deployment.id).assignRole('deployment');

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

  // Developer, QA, Deployment roles for demo board
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

  console.log('Permissions granted');

  // Create demo project
  const project = await prisma.project.upsert({
    where: { key: 'DEMO' },
    update: {},
    create: {
      name: 'Demo Project',
      key: 'DEMO',
      description: 'Demo project with column access rules',
    },
  });

  // Add all seeded users as project members
  const projectMembers = [admin.id, manager.id, member.id, viewer.id, developer.id, qa.id, deployment.id];
  for (const userId of projectMembers) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId } },
      update: {},
      create: { projectId: project.id, userId },
    });
  }

  console.log(`Demo project created: ${project.id}`);

  // Create Development board
  const board = await prisma.board.upsert({
    where: { id: `demo-board-${project.id}` },
    update: {},
    create: {
      id: `demo-board-${project.id}`,
      projectId: project.id,
      name: 'Development',
      position: 0,
      createdById: admin.id,
      isOpen: false,
    } as any,
  });

  // Create columns with MOVE rules
  const columnNames = [
    { name: 'To Do', moveRole: 'developer' },
    { name: 'In Progress', moveRole: 'developer' },
    { name: 'Ready for QA', moveRole: 'qa' },
    { name: 'Ready for Prod', moveRole: 'deployment' },
    { name: 'In Production', moveRole: 'qa' },
    { name: 'Done', moveRole: null, isDone: true },
  ];

  let position = 0;
  for (const col of columnNames) {
    const column = await prisma.boardColumn.upsert({
      where: { id: `demo-col-${board.id}-${position}` },
      update: {},
      create: {
        id: `demo-col-${board.id}-${position}`,
        boardId: board.id,
        name: col.name,
        position,
        isDone: col.isDone || false,
      },
    });

    // Add MOVE rules if applicable
    if (col.moveRole) {
      await (prisma as any).columnRule.upsert({
        where: {
          columnId_ruleType_roleId: {
            columnId: column.id,
            ruleType: 'move',
            roleId: col.moveRole,
          },
        },
        update: {},
        create: {
          columnId: column.id,
          ruleType: 'move',
          roleId: col.moveRole,
        },
      });
    }

    position++;
  }

  // Grant restricted board access to all members
  for (const userId of projectMembers) {
    await (prisma as any).boardAccess.upsert({
      where: { boardId_userId: { boardId: board.id, userId } },
      update: {},
      create: {
        boardId: board.id,
        userId,
      },
    });
  }

  console.log(`Demo board created: ${board.id} with column access rules`);
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
