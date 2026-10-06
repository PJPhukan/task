import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/server/lib/prisma';

let adminId: string, memberId: string, viewerId: string, nonMemberId: string;

beforeAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: ['admin@example.com', 'member@example.com', 'viewer@example.com'] } },
  });
  adminId = users.find((u) => u.email === 'admin@example.com')!.id;
  memberId = users.find((u) => u.email === 'member@example.com')!.id;
  viewerId = users.find((u) => u.email === 'viewer@example.com')!.id;

  const nonMember = await prisma.user.create({
    data: { name: 'Non Member', email: `nonmember-${Date.now()}@example.com` },
  });
  nonMemberId = nonMember.id;
});

describe('Projects API', () => {
  let projectId: string;

  it('Admin can create a project', async () => {
    const projectKey = Math.random().toString(36).substring(2, 5).toUpperCase();
    const response = await fetch('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Test Project', key: projectKey }),
    });
    expect(response.status).toBe(201);
    const data = await response.json();
    projectId = data.project.id;
    expect(data.project.name).toBe('Test Project');
  });

  it('Admin can list projects they own', async () => {
    const response = await fetch('http://localhost:3000/api/projects', {
      headers: { 'x-user-id': adminId },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.projects)).toBe(true);
    expect(data.projects.some((p: any) => p.id === projectId)).toBe(true);
  });

  it('Admin can get a project they do not belong to', async () => {
    const response = await fetch(`http://localhost:3000/api/projects/${projectId}`, {
      headers: { 'x-user-id': adminId },
    });
    expect(response.status).toBe(200);
  });

  it('Non-member cannot read project', async () => {
    const response = await fetch(`http://localhost:3000/api/projects/${projectId}`, {
      headers: { 'x-user-id': nonMemberId },
    });
    expect(response.status).toBe(403);
  });

  it('Admin can update project', async () => {
    const response = await fetch(`http://localhost:3000/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Project' }),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.project.name).toBe('Updated Project');
  });

  it('Viewer cannot update project', async () => {
    const response = await fetch(`http://localhost:3000/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'x-user-id': viewerId, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Should Fail' }),
    });
    expect(response.status).toBe(403);
  });

  it('Admin can archive empty project', async () => {
    const projectKey = Math.random().toString(36).substring(2, 4).toUpperCase();
    const newProject = await prisma.project.create({
      data: { name: 'Empty Project', key: `EMP${projectKey}`.slice(0, 5) },
    });
    const response = await fetch(`http://localhost:3000/api/projects/${newProject.id}`, {
      method: 'DELETE',
      headers: { 'x-user-id': adminId },
    });
    expect(response.status).toBe(200);
  });

  it('Cannot archive project with tasks', async () => {
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

    const response = await fetch(`http://localhost:3000/api/projects/${projectId}`, {
      method: 'DELETE',
      headers: { 'x-user-id': adminId },
    });
    expect(response.status).toBe(409);
  });
});
