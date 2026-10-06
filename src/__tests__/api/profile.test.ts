import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/server/lib/prisma';

let adminId: string;
let userId: string;

beforeAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: 'admin@example.com' },
  });
  adminId = users[0]!.id;

  const newUser = await prisma.user.create({
    data: {
      name: 'Profile Test User',
      email: `profile-test-${Date.now()}@example.com`,
      isActive: true,
    },
  });
  userId = newUser.id;
});

describe('Profile API', () => {
  it('GET /api/users/:userId/profile returns user profile', async () => {
    const response = await fetch(
      `http://localhost:3000/api/users/${adminId}/profile`,
      {
        headers: { 'x-user-id': adminId },
      }
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.profile).toBeDefined();
    expect(data.profile.id).toBe(adminId);
    expect(data.profile).toHaveProperty('name');
    expect(data.profile).toHaveProperty('email');
    expect(data.profile).toHaveProperty('roles');
    expect(data.profile).toHaveProperty('permissions');
    expect(data.profile).toHaveProperty('projects');
    expect(data.profile).toHaveProperty('boards');
  }, 10000);

  it('GET /api/users/:userId/profile includes user roles and projects', async () => {
    // Create a project and add user as member
    const project = await prisma.project.create({
      data: {
        name: 'Profile Test Project',
        key: `PF${Date.now().toString().slice(-2)}`,
      },
    });

    await prisma.projectMember.create({
      data: { projectId: project.id, userId },
    });

    const response = await fetch(
      `http://localhost:3000/api/users/${userId}/profile`,
      {
        headers: { 'x-user-id': adminId },
      }
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.profile.projects)).toBe(true);
    const hasProject = data.profile.projects.some((p: any) => p.id === project.id);
    expect(hasProject).toBe(true);
  });

  it('GET /api/users/:userId/profile returns 404 for non-existent user', async () => {
    const response = await fetch(
      `http://localhost:3000/api/users/non-existent-id/profile`,
      {
        headers: { 'x-user-id': adminId },
      }
    );
    expect(response.status).toBe(404);
  });

  it('GET /api/users/:userId/profile requires authentication', async () => {
    const response = await fetch(
      `http://localhost:3000/api/users/${adminId}/profile`
    );
    expect(response.status).toBe(401);
  });

  it('PATCH /api/me updates current user name', async () => {
    const newName = `Updated Name ${Date.now()}`;
    const response = await fetch('http://localhost:3000/api/me', {
      method: 'PATCH',
      headers: { 'x-user-id': userId, 'content-type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user.name).toBe(newName);
  });

  it('PATCH /api/me without updates returns error', async () => {
    const response = await fetch('http://localhost:3000/api/me', {
      method: 'PATCH',
      headers: { 'x-user-id': userId, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
  });

  it('PATCH /api/me requires authentication', async () => {
    const response = await fetch('http://localhost:3000/api/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    });
    expect(response.status).toBe(401);
  });
});
