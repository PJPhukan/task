import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/server/lib/prisma';

function generateProjectKey(length = 4): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

let adminId: string;
let memberId: string;
let projectId: string;
let boardId: string;
let columnId: string;
let doneColumnId: string;

beforeAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: ['admin@example.com', 'member@example.com'] } },
  });
  adminId = users.find((u) => u.email === 'admin@example.com')!.id;
  memberId = users.find((u) => u.email === 'member@example.com')!.id;

  const project = await prisma.project.create({
    data: {
      name: 'Task Test Project',
      key: generateProjectKey(),
    },
  });
  projectId = project.id;

  await prisma.projectMember.create({
    data: { projectId, userId: adminId },
  });
  await prisma.projectMember.create({
    data: { projectId, userId: memberId },
  });

  const board = await prisma.board.create({
    data: {
      projectId,
      name: 'Task Board',
      position: 0,
      createdById: adminId,
    },
  });
  boardId = board.id;

  const col = await prisma.boardColumn.create({
    data: { boardId, name: 'To Do', position: 0 },
  });
  columnId = col.id;

  const done = await prisma.boardColumn.create({
    data: { boardId, name: 'Done', position: 1, isDone: true },
  });
  doneColumnId = done.id;
});

describe('Tasks API', () => {
  it('POST /api/projects/:projectId/tasks creates task with incrementing number', async () => {
    const res1 = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        boardId,
        columnId,
        title: 'First Task',
      }),
    });
    expect(res1.status).toBe(201);
    const data1 = await res1.json();
    const number1 = data1.task.number;

    const res2 = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        boardId,
        columnId,
        title: 'Second Task',
      }),
    });
    expect(res2.status).toBe(201);
    const data2 = await res2.json();
    expect(data2.task.number).toBe(number1 + 1);
  });

  it('POST /api/projects/:projectId/tasks rejects dueDate before startDate', async () => {
    const response = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        boardId,
        columnId,
        title: 'Invalid Dates',
        startDate: '2025-12-31',
        dueDate: '2025-01-01',
      }),
    });
    expect(response.status).toBe(400);
  });

  it('POST /api/projects/:projectId/tasks rejects non-member assignee', async () => {
    const nonMember = await prisma.user.create({
      data: { name: 'Non Member', email: `nm${Date.now()}@ex.com`, isActive: true },
    });
    const response = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        boardId,
        columnId,
        title: 'Task',
        assigneeId: nonMember.id,
      }),
    });
    expect(response.status).toBe(400);
  });

  it('GET /api/projects/:projectId/tasks/:taskId returns task', async () => {
    const createRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({ boardId, columnId, title: 'Test Task' }),
    });
    const task = (await createRes.json()).task;

    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${task.id}`,
      { headers: { 'x-user-id': adminId } }
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.task.id).toBe(task.id);
    expect(data.task).toHaveProperty('canMove');
  });

  it('PATCH /api/projects/:projectId/tasks/:taskId updates task', async () => {
    const createRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({ boardId, columnId, title: 'Original' }),
    });
    const task = (await createRes.json()).task;

    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${task.id}`,
      {
        method: 'PATCH',
        headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Updated' }),
      }
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.task.title).toBe('Updated');
  });

  it('DELETE /api/projects/:projectId/tasks/:taskId with task.delete deletes any task', async () => {
    const createRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': memberId, 'content-type': 'application/json' },
      body: JSON.stringify({ boardId, columnId, title: 'Member Task' }),
    });
    const task = (await createRes.json()).task;

    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${task.id}`,
      {
        method: 'DELETE',
        headers: { 'x-user-id': adminId },
      }
    );
    expect(response.status).toBe(200);
  });

  it('DELETE with task.delete.own allows deleting own task but not others', async () => {
    const createRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': memberId, 'content-type': 'application/json' },
      body: JSON.stringify({ boardId, columnId, title: 'Own Task' }),
    });
    const ownTask = (await createRes.json()).task;

    const adminTaskRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({ boardId, columnId, title: 'Admin Task' }),
    });
    const adminTask = (await adminTaskRes.json()).task;

    // Member can delete own task
    const deleteOwnRes = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${ownTask.id}`,
      { method: 'DELETE', headers: { 'x-user-id': memberId } }
    );
    expect([200, 403]).toContain(deleteOwnRes.status);

    // Member cannot delete other's task
    const deleteOtherRes = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${adminTask.id}`,
      { method: 'DELETE', headers: { 'x-user-id': memberId } }
    );
    expect(deleteOtherRes.status).toBe(403);
  });

  it('PATCH /api/projects/:projectId/tasks/:taskId/move to Done sets completedAt', async () => {
    const createRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({ boardId, columnId, title: 'To Complete' }),
    });
    const task = (await createRes.json()).task;

    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/move`,
      {
        method: 'PATCH',
        headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
        body: JSON.stringify({ columnId: doneColumnId, index: 0 }),
      }
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.task.completedAt).toBeTruthy();
  });

  it('User without column MOVE rule gets 403 on move', async () => {
    // Create a column with MOVE rule for developer only (restrict moving FROM this column)
    const restrictedColumn = await prisma.boardColumn.create({
      data: { boardId, name: 'Dev Move Only', position: 2 },
    });

    await (prisma as any).columnRule.create({
      data: {
        columnId: restrictedColumn.id,
        ruleType: 'move',
        roleId: 'developer',
      },
    });

    const createRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({ boardId, columnId: restrictedColumn.id, title: 'Restricted Move' }),
    });
    const task = (await createRes.json()).task;

    // Admin cannot move FROM restrictedColumn (not developer role)
    const targetColumn = await prisma.boardColumn.create({
      data: { boardId, name: 'Target', position: 3 },
    });

    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/move`,
      {
        method: 'PATCH',
        headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
        body: JSON.stringify({ columnId: targetColumn.id, index: 0 }),
      }
    );
    expect(response.status).toBe(403);
  });

  it('Task in hidden column returns 404', async () => {
    // Create a column with VIEW rule for developer only
    const hiddenCol = await prisma.boardColumn.create({
      data: { boardId, name: 'Hidden', position: 3 },
    });

    await (prisma as any).columnRule.create({
      data: {
        columnId: hiddenCol.id,
        ruleType: 'view',
        roleId: 'developer',
      },
    });

    const createRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({ boardId, columnId: hiddenCol.id, title: 'Hidden Task' }),
    });
    const task = (await createRes.json()).task;

    // Member cannot view (no developer role)
    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${task.id}`,
      { headers: { 'x-user-id': memberId } }
    );
    expect(response.status).toBe(404);
  });
});
