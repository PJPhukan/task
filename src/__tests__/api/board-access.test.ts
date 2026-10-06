import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/server/lib/prisma';

function generateProjectKey(length = 4): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

let adminId: string;
let viewerId: string;
let projectId: string;
let boardId: string;

beforeAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: ['admin@example.com', 'viewer@example.com'] } },
  });
  adminId = users.find((u) => u.email === 'admin@example.com')!.id;
  viewerId = users.find((u) => u.email === 'viewer@example.com')!.id;

  const project = await prisma.project.create({
    data: {
      name: 'Test Project',
      key: generateProjectKey(),
    },
  });
  projectId = project.id;

  await prisma.projectMember.create({
    data: { projectId, userId: adminId },
  });

  const board = await prisma.board.create({
    data: {
      projectId,
      name: 'Test Board',
      position: 0,
      createdById: adminId,
    },
  });
  boardId = board.id;
});

describe('Board Access API', () => {
  it('PUT /api/projects/:projectId/boards/:boardId/access sets board to restricted', async () => {
    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/boards/${boardId}/access`,
      {
        method: 'PUT',
        headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
        body: JSON.stringify({
          isOpen: false,
          allowedUserIds: [adminId],
          allowedRoleIds: [],
        }),
      }
    );
    expect(response.status).toBe(200);
  });

  it('Restricted board is hidden from non-allowed members', async () => {
    // Add viewer as project member
    await prisma.projectMember.create({
      data: { projectId, userId: viewerId },
    });

    // Board list should not include the restricted board for viewer
    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/boards`,
      {
        headers: { 'x-user-id': viewerId },
      }
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    const hasRestrictedBoard = data.boards.some((b: any) => b.id === boardId);
    expect(hasRestrictedBoard).toBe(false);
  });

  it('Restricted board is visible to allowed user', async () => {
    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/boards`,
      {
        headers: { 'x-user-id': adminId },
      }
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    const hasBoard = data.boards.some((b: any) => b.id === boardId);
    expect(hasBoard).toBe(true);
  });

  it('PUT /api/projects/:projectId/boards/:boardId/access sets board to open', async () => {
    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/boards/${boardId}/access`,
      {
        method: 'PUT',
        headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
        body: JSON.stringify({
          isOpen: true,
          allowedUserIds: [],
          allowedRoleIds: [],
        }),
      }
    );
    expect(response.status).toBe(200);

    // Now viewer should see it
    const listResponse = await fetch(
      `http://localhost:3000/api/projects/${projectId}/boards`,
      {
        headers: { 'x-user-id': viewerId },
      }
    );
    expect(listResponse.status).toBe(200);
    const data = await listResponse.json();
    const hasBoard = data.boards.some((b: any) => b.id === boardId);
    expect(hasBoard).toBe(true);
  });

  it('User without board.update cannot change board access', async () => {
    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/boards/${boardId}/access`,
      {
        method: 'PUT',
        headers: { 'x-user-id': viewerId, 'content-type': 'application/json' },
        body: JSON.stringify({
          isOpen: false,
          allowedUserIds: [],
          allowedRoleIds: [],
        }),
      }
    );
    expect(response.status).toBe(403);
  });

  it('POST /api/projects/:projectId/members with boardIds grants board access', async () => {
    const newUserEmail = `test-user-${Date.now()}@example.com`;
    const newUser = await prisma.user.create({
      data: { name: 'Test User', email: newUserEmail, isActive: true },
    });

    // Restrict the board
    await fetch(
      `http://localhost:3000/api/projects/${projectId}/boards/${boardId}/access`,
      {
        method: 'PUT',
        headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
        body: JSON.stringify({
          isOpen: false,
          allowedUserIds: [adminId],
          allowedRoleIds: [],
        }),
      }
    );

    // Add user to project with board access
    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/members`,
      {
        method: 'POST',
        headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: newUser.id,
          boardIds: [boardId],
        }),
      }
    );
    expect(response.status).toBe(201);

    // Now user should have access to the board
    const boardsResponse = await fetch(
      `http://localhost:3000/api/projects/${projectId}/boards`,
      {
        headers: { 'x-user-id': newUser.id },
      }
    );
    expect(boardsResponse.status).toBe(200);
    const data = await boardsResponse.json();
    const hasBoard = data.boards.some((b: any) => b.id === boardId);
    expect(hasBoard).toBe(true);
  });

  it('User with role on restricted board role list can access the board', async () => {
    const timestamp = Date.now();
    const customRoleName = `board-access-role-${timestamp}`;

    // Create a custom role
    const createRoleRes = await fetch('http://localhost:3000/api/roles', {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: customRoleName,
        permissionKeys: ['task.create'],
      }),
    });
    expect(createRoleRes.status).toBe(201);

    // Create a new user with the custom role
    const createUserRes = await fetch('http://localhost:3000/api/users', {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `Board User ${timestamp}`,
        email: `board-user-${timestamp}@example.com`,
        roleIds: [customRoleName],
      }),
    });
    expect(createUserRes.status).toBe(201);
    const newUser = (await createUserRes.json()).user;

    // Add user to project
    await fetch(`http://localhost:3000/api/projects/${projectId}/members`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({ userId: newUser.id }),
    });

    // Restrict the board and add the custom role to allowed list
    await fetch(
      `http://localhost:3000/api/projects/${projectId}/boards/${boardId}/access`,
      {
        method: 'PUT',
        headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
        body: JSON.stringify({
          isOpen: false,
          allowedUserIds: [],
          allowedRoleIds: [customRoleName],
        }),
      }
    );

    // User with the custom role should see the board
    const boardsResponse = await fetch(
      `http://localhost:3000/api/projects/${projectId}/boards`,
      {
        headers: { 'x-user-id': newUser.id },
      }
    );
    expect(boardsResponse.status).toBe(200);
    const data = await boardsResponse.json();
    const hasBoard = data.boards.some((b: any) => b.id === boardId);
    expect(hasBoard).toBe(true);
  });
});
