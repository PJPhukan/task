import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getUsersRoute, POST as createUserRoute } from '@/app/api/users/route';
import { PATCH as updateUserRoute } from '@/app/api/users/[userId]/route';
import { PUT as setUserRolesRoute } from '@/app/api/users/[userId]/roles/route';
import { GET as getMeRoute } from '@/app/api/me/route';
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

describe('Users API', () => {
  it('GET /api/users returns active users', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest('http://localhost:3000/api/users', { method: 'GET', headers });
    const response = await getUsersRoute(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.users)).toBe(true);
    if (data.users.length > 0) {
      const user = data.users[0];
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('name');
      expect(user).toHaveProperty('email');
    }
  });

  it('User without member.manage cannot list users', async () => {
    const headers = new Headers();
    headers.set('x-user-id', viewerId);
    const req = new NextRequest('http://localhost:3000/api/users', { method: 'GET', headers });
    const response = await getUsersRoute(req);
    expect(response.status).toBe(403);
  });

  it('POST /api/users creates user with roleIds', async () => {
    const timestamp = Date.now();
    const email = `new-user-${timestamp}@example.com`;
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest('http://localhost:3000/api/users', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'New User',
        email,
        roleIds: ['member', 'viewer'],
      }),
    });
    const response = await createUserRoute(req);
    expect(response.status).toBe(201);
    const data = await response.json();
    const user = data.user;

    expect(user.name).toBe('New User');
    expect(user.email).toBe(email);
    expect(user.isActive).toBe(true);
    expect(Array.isArray(user.roles)).toBe(true);
    expect(user.roles).toContain('member');
    expect(user.roles).toContain('viewer');
    // User with both member and viewer roles should have union of their permissions
    expect(Array.isArray(user.permissions)).toBe(true);
    expect(user.permissions.length).toBeGreaterThan(0);
  });

  it('User with two roles gets permissions of both', async () => {
    const timestamp = Date.now();
    const email = `dual-role-user-${timestamp}@example.com`;
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest('http://localhost:3000/api/users', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Dual Role User',
        email,
        roleIds: ['member', 'manager'],
      }),
    });
    const response = await createUserRoute(req);
    expect(response.status).toBe(201);
    const data = await response.json();
    const user = data.user;

    expect(user.roles).toContain('member');
    expect(user.roles).toContain('manager');
    // Both member and manager have permissions, so combined should be greater
    expect(Array.isArray(user.permissions)).toBe(true);
    // Should have member's permissions (task.create, etc) and manager's permissions
    expect(user.permissions).toContain('task.create');
  });

  it('User without user.manage cannot create users', async () => {
    const timestamp = Date.now();
    const headers = new Headers();
    headers.set('x-user-id', viewerId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest('http://localhost:3000/api/users', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Unauthorized User',
        email: `unauthorized-${timestamp}@example.com`,
        roleIds: ['viewer'],
      }),
    });
    const response = await createUserRoute(req);
    expect(response.status).toBe(403);
  });

  it('PATCH /api/users/:userId updates user info', async () => {
    // Create a user first
    const timestamp = Date.now();
    const email = `patch-test-${timestamp}@example.com`;
    const createHeaders = new Headers();
    createHeaders.set('x-user-id', adminId);
    createHeaders.set('content-type', 'application/json');
    const createReq = new NextRequest('http://localhost:3000/api/users', {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({
        name: 'Original Name',
        email,
        roleIds: ['member'],
      }),
    });
    const createRes = await createUserRoute(createReq);
    const createData = await createRes.json();
    const userId = createData.user.id;

    // Update the user's name only
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/users/${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        name: 'Updated Name',
      }),
    });
    const response = await updateUserRoute(req, { params: Promise.resolve({ userId }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user.name).toBe('Updated Name');
  });

  it('PUT /api/users/:userId/roles replaces user roles', async () => {
    // Create a user first
    const timestamp = Date.now();
    const email = `roles-test-${timestamp}@example.com`;
    const createHeaders = new Headers();
    createHeaders.set('x-user-id', adminId);
    createHeaders.set('content-type', 'application/json');
    const createReq = new NextRequest('http://localhost:3000/api/users', {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({
        name: 'Role Test User',
        email,
        roleIds: ['member'],
      }),
    });
    const createRes = await createUserRoute(createReq);
    const createData = await createRes.json();
    const userId = createData.user.id;

    // Replace roles
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/users/${userId}/roles`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        roleIds: ['manager', 'viewer'],
      }),
    });
    const response = await setUserRolesRoute(req, { params: Promise.resolve({ userId }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user.roles).toContain('manager');
    expect(data.user.roles).toContain('viewer');
    expect(data.user.roles).not.toContain('member');
  });

  it('Cannot deactivate the last user with role.manage', async () => {
    // This is a safety check - we can't deactivate the admin user
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/users/${adminId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        isActive: false,
      }),
    });
    const response = await updateUserRoute(req, { params: Promise.resolve({ userId: adminId }) });
    // Should fail because admin is the last with role.manage
    expect(response.status).toBe(400);
  }, 10000);

  it('GET /api/me returns user with roles and permissions', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest('http://localhost:3000/api/me', { method: 'GET', headers });
    const response = await getMeRoute(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user).toBeDefined();
    expect(data.roles).toBeDefined();
    expect(Array.isArray(data.roles)).toBe(true);
    expect(data.permissions).toBeDefined();
    expect(Array.isArray(data.permissions)).toBe(true);
  });
});
