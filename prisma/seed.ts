import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createPermissions } from 'permly';
import { postgresAdapter } from 'permly/postgres';
import { hashPassword } from '@better-auth/utils/password';

loadEnv({ path: '.env.local' });
loadEnv();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error('DATABASE_URL is required');

const pool = new Pool({ connectionString: dbUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEV_PASSWORD = 'development123';

async function main() {
  // Hash the development password using Better Auth's own password hashing
  const hashedPassword = await hashPassword(DEV_PASSWORD);

  // Create test users
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
    await prisma.account.upsert({
      where: { provider_providerAccountId: { provider: 'credential', providerAccountId: user.email } },
      update: { password: hashedPassword },
      create: {
        userId: user.id,
        type: 'credentials',
        provider: 'credential',
        providerAccountId: user.email,
        password: hashedPassword,
      },
    });
  }

  console.log('Users created:');
  console.log(`  Admin: ${admin.id}`);
  console.log(`  Manager: ${manager.id}`);
  console.log(`  Member: ${member.id}`);
  console.log(`  Viewer: ${viewer.id}`);
  console.log(`  Developer: ${developer.id}`);
  console.log(`  QA: ${qa.id}`);
  console.log(`  Deployment: ${deployment.id}`);
  console.log(`\nDevelopment password for all users: ${DEV_PASSWORD}`);

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
      'task.delete.own',
      'comment.create',
      'comment.delete.any',
      'attachment.upload',
      'attachment.delete.any',
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
      isOpen: true,
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

  // Clean up any existing tasks in the demo project for idempotency
  await prisma.task.deleteMany({
    where: { projectId: project.id },
  });

  // Reset task counter
  await prisma.project.update({
    where: { id: project.id },
    data: { taskCounter: 0 },
  });

  // Create demo labels
  const labelData = [
    { name: 'Bug', color: '#FF6B6B' },
    { name: 'Feature', color: '#4ECDC4' },
    { name: 'Enhancement', color: '#45B7D1' },
    { name: 'Documentation', color: '#FFA07A' },
    { name: 'High Priority', color: '#FFD93D' },
  ];

  const labels: Record<string, string> = {};
  for (const label of labelData) {
    const created = await prisma.label.upsert({
      where: { projectId_name: { projectId: project.id, name: label.name } },
      update: {},
      create: { projectId: project.id, name: label.name, color: label.color },
    });
    labels[label.name] = created.id;
  }

  // Get columns for task creation
  const columns = await prisma.boardColumn.findMany({
    where: { boardId: board.id },
    orderBy: { position: 'asc' },
  });

  // Demo task data - spread across 30 days and columns
  const now = new Date();
  const taskSpecs = [
    // To Do column tasks
    { title: 'Setup authentication system', priority: 'HIGH', assignee: developer.id, labels: ['Feature'], daysAgo: 28, columnIndex: 0 },
    { title: 'Design database schema', priority: 'URGENT', assignee: developer.id, labels: ['Feature', 'Documentation'], daysAgo: 25, columnIndex: 0 },
    { title: 'Create API endpoints', priority: 'HIGH', assignee: developer.id, labels: ['Feature'], daysAgo: 20, columnIndex: 0 },
    { title: 'Write unit tests for auth', priority: 'MEDIUM', assignee: developer.id, labels: [], daysAgo: 18, columnIndex: 0 },
    { title: 'Add error handling', priority: 'MEDIUM', assignee: developer.id, labels: ['Enhancement'], daysAgo: 15, columnIndex: 0 },

    // In Progress column tasks
    { title: 'Implement user roles', priority: 'HIGH', assignee: developer.id, labels: ['Feature'], daysAgo: 12, columnIndex: 1 },
    { title: 'Add logging system', priority: 'MEDIUM', assignee: developer.id, labels: ['Enhancement'], daysAgo: 10, columnIndex: 1 },
    { title: 'Refactor API routes', priority: 'MEDIUM', assignee: developer.id, labels: [], daysAgo: 8, columnIndex: 1 },

    // Ready for QA column tasks
    { title: 'Test login flow', priority: 'HIGH', assignee: qa.id, labels: [], daysAgo: 6, columnIndex: 2 },
    { title: 'Verify database migrations', priority: 'MEDIUM', assignee: qa.id, labels: [], daysAgo: 5, columnIndex: 2 },
    { title: 'Test error messages', priority: 'LOW', assignee: qa.id, labels: [], daysAgo: 4, columnIndex: 2 },

    // Ready for Prod column tasks
    { title: 'Performance testing', priority: 'HIGH', assignee: qa.id, labels: ['High Priority'], daysAgo: 3, columnIndex: 3 },
    { title: 'Security audit', priority: 'URGENT', assignee: deployment.id, labels: ['High Priority'], daysAgo: 2, columnIndex: 3 },

    // In Production column tasks
    { title: 'Monitor prod logs', priority: 'MEDIUM', assignee: deployment.id, labels: [], daysAgo: 1, columnIndex: 4 },
    { title: 'Fix critical issue in production', priority: 'URGENT', assignee: developer.id, labels: ['Bug', 'High Priority'], daysAgo: 1, columnIndex: 4 },

    // Done column tasks - completed
    { title: 'Initialize git repository', priority: 'LOW', assignee: developer.id, labels: [], daysAgo: 30, columnIndex: 5, completedDaysAgo: 28 },
    { title: 'Setup development environment', priority: 'MEDIUM', assignee: manager.id, labels: ['Documentation'], daysAgo: 27, columnIndex: 5, completedDaysAgo: 24 },
    { title: 'Create project documentation', priority: 'LOW', assignee: manager.id, labels: ['Documentation'], daysAgo: 22, columnIndex: 5, completedDaysAgo: 19 },
    { title: 'Design API structure', priority: 'HIGH', assignee: developer.id, labels: ['Feature'], daysAgo: 19, columnIndex: 5, completedDaysAgo: 16 },
    { title: 'Implement basic CRUD', priority: 'HIGH', assignee: developer.id, labels: ['Feature'], daysAgo: 16, columnIndex: 5, completedDaysAgo: 13 },
    { title: 'Add data validation', priority: 'MEDIUM', assignee: developer.id, labels: ['Enhancement'], daysAgo: 13, columnIndex: 5, completedDaysAgo: 11 },
    { title: 'Create admin panel', priority: 'MEDIUM', assignee: developer.id, labels: ['Feature'], daysAgo: 11, columnIndex: 5, completedDaysAgo: 8 },
    { title: 'Setup CI/CD pipeline', priority: 'HIGH', assignee: deployment.id, labels: ['Enhancement'], daysAgo: 9, columnIndex: 5, completedDaysAgo: 6 },

    // Additional open tasks for more data
    { title: 'Implement caching layer', priority: 'MEDIUM', assignee: developer.id, labels: ['Enhancement'], daysAgo: 5, columnIndex: 2 },
    { title: 'Write API documentation', priority: 'LOW', assignee: manager.id, labels: ['Documentation'], daysAgo: 4, columnIndex: 1 },
    { title: 'Setup monitoring alerts', priority: 'HIGH', assignee: deployment.id, labels: ['Enhancement'], daysAgo: 3, columnIndex: 3 },
  ];

  // Create tasks and stage entries
  let taskCounter = 0;
  const projectUpdated = await prisma.project.update({
    where: { id: project.id },
    data: { taskCounter: taskSpecs.length },
  });

  for (const spec of taskSpecs) {
    taskCounter++;
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() - spec.daysAgo + 7); // Set due date 7 days ahead of creation

    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        boardId: board.id,
        columnId: columns[spec.columnIndex].id,
        number: taskCounter,
        title: spec.title,
        priority: spec.priority,
        assigneeId: spec.assignee,
        reporterId: manager.id,
        dueDate: dueDate,
        position: 0,
        completedAt: spec.completedDaysAgo
          ? new Date(now.getTime() - spec.completedDaysAgo * 24 * 60 * 60 * 1000)
          : null,
      },
    });

    // Add labels
    for (const labelName of spec.labels) {
      await prisma.taskLabel.create({
        data: {
          taskId: task.id,
          labelId: labels[labelName],
        },
      });
    }

    // Create stage history entries going back through previous columns
    const columnSequence = [];
    let currentTime = new Date(now.getTime() - spec.daysAgo * 24 * 60 * 60 * 1000);

    if (spec.columnIndex > 0) {
      // Task moved through columns
      for (let i = 0; i < spec.columnIndex; i++) {
        columnSequence.push({
          column: columns[i],
          enteredTime: currentTime,
          duration: Math.floor(Math.random() * 2 * 24 * 60 * 60) + 12 * 60 * 60, // 12h to 2d
        });
        currentTime = new Date(currentTime.getTime() + columnSequence[i].duration * 1000);
      }
    }

    // Create stage entries for previous columns
    for (const seq of columnSequence) {
      const leftTime = new Date(seq.enteredTime.getTime() + seq.duration * 1000);
      const mover = [developer, qa, deployment][Math.floor(Math.random() * 3)];

      await (prisma as any).taskStageEntry.create({
        data: {
          taskId: task.id,
          columnId: seq.column.id,
          enteredAt: seq.enteredTime,
          enteredById: mover.id,
          leftAt: leftTime,
          leftById: mover.id,
          durationSeconds: seq.duration,
          assigneeAtEntry: spec.assignee,
        },
      });
    }

    // Create current stage entry
    await (prisma as any).taskStageEntry.create({
      data: {
        taskId: task.id,
        columnId: columns[spec.columnIndex].id,
        enteredAt: currentTime,
        enteredById: manager.id,
        leftAt: spec.completedDaysAgo
          ? new Date(now.getTime() - spec.completedDaysAgo * 24 * 60 * 60 * 1000)
          : null,
        leftById: spec.completedDaysAgo ? manager.id : null,
        durationSeconds: spec.completedDaysAgo
          ? Math.floor((new Date(now.getTime() - spec.completedDaysAgo * 24 * 60 * 60 * 1000).getTime() - currentTime.getTime()) / 1000)
          : null,
        assigneeAtEntry: spec.assignee,
      },
    });
  }

  console.log(`Created ${taskCounter} demo tasks with labels and stage history`);
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
