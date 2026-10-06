import { execSync } from 'child_process';
import { config } from 'dotenv';
import { Pool } from 'pg';

// Load .env.local
config({ path: '.env.local' });

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (!TEST_DATABASE_URL) {
  console.error('TEST_DATABASE_URL not set in .env.local');
  process.exit(1);
}

console.log('Migrating test database...');
try {
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'inherit',
  });
  console.log('✓ Test database migrations applied');
} catch (error) {
  console.error('✗ Failed to migrate test database:', error.message);
  process.exit(1);
}

console.log('Seeding test database...');
try {
  execSync('npx tsx prisma/seed.ts', {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'inherit',
  });
  console.log('✓ Test database seeded');
} catch (error) {
  console.error('✗ Failed to seed test database:', error.message);
  process.exit(1);
}

// Run permly setup
console.log('Setting up permly...');
try {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL });

  // Import permly after env is set
  const { createPermissions } = await import('permly');
  const { postgresAdapter } = await import('permly/postgres');

  const perms = createPermissions({
    adapter: postgresAdapter(pool, { schema: 'permly' }),
    permissions: [
      'project.create', 'project.delete', 'project.update',
      'board.create', 'board.update', 'board.delete',
      'column.manage',
      'task.create', 'task.update', 'task.move', 'task.delete', 'task.delete.own',
      'comment.create', 'comment.delete.any',
      'attachment.upload', 'attachment.delete.any',
      'label.manage',
      'member.manage',
      'role.manage', 'user.manage',
      'report.view.all',
    ],
    roles: ['admin', 'manager', 'member', 'viewer'],
  });

  const { createdRoles } = await perms.sync();

  if (createdRoles.length > 0) {
    await perms.role('admin').givePermission('*');
    await perms.role('manager').givePermission(
      'project.update', 'member.manage', 'task.create', 'task.update',
      'task.move', 'task.delete', 'comment.create', 'comment.update',
      'comment.delete', 'attachment.upload', 'attachment.delete', 'label.manage'
    );
    await perms.role('member').givePermission(
      'task.create', 'task.update', 'task.move', 'comment.create', 'attachment.upload'
    );
  }

  await pool.end();
  console.log('✓ Permly setup complete');
} catch (error) {
  console.error('✗ Failed to setup permly:', error.message);
  process.exit(1);
}
