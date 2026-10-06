import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/server/lib/prisma';

let adminId: string;
let viewerId: string;

beforeAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: ['admin@example.com', 'viewer@example.com'] } },
  });
  adminId = users.find((u) => u.email === 'admin@example.com')!.id;
  viewerId = users.find((u) => u.email === 'viewer@example.com')!.id;
});

describe('Roles API', () => {
  it('GET /api/roles returns list of built-in roles', async () => {
    const response = await fetch('http://localhost:3000/api/roles', {
      headers: { 'x-user-id': adminId },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.roles)).toBe(true);
    expect(data.roles.length).toBeGreaterThan(0);
    const adminRole = data.roles.find((r: any) => r.id === 'admin');
    expect(adminRole).toBeDefined();
    expect(adminRole).toHaveProperty('id');
    expect(adminRole).toHaveProperty('name');
    expect(adminRole).toHaveProperty('permissionKeys');
    expect(adminRole).toHaveProperty('userCount');
  });

  it('Non-signed-in user cannot access roles', async () => {
    const response = await fetch('http://localhost:3000/api/roles');
    expect(response.status).toBe(401);
  });

  it('Admin role has all administrative permissions', async () => {
    const response = await fetch('http://localhost:3000/api/roles', {
      headers: { 'x-user-id': adminId },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    const adminRole = data.roles.find((r: any) => r.id === 'admin');
    expect(adminRole.permissionKeys).toContain('role.manage');
    expect(adminRole.permissionKeys).toContain('user.manage');
    expect(adminRole.permissionKeys).toContain('report.view.all');
  });

  it('PATCH /api/roles/:roleId can update role permissions', async () => {
    // Update member role to have task.delete
    const response = await fetch('http://localhost:3000/api/roles/member', {
      method: 'PATCH',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        permissionKeys: ['task.create', 'task.update', 'task.move', 'task.delete', 'comment.create', 'attachment.upload'],
      }),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.role.permissionKeys).toContain('task.delete');

    // Restore member role to its original permissions for test isolation
    const restoreRes = await fetch('http://localhost:3000/api/roles/member', {
      method: 'PATCH',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        permissionKeys: ['task.create', 'task.update', 'task.move', 'task.delete.own', 'comment.create', 'attachment.upload'],
      }),
    });
    expect(restoreRes.status).toBe(200);
  });

  it('Cannot update role without role.manage permission', async () => {
    const response = await fetch('http://localhost:3000/api/roles/member', {
      method: 'PATCH',
      headers: { 'x-user-id': viewerId, 'content-type': 'application/json' },
      body: JSON.stringify({
        permissionKeys: ['task.create'],
      }),
    });
    expect(response.status).toBe(403);
  });

  it('Admin role deletion is protected', async () => {
    const response = await fetch('http://localhost:3000/api/roles/admin', {
      method: 'DELETE',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    // Should fail with either 400 or 409 depending on implementation
    expect([400, 409]).toContain(response.status);
  });

  it('POST /api/roles creates custom role with permissions', async () => {
    const timestamp = Date.now();
    const response = await fetch('http://localhost:3000/api/roles', {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `custom-role-${timestamp}`,
        permissionKeys: ['task.create', 'task.update'],
      }),
    });
    if (response.status !== 201) {
      const errorData = await response.json();
      console.error('POST /api/roles error:', errorData);
    }
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.role).toBeDefined();
    expect(data.role.name).toBe(`custom-role-${timestamp}`);
    expect(data.role.permissionKeys).toContain('task.create');
    expect(data.role.permissionKeys).toContain('task.update');
  });

  it('POST /api/roles with single permission creates role with only that access', async () => {
    const timestamp = Date.now();
    const response = await fetch('http://localhost:3000/api/roles', {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `single-perm-${timestamp}`,
        permissionKeys: ['comment.create'],
      }),
    });
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.role.permissionKeys).toEqual(['comment.create']);
    expect(data.role.permissionKeys).not.toContain('task.create');
  });

  it('POST /api/roles rejects invalid permission keys', async () => {
    const timestamp = Date.now();
    const response = await fetch('http://localhost:3000/api/roles', {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `Invalid Perm Role ${timestamp}`,
        permissionKeys: ['invalid.permission', 'task.create'],
      }),
    });
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('POST /api/roles rejects duplicate permission keys', async () => {
    const timestamp = Date.now();
    const response = await fetch('http://localhost:3000/api/roles', {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `Duplicate Perm Role ${timestamp}`,
        permissionKeys: ['task.create', 'task.create'],
      }),
    });
    expect(response.status).toBe(400);
  });

  it('User without role.manage cannot create roles', async () => {
    const timestamp = Date.now();
    const response = await fetch('http://localhost:3000/api/roles', {
      method: 'POST',
      headers: { 'x-user-id': viewerId, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `Unauthorized Role ${timestamp}`,
        permissionKeys: ['task.create'],
      }),
    });
    expect(response.status).toBe(403);
  });

  it('Custom role with task.create only allows creating tasks, rejects updates', async () => {
    const timestamp = Date.now();
    const customRoleName = `custom-task-creator-${timestamp}`;

    // Create a custom role with only task.create
    const createRoleRes = await fetch('http://localhost:3000/api/roles', {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: customRoleName,
        permissionKeys: ['task.create'],
      }),
    });
    expect(createRoleRes.status).toBe(201);

    // Create a new user
    const createUserRes = await fetch('http://localhost:3000/api/users', {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `Test User ${timestamp}`,
        email: `test-${timestamp}@example.com`,
        roleIds: [customRoleName],
      }),
    });
    expect(createUserRes.status).toBe(201);
    const newUser = (await createUserRes.json()).user;

    // Verify user can create tasks (has task.create permission)
    const meRes = await fetch('http://localhost:3000/api/me', {
      headers: { 'x-user-id': newUser.id },
    });
    expect(meRes.status).toBe(200);
    const meData = await meRes.json();
    expect(meData.permissions).toContain('task.create');
    expect(meData.permissions).not.toContain('task.update');
  });
});
