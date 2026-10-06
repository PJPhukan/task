import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/server/lib/prisma';

function generateProjectKey(length = 4): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

let adminId: string, memberId: string, viewerId: string, projectId: string, boardId: string;

beforeAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: ['admin@example.com', 'member@example.com', 'viewer@example.com'] } },
  });
  adminId = users.find((u) => u.email === 'admin@example.com')!.id;
  memberId = users.find((u) => u.email === 'member@example.com')!.id;
  viewerId = users.find((u) => u.email === 'viewer@example.com')!.id;

  const projectKey = generateProjectKey();
  const project = await prisma.project.create({
    data: { name: 'Boards Test Project', key: projectKey },
  });
  projectId = project.id;

  await prisma.projectMember.create({
    data: { projectId, userId: memberId, role: 'member' },
  });

  await prisma.projectMember.create({
    data: { projectId, userId: viewerId, role: 'viewer' },
  });
});

describe('Boards API', () => {
  it('Member can list boards', async () => {
    const response = await fetch(`http://localhost:3000/api/projects/${projectId}/boards`, {
      headers: { 'x-user-id': memberId },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.boards)).toBe(true);
  });

  it('Admin can create board with auto-generated columns', async () => {
    const response = await fetch(`http://localhost:3000/api/projects/${projectId}/boards`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Sprint 1', description: 'First sprint' }),
    });
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.board).toBeDefined();
    expect(data.board.columns).toHaveLength(3);
    expect(data.board.columns[0].name).toBe('To Do');
    expect(data.board.columns[1].name).toBe('In Progress');
    expect(data.board.columns[2].name).toBe('Done');
    expect(data.board.columns[2].isDone).toBe(true);
    boardId = data.board.id;
  });

  it('Viewer cannot create board', async () => {
    const response = await fetch(`http://localhost:3000/api/projects/${projectId}/boards`, {
      method: 'POST',
      headers: { 'x-user-id': viewerId, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Test Board' }),
    });
    expect(response.status).toBe(403);
  });

  it('Member can get board with columns and tasks', async () => {
    const response = await fetch(`http://localhost:3000/api/projects/${projectId}/boards/${boardId}`, {
      headers: { 'x-user-id': memberId },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.board).toBeDefined();
    expect(data.board.id).toBe(boardId);
    expect(Array.isArray(data.board.columns)).toBe(true);
  });

  it('Non-member cannot get board', async () => {
    const response = await fetch(`http://localhost:3000/api/projects/${projectId}/boards/${boardId}`, {
      headers: { 'x-user-id': 'invalid-user' },
    });
    expect(response.status).toBe(401);
  });

  it('Admin can update board', async () => {
    const response = await fetch(`http://localhost:3000/api/projects/${projectId}/boards/${boardId}`, {
      method: 'PATCH',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Sprint 1 Updated', description: 'Updated description' }),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.board.name).toBe('Sprint 1 Updated');
    expect(data.board.description).toBe('Updated description');
  });

  it('Viewer cannot update board', async () => {
    const response = await fetch(`http://localhost:3000/api/projects/${projectId}/boards/${boardId}`, {
      method: 'PATCH',
      headers: { 'x-user-id': viewerId, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    expect(response.status).toBe(403);
  });

  it('Admin can delete board', async () => {
    const response = await fetch(`http://localhost:3000/api/projects/${projectId}/boards/${boardId}`, {
      method: 'DELETE',
      headers: { 'x-user-id': adminId },
    });
    expect(response.status).toBe(200);
  });

  it('Viewer cannot delete board', async () => {
    // Create another board for this test
    const createRes = await fetch(`http://localhost:3000/api/projects/${projectId}/boards`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Board for delete test' }),
    });
    const { board } = await createRes.json();

    const response = await fetch(`http://localhost:3000/api/projects/${projectId}/boards/${board.id}`, {
      method: 'DELETE',
      headers: { 'x-user-id': viewerId },
    });
    expect(response.status).toBe(403);
  });
});
