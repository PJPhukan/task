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
});
