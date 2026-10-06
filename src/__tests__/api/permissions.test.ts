import { describe, it, expect, beforeAll } from 'vitest';
import { Pool } from 'pg';
import { createPermissions } from 'permly';
import { postgresAdapter } from 'permly/postgres';

const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl) throw new Error('TEST_DATABASE_URL or DATABASE_URL required');

let managerId: string;
let memberId: string;

beforeAll(async () => {
  const pool = new Pool({ connectionString: dbUrl });
  const result = await pool.query(
    'SELECT id, "name" FROM "User" WHERE email IN ($1, $2)',
    ['manager@example.com', 'member@example.com']
  );
  pool.end();

  const manager = result.rows.find((r) => r.name === 'Manager User');
  const member = result.rows.find((r) => r.name === 'Member User');

  if (!manager || !member) {
    throw new Error('Manager or Member user not found in database');
  }

  managerId = manager.id;
  memberId = member.id;
});

describe('Permly wildcard permissions', () => {
  it('Manager role can delete tasks via task.* wildcard', async () => {
    const pool = new Pool({ connectionString: dbUrl });
    const perms = createPermissions({
      adapter: postgresAdapter(pool, { schema: 'permly' }),
      permissions: ['task.create', 'task.update', 'task.move', 'task.delete'],
      roles: ['manager', 'member'],
    });

    await perms.sync();
    const canDelete = await perms.user(managerId).can('task.delete');
    expect(canDelete).toBe(true);
    pool.end();
  });

  it('Member role cannot delete tasks (only create, update, move)', async () => {
    const pool = new Pool({ connectionString: dbUrl });
    const perms = createPermissions({
      adapter: postgresAdapter(pool, { schema: 'permly' }),
      permissions: ['task.create', 'task.update', 'task.move', 'task.delete'],
      roles: ['manager', 'member'],
    });

    await perms.sync();
    const canDelete = await perms.user(memberId).can('task.delete');
    expect(canDelete).toBe(false);
    pool.end();
  });
});
