import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getRolesRoute, POST as createRoleRoute } from '@/app/api/roles/route';
import { PATCH as updateRoleRoute, DELETE as deleteRoleRoute } from '@/app/api/roles/[roleId]/route';
import { GET as getMeRoute } from '@/app/api/me/route';
import { POST as createUserRoute } from '@/app/api/users/route';
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
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest('http://localhost:3000/api/roles', { method: 'GET', headers });
    const response = await getRolesRoute(req);
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
    const headers = new Headers();
    const req = new NextRequest('http://localhost:3000/api/roles', { method: 'GET', headers });
    const response = await getRolesRoute(req);
    expect(response.status).toBe(401);
  });

  it('Admin role has all administrative permissions', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest('http://localhost:3000/api/roles', { method: 'GET', headers });
    const response = await getRolesRoute(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    const adminRole = data.roles.find((r: any) => r.id === 'admin');
    expect(adminRole.permissionKeys).toContain('role.manage');
    expect(adminRole.permissionKeys).toContain('user.manage');
    expect(adminRole.permissionKeys).toContain('report.view.all');
  });

  it('PATCH /api/roles/:roleId can update role permissions', async () => {
    // Update member role to have task.delete
    const updateHeaders = new Headers();
    updateHeaders.set('x-user-id', adminId);
    updateHeaders.set('content-type', 'application/json');
    const updateReq = new NextRequest('http://localhost:3000/api/roles/member', {
      method: 'PATCH',
      headers: updateHeaders,
      body: JSON.stringify({
        permissionKeys: ['task.create', 'task.update', 'task.move', 'task.delete', 'comment.create', 'attachment.upload'],
      }),
    });
    const response = await updateRoleRoute(updateReq, { params: Promise.resolve({ roleId: 'member' }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.role.permissionKeys).toContain('task.delete');

    // Restore member role to its original permissions for test isolation
    const restoreHeaders = new Headers();
    restoreHeaders.set('x-user-id', adminId);
    restoreHeaders.set('content-type', 'application/json');
    const restoreReq = new NextRequest('http://localhost:3000/api/roles/member', {
      method: 'PATCH',
      headers: restoreHeaders,
      body: JSON.stringify({
        permissionKeys: ['task.create', 'task.update', 'task.move', 'task.delete.own', 'comment.create', 'attachment.upload'],
      }),
    });
    const restoreRes = await updateRoleRoute(restoreReq, { params: Promise.resolve({ roleId: 'member' }) });
    expect(restoreRes.status).toBe(200);
  });

  it('Cannot update role without role.manage permission', async () => {
    const headers = new Headers();
    headers.set('x-user-id', viewerId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest('http://localhost:3000/api/roles/member', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        permissionKeys: ['task.create'],
      }),
    });
    const response = await updateRoleRoute(req, { params: Promise.resolve({ roleId: 'member' }) });
    expect(response.status).toBe(403);
  });

  it('Admin role deletion is protected', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest('http://localhost:3000/api/roles/admin', {
      method: 'DELETE',
      headers,
      body: JSON.stringify({}),
    });
    const response = await deleteRoleRoute(req, { params: Promise.resolve({ roleId: 'admin' }) });
    // Should fail with either 400 or 409 depending on implementation
    expect([400, 409]).toContain(response.status);
  });

  it('POST /api/roles creates custom role with permissions', async () => {
    const timestamp = Date.now();
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest('http://localhost:3000/api/roles', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: `custom-role-${timestamp}`,
        permissionKeys: ['task.create', 'task.update'],
      }),
    });
    const response = await createRoleRoute(req);
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
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest('http://localhost:3000/api/roles', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: `single-perm-${timestamp}`,
        permissionKeys: ['comment.create'],
      }),
    });
    const response = await createRoleRoute(req);
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.role.permissionKeys).toEqual(['comment.create']);
    expect(data.role.permissionKeys).not.toContain('task.create');
  });

  it('POST /api/roles rejects invalid permission keys', async () => {
    const timestamp = Date.now();
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest('http://localhost:3000/api/roles', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: `Invalid Perm Role ${timestamp}`,
        permissionKeys: ['invalid.permission', 'task.create'],
      }),
    });
    const response = await createRoleRoute(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('POST /api/roles rejects duplicate permission keys', async () => {
    const timestamp = Date.now();
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest('http://localhost:3000/api/roles', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: `Duplicate Perm Role ${timestamp}`,
        permissionKeys: ['task.create', 'task.create'],
      }),
    });
    const response = await createRoleRoute(req);
    expect(response.status).toBe(400);
  });

  it('User without role.manage cannot create roles', async () => {
    const timestamp = Date.now();
    const headers = new Headers();
    headers.set('x-user-id', viewerId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest('http://localhost:3000/api/roles', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: `Unauthorized Role ${timestamp}`,
        permissionKeys: ['task.create'],
      }),
    });
    const response = await createRoleRoute(req);
    expect(response.status).toBe(403);
  });

  it('Cannot remove role.manage permission from the last user with it', async () => {
    // Try to remove role.manage from admin role when admin is the only one with it
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest('http://localhost:3000/api/roles/admin', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        permissionKeys: ['user.manage', 'project.create', 'member.manage'],
      }),
    });
    const response = await updateRoleRoute(req, { params: Promise.resolve({ roleId: 'admin' }) });
    expect(response.status).toBe(400);
  });

  it('Custom role with task.create only allows creating tasks, rejects updates', async () => {
    const timestamp = Date.now();
    const customRoleName = `custom-task-creator-${timestamp}`;

    // Create a custom role with only task.create
    const createRoleHeaders = new Headers();
    createRoleHeaders.set('x-user-id', adminId);
    createRoleHeaders.set('content-type', 'application/json');
    const createRoleReq = new NextRequest('http://localhost:3000/api/roles', {
      method: 'POST',
      headers: createRoleHeaders,
      body: JSON.stringify({
        name: customRoleName,
        permissionKeys: ['task.create'],
      }),
    });
    const createRoleRes = await createRoleRoute(createRoleReq);
    expect(createRoleRes.status).toBe(201);

    // Create a new user
    const createUserHeaders = new Headers();
    createUserHeaders.set('x-user-id', adminId);
    createUserHeaders.set('content-type', 'application/json');
    const createUserReq = new NextRequest('http://localhost:3000/api/users', {
      method: 'POST',
      headers: createUserHeaders,
      body: JSON.stringify({
        name: `Test User ${timestamp}`,
        email: `test-${timestamp}@example.com`,
        roleIds: [customRoleName],
      }),
    });
    const createUserRes = await createUserRoute(createUserReq);
    expect(createUserRes.status).toBe(201);
    const newUser = (await createUserRes.json()).user;

    // Verify user can create tasks (has task.create permission)
    const meHeaders = new Headers();
    meHeaders.set('x-user-id', newUser.id);
    const meReq = new NextRequest('http://localhost:3000/api/me', { method: 'GET', headers: meHeaders });
    const meRes = await getMeRoute(meReq);
    expect(meRes.status).toBe(200);
    const meData = await meRes.json();
    expect(meData.permissions).toContain('task.create');
    expect(meData.permissions).not.toContain('task.update');
  });
});
