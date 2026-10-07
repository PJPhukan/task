import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getBoardsRoute, POST as createBoardRoute } from '@/app/api/projects/[projectId]/boards/route';
import { GET as getBoardRoute, PATCH as updateBoardRoute, DELETE as deleteBoardRoute } from '@/app/api/projects/[projectId]/boards/[boardId]/route';
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
    data: { projectId, userId: memberId },
  });

  await prisma.projectMember.create({
    data: { projectId, userId: viewerId },
  });
});

describe('Boards API', () => {
  it('Member can list boards', async () => {
    const headers = new Headers();
    headers.set('x-user-id', memberId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/boards`, { method: 'GET', headers });
    const response = await getBoardsRoute(req, { params: { projectId } });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.boards)).toBe(true);
  });

  it('Admin can create board with auto-generated columns', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/boards`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Sprint 1', description: 'First sprint' }),
    });
    const response = await createBoardRoute(req, { params: { projectId } });
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
    const headers = new Headers();
    headers.set('x-user-id', viewerId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/boards`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Test Board' }),
    });
    const response = await createBoardRoute(req, { params: { projectId } });
    expect(response.status).toBe(403);
  });

  it('Member can get board with columns and tasks', async () => {
    const headers = new Headers();
    headers.set('x-user-id', memberId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/boards/${boardId}`, { method: 'GET', headers });
    const response = await getBoardRoute(req, { params: { projectId, boardId } });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.board).toBeDefined();
    expect(data.board.id).toBe(boardId);
    expect(Array.isArray(data.board.columns)).toBe(true);
  });

  it('Non-member cannot get board', async () => {
    const headers = new Headers();
    headers.set('x-user-id', 'invalid-user');
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/boards/${boardId}`, { method: 'GET', headers });
    const response = await getBoardRoute(req, { params: { projectId, boardId } });
    expect(response.status).toBe(401);
  });

  it('Admin can update board', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/boards/${boardId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ name: 'Sprint 1 Updated', description: 'Updated description' }),
    });
    const response = await updateBoardRoute(req, { params: { projectId, boardId } });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.board.name).toBe('Sprint 1 Updated');
    expect(data.board.description).toBe('Updated description');
  });

  it('Viewer cannot update board', async () => {
    const headers = new Headers();
    headers.set('x-user-id', viewerId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/boards/${boardId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ name: 'Updated' }),
    });
    const response = await updateBoardRoute(req, { params: { projectId, boardId } });
    expect(response.status).toBe(403);
  });

  it('Admin can delete board', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/boards/${boardId}`, { method: 'DELETE', headers });
    const response = await deleteBoardRoute(req, { params: { projectId, boardId } });
    expect(response.status).toBe(200);
  });

  it('Viewer cannot delete board', async () => {
    // Create another board for this test
    const createHeaders = new Headers();
    createHeaders.set('x-user-id', adminId);
    createHeaders.set('content-type', 'application/json');
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/boards`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({ name: 'Board for delete test' }),
    });
    const createRes = await createBoardRoute(createReq, { params: { projectId } });
    const { board } = await createRes.json();

    const deleteHeaders = new Headers();
    deleteHeaders.set('x-user-id', viewerId);
    const deleteReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/boards/${board.id}`, { method: 'DELETE', headers: deleteHeaders });
    const response = await deleteBoardRoute(deleteReq, { params: { projectId, boardId: board.id } });
    expect(response.status).toBe(403);
  });
});
