import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/lib/prisma';

let adminId: string, memberId: string, viewerId: string, nonMemberId: string;
let projectId: string;

beforeAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: ['admin@example.com', 'member@example.com', 'viewer@example.com'] } } });
  adminId = users.find((u) => u.email === 'admin@example.com')!.id;
  memberId = users.find((u) => u.email === 'member@example.com')!.id;
  viewerId = users.find((u) => u.email === 'viewer@example.com')!.id;
  nonMemberId = 'nonmember_user_id';
});

describe('Projects API', () => {
  it('Admin can create a project', async () => {
    const response = await fetch('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Test Project', key: 'TEST' }),
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
    const newProject = await prisma.project.create({
      data: { name: 'Empty Project', key: 'EMPT' },
    });
    const response = await fetch(`http://localhost:3000/api/projects/${newProject.id}`, {
      method: 'DELETE',
      headers: { 'x-user-id': adminId },
    });
    expect(response.status).toBe(200);
  });

  it('Cannot archive project with tasks', async () => {
    await prisma.task.create({
      data: {
        projectId,
        boardId: 'board_id',
        columnId: 'col_id',
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
