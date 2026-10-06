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

describe('Users API', () => {
  it('GET /api/users returns active users', async () => {
    const response = await fetch('http://localhost:3000/api/users', {
      headers: { 'x-user-id': adminId },
    });
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
    const response = await fetch('http://localhost:3000/api/users', {
      headers: { 'x-user-id': viewerId },
    });
    expect(response.status).toBe(403);
  });

  it('POST /api/users creates user with roleIds', async () => {
    const timestamp = Date.now();
    const email = `new-user-${timestamp}@example.com`;
    const response = await fetch('http://localhost:3000/api/users', {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'New User',
        email,
        roleIds: ['member', 'viewer'],
      }),
    });
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
    const response = await fetch('http://localhost:3000/api/users', {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Dual Role User',
        email,
        roleIds: ['member', 'manager'],
      }),
    });
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
    const response = await fetch('http://localhost:3000/api/users', {
      method: 'POST',
      headers: { 'x-user-id': viewerId, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Unauthorized User',
        email: `unauthorized-${timestamp}@example.com`,
        roleIds: ['viewer'],
      }),
    });
    expect(response.status).toBe(403);
  });

  it('PATCH /api/users/:userId updates user info', async () => {
    // Create a user first
    const timestamp = Date.now();
    const email = `patch-test-${timestamp}@example.com`;
    const createRes = await fetch('http://localhost:3000/api/users', {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Original Name',
        email,
        roleIds: ['member'],
      }),
    });
    const createData = await createRes.json();
    const userId = createData.user.id;

    // Update the user's name only
    const response = await fetch(`http://localhost:3000/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Updated Name',
      }),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user.name).toBe('Updated Name');
  });

  it('PUT /api/users/:userId/roles replaces user roles', async () => {
    // Create a user first
    const timestamp = Date.now();
    const email = `roles-test-${timestamp}@example.com`;
    const createRes = await fetch('http://localhost:3000/api/users', {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Role Test User',
        email,
        roleIds: ['member'],
      }),
    });
    const createData = await createRes.json();
    const userId = createData.user.id;

    // Replace roles
    const response = await fetch(`http://localhost:3000/api/users/${userId}/roles`, {
      method: 'PUT',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        roleIds: ['manager', 'viewer'],
      }),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user.roles).toContain('manager');
    expect(data.user.roles).toContain('viewer');
    expect(data.user.roles).not.toContain('member');
  });

  it('Cannot deactivate the last user with role.manage', async () => {
    // This is a safety check - we can't deactivate the admin user
    const response = await fetch(`http://localhost:3000/api/users/${adminId}`, {
      method: 'PATCH',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        isActive: false,
      }),
    });
    // Should fail because admin is the last with role.manage
    expect(response.status).toBe(400);
  });

  it('GET /api/me returns user with roles and permissions', async () => {
    const response = await fetch('http://localhost:3000/api/me', {
      headers: { 'x-user-id': adminId },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user).toBeDefined();
    expect(data.roles).toBeDefined();
    expect(Array.isArray(data.roles)).toBe(true);
    expect(data.permissions).toBeDefined();
    expect(Array.isArray(data.permissions)).toBe(true);
  });
});
