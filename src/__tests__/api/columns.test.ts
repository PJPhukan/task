import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/server/lib/prisma';

function generateProjectKey(length = 4): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

let adminId: string, memberId: string, viewerId: string, projectId: string, boardId: string, columnId: string;

beforeAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: ['admin@example.com', 'member@example.com', 'viewer@example.com'] } },
  });
  adminId = users.find((u) => u.email === 'admin@example.com')!.id;
  memberId = users.find((u) => u.email === 'member@example.com')!.id;
  viewerId = users.find((u) => u.email === 'viewer@example.com')!.id;

  const projectKey = generateProjectKey();
  const project = await prisma.project.create({
    data: { name: 'Columns Test Project', key: projectKey },
  });
  projectId = project.id;

  await prisma.projectMember.create({
    data: { projectId, userId: memberId, role: 'member' },
  });

  await prisma.projectMember.create({
    data: { projectId, userId: viewerId, role: 'viewer' },
  });

  const board = await prisma.board.create({
    data: {
      projectId,
      name: 'Test Board',
      position: 0,
      createdById: adminId,
      columns: {
        create: [
          { name: 'To Do', position: 0, isDone: false },
          { name: 'In Progress', position: 1, isDone: false },
          { name: 'Done', position: 2, isDone: true },
        ],
      },
    },
    include: { columns: true },
  });
  boardId = board.id;
  columnId = board.columns[0].id;
});

describe('Columns API', () => {
  it('Admin can add column', async () => {
    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/boards/${boardId}/columns`,
      {
        method: 'POST',
        headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Testing', color: '#FF0000' }),
      }
    );
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.column).toBeDefined();
    expect(data.column.name).toBe('Testing');
  });

  it('Viewer cannot add column', async () => {
    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/boards/${boardId}/columns`,
      {
        method: 'POST',
        headers: { 'x-user-id': viewerId, 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Test' }),
      }
    );
    expect(response.status).toBe(403);
  });

  it('Admin can update column', async () => {
    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/columns/${columnId}`,
      {
        method: 'PATCH',
        headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Updated To Do', isDone: false }),
      }
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.column.name).toBe('Updated To Do');
  });

  it('Viewer cannot update column', async () => {
    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/columns/${columnId}`,
      {
        method: 'PATCH',
        headers: { 'x-user-id': viewerId, 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Updated' }),
      }
    );
    expect(response.status).toBe(403);
  });

  it('Admin can reorder columns', async () => {
    const columns = await prisma.boardColumn.findMany({
      where: { boardId },
      orderBy: { position: 'asc' },
    });

    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/boards/${boardId}/columns`,
      {
        method: 'PATCH',
        headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
        body: JSON.stringify({
          columns: columns.map((col, idx) => ({ id: col.id, position: columns.length - 1 - idx })),
        }),
      }
    );
    expect(response.status).toBe(200);
  });

  it('Cannot delete column with tasks without targetColumnId', async () => {
    const col = await prisma.boardColumn.findFirst({ where: { boardId } });
    await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId: col!.id,
        number: 1,
        title: 'Test Task',
        reporterId: adminId,
        position: 0,
      },
    });

    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/columns/${col!.id}`,
      {
        method: 'DELETE',
        headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }
    );
    expect(response.status).toBe(409);
  });

  it('Admin can delete column with tasks if targetColumnId provided', async () => {
    const columns = await prisma.boardColumn.findMany({ where: { boardId } });
    const sourceCol = columns[0];
    const targetCol = columns[1];

    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/columns/${sourceCol.id}`,
      {
        method: 'DELETE',
        headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
        body: JSON.stringify({ targetColumnId: targetCol.id }),
      }
    );
    expect(response.status).toBe(200);

    const movedTasks = await prisma.task.findMany({
      where: { columnId: targetCol.id },
    });
    expect(movedTasks.length).toBeGreaterThan(0);
  });

  it('Admin can delete empty column', async () => {
    const columns = await prisma.boardColumn.findMany({ where: { boardId } });
    const emptyCol = columns[columns.length - 1];

    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/columns/${emptyCol.id}`,
      {
        method: 'DELETE',
        headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }
    );
    expect(response.status).toBe(200);
  });

  it('Viewer cannot delete column', async () => {
    const col = await prisma.boardColumn.create({
      data: { boardId, name: 'Temp', position: 99, isDone: false },
    });

    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/columns/${col.id}`,
      {
        method: 'DELETE',
        headers: { 'x-user-id': viewerId, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }
    );
    expect(response.status).toBe(403);
  });
});
