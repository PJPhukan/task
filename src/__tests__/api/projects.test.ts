import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getProjectsRoute, POST as createProjectRoute } from '@/app/api/projects/route';
import { GET as getProjectRoute, PATCH as updateProjectRoute, DELETE as deleteProjectRoute } from '@/app/api/projects/[projectId]/route';
import { prisma } from '@/server/lib/prisma';

function generateProjectKey(length = 4): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

let adminId: string, viewerId: string, nonMemberId: string;

beforeAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: ['admin@example.com', 'viewer@example.com'] } },
  });
  adminId = users.find((u) => u.email === 'admin@example.com')!.id;
  viewerId = users.find((u) => u.email === 'viewer@example.com')!.id;

  const nonMember = await prisma.user.create({
    data: { name: 'Non Member', email: `nonmember-${Date.now()}@example.com` },
  });
  nonMemberId = nonMember.id;
});

describe('Projects API', () => {
  let projectId: string;

  it('Admin can create a project', async () => {
    const projectKey = generateProjectKey();
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest('http://localhost:3000/api/projects', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Test Project', key: projectKey }),
    });
    const response = await createProjectRoute(req);
    expect(response.status).toBe(201);
    const data = await response.json();
    projectId = data.project.id;
    expect(data.project.name).toBe('Test Project');
  });

  it('Admin can list projects they own', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest('http://localhost:3000/api/projects', { method: 'GET', headers });
    const response = await getProjectsRoute(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.projects)).toBe(true);
    expect(data.projects.some((p: any) => p.id === projectId)).toBe(true);
  });

  it('Admin can get a project they do not belong to', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}`, { method: 'GET', headers });
    const response = await getProjectRoute(req, { params: Promise.resolve({ projectId }) });
    expect(response.status).toBe(200);
  });

  it('Non-member cannot read project', async () => {
    const headers = new Headers();
    headers.set('x-user-id', nonMemberId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}`, { method: 'GET', headers });
    const response = await getProjectRoute(req, { params: Promise.resolve({ projectId }) });
    expect(response.status).toBe(403);
  });

  it('Admin can update project', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ name: 'Updated Project' }),
    });
    const response = await updateProjectRoute(req, { params: Promise.resolve({ projectId }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.project.name).toBe('Updated Project');
  });

  it('Viewer cannot update project', async () => {
    const headers = new Headers();
    headers.set('x-user-id', viewerId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ name: 'Should Fail' }),
    });
    const response = await updateProjectRoute(req, { params: Promise.resolve({ projectId }) });
    expect(response.status).toBe(403);
  });

  it('Admin can archive empty project', async () => {
    const newProject = await prisma.project.create({
      data: { name: 'Empty Project', key: generateProjectKey() },
    });
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${newProject.id}`, { method: 'DELETE', headers });
    const response = await deleteProjectRoute(req, { params: Promise.resolve({ projectId: newProject.id }) });
    expect(response.status).toBe(200);
  });

  it('Delete project with tasks archives instead of hard deleting', async () => {
    const board = await prisma.board.create({
      data: {
        projectId,
        name: 'Test Board',
        position: 0,
        createdById: adminId,
      },
    });
    const column = await prisma.boardColumn.create({
      data: { boardId: board.id, name: 'To Do', position: 0, isDone: false },
    });

    await prisma.task.create({
      data: {
        projectId,
        boardId: board.id,
        columnId: column.id,
        number: 1,
        title: 'Task',
        reporterId: adminId,
        position: 0,
      },
    });

    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}`, { method: 'DELETE', headers });
    const response = await deleteProjectRoute(req, { params: Promise.resolve({ projectId }) });
    expect(response.status).toBe(200);

    // Verify project is archived, not deleted
    const archivedProject = await prisma.project.findUnique({ where: { id: projectId } });
    expect(archivedProject).toBeDefined();
    expect(archivedProject?.archivedAt).not.toBeNull();
  });
});
