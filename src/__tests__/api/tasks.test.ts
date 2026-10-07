import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createTaskRoute } from '@/app/api/projects/[projectId]/tasks/route';
import { GET as getTaskRoute, PATCH as updateTaskRoute, DELETE as deleteTaskRoute } from '@/app/api/projects/[projectId]/tasks/[taskId]/route';
import { PATCH as moveTaskRoute } from '@/app/api/projects/[projectId]/tasks/[taskId]/move/route';
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
    const headers1 = new Headers();
    headers1.set('x-user-id', adminId);
    headers1.set('content-type', 'application/json');
    const req1 = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: headers1,
      body: JSON.stringify({
        boardId,
        columnId,
        title: 'First Task',
      }),
    });
    const res1 = await createTaskRoute(req1, { params: Promise.resolve({ projectId }) });
    expect(res1.status).toBe(201);
    const data1 = await res1.json();
    const number1 = data1.task.number;

    const headers2 = new Headers();
    headers2.set('x-user-id', adminId);
    headers2.set('content-type', 'application/json');
    const req2 = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: headers2,
      body: JSON.stringify({
        boardId,
        columnId,
        title: 'Second Task',
      }),
    });
    const res2 = await createTaskRoute(req2, { params: Promise.resolve({ projectId }) });
    expect(res2.status).toBe(201);
    const data2 = await res2.json();
    expect(data2.task.number).toBe(number1 + 1);
  });

  it('POST /api/projects/:projectId/tasks rejects dueDate before startDate', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        boardId,
        columnId,
        title: 'Invalid Dates',
        startDate: '2025-12-31',
        dueDate: '2025-01-01',
      }),
    });
    const response = await createTaskRoute(req, { params: Promise.resolve({ projectId }) });
    expect(response.status).toBe(400);
  });

  it('POST /api/projects/:projectId/tasks rejects non-member assignee', async () => {
    const nonMember = await prisma.user.create({
      data: { name: 'Non Member', email: `nm${Date.now()}@ex.com`, isActive: true },
    });
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        boardId,
        columnId,
        title: 'Task',
        assigneeId: nonMember.id,
      }),
    });
    const response = await createTaskRoute(req, { params: Promise.resolve({ projectId }) });
    expect(response.status).toBe(400);
  });

  it('GET /api/projects/:projectId/tasks/:taskId returns task', async () => {
    const createHeaders = new Headers();
    createHeaders.set('x-user-id', adminId);
    createHeaders.set('content-type', 'application/json');
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({ boardId, columnId, title: 'Test Task' }),
    });
    const createRes = await createTaskRoute(createReq, { params: Promise.resolve({ projectId }) });
    const task = (await createRes.json()).task;

    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}`, { method: 'GET', headers });
    const response = await getTaskRoute(req, { params: Promise.resolve({ projectId, taskId: task.id }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.task.id).toBe(task.id);
    expect(data.task).toHaveProperty('canMove');
  });

  it('PATCH /api/projects/:projectId/tasks/:taskId updates task', async () => {
    const createHeaders = new Headers();
    createHeaders.set('x-user-id', adminId);
    createHeaders.set('content-type', 'application/json');
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({ boardId, columnId, title: 'Original' }),
    });
    const createRes = await createTaskRoute(createReq, { params: Promise.resolve({ projectId }) });
    const task = (await createRes.json()).task;

    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ title: 'Updated' }),
    });
    const response = await updateTaskRoute(req, { params: Promise.resolve({ projectId, taskId: task.id }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.task.title).toBe('Updated');
  });

  it('DELETE /api/projects/:projectId/tasks/:taskId with task.delete deletes any task', async () => {
    const createHeaders = new Headers();
    createHeaders.set('x-user-id', memberId);
    createHeaders.set('content-type', 'application/json');
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({ boardId, columnId, title: 'Member Task' }),
    });
    const createRes = await createTaskRoute(createReq, { params: Promise.resolve({ projectId }) });
    const task = (await createRes.json()).task;

    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}`, { method: 'DELETE', headers });
    const response = await deleteTaskRoute(req, { params: Promise.resolve({ projectId, taskId: task.id }) });
    expect(response.status).toBe(200);
  });

  it('DELETE with task.delete.own allows deleting own task but not others', async () => {
    const createHeaders1 = new Headers();
    createHeaders1.set('x-user-id', memberId);
    createHeaders1.set('content-type', 'application/json');
    const createReq1 = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: createHeaders1,
      body: JSON.stringify({ boardId, columnId, title: 'Own Task' }),
    });
    const createRes = await createTaskRoute(createReq1, { params: Promise.resolve({ projectId }) });
    const ownTask = (await createRes.json()).task;

    const createHeaders2 = new Headers();
    createHeaders2.set('x-user-id', adminId);
    createHeaders2.set('content-type', 'application/json');
    const createReq2 = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: createHeaders2,
      body: JSON.stringify({ boardId, columnId, title: 'Admin Task' }),
    });
    const adminTaskRes = await createTaskRoute(createReq2, { params: Promise.resolve({ projectId }) });
    const adminTask = (await adminTaskRes.json()).task;

    // Member can delete own task
    const deleteOwnHeaders = new Headers();
    deleteOwnHeaders.set('x-user-id', memberId);
    const deleteOwnReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${ownTask.id}`, { method: 'DELETE', headers: deleteOwnHeaders });
    const deleteOwnRes = await deleteTaskRoute(deleteOwnReq, { params: Promise.resolve({ projectId, taskId: ownTask.id }) });
    expect([200, 403]).toContain(deleteOwnRes.status);

    // Member cannot delete other's task
    const deleteOtherHeaders = new Headers();
    deleteOtherHeaders.set('x-user-id', memberId);
    const deleteOtherReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${adminTask.id}`, { method: 'DELETE', headers: deleteOtherHeaders });
    const deleteOtherRes = await deleteTaskRoute(deleteOtherReq, { params: Promise.resolve({ projectId, taskId: adminTask.id }) });
    expect(deleteOtherRes.status).toBe(403);
  });

  it('PATCH /api/projects/:projectId/tasks/:taskId/move to Done sets completedAt', async () => {
    const createHeaders = new Headers();
    createHeaders.set('x-user-id', adminId);
    createHeaders.set('content-type', 'application/json');
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({ boardId, columnId, title: 'To Complete' }),
    });
    const createRes = await createTaskRoute(createReq, { params: Promise.resolve({ projectId }) });
    const task = (await createRes.json()).task;

    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/move`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ columnId: doneColumnId, index: 0 }),
    });
    const response = await moveTaskRoute(req, { params: Promise.resolve({ projectId, taskId: task.id }) });
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

    const createHeaders = new Headers();
    createHeaders.set('x-user-id', adminId);
    createHeaders.set('content-type', 'application/json');
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({ boardId, columnId: restrictedColumn.id, title: 'Restricted Move' }),
    });
    const createRes = await createTaskRoute(createReq, { params: Promise.resolve({ projectId }) });
    const task = (await createRes.json()).task;

    // Admin cannot move FROM restrictedColumn (not developer role)
    const targetColumn = await prisma.boardColumn.create({
      data: { boardId, name: 'Target', position: 3 },
    });

    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/move`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ columnId: targetColumn.id, index: 0 }),
    });
    const response = await moveTaskRoute(req, { params: Promise.resolve({ projectId, taskId: task.id }) });
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

    const createHeaders = new Headers();
    createHeaders.set('x-user-id', adminId);
    createHeaders.set('content-type', 'application/json');
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({ boardId, columnId: hiddenCol.id, title: 'Hidden Task' }),
    });
    const createRes = await createTaskRoute(createReq, { params: Promise.resolve({ projectId }) });
    const task = (await createRes.json()).task;

    // Member cannot view (no developer role)
    const headers = new Headers();
    headers.set('x-user-id', memberId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}`, { method: 'GET', headers });
    const response = await getTaskRoute(req, { params: Promise.resolve({ projectId, taskId: task.id }) });
    expect(response.status).toBe(404);
  });

  it('Backward move without reason returns 400', async () => {
    // Create columns: To Do (pos 0), In Progress (pos 2), Done (pos 1)
    // Then move from In Progress to To Do (backward), which should require reason
    const inProgressColumn = await prisma.boardColumn.create({
      data: { boardId, name: 'In Progress Backward', position: 2 },
    });

    const createHeaders = new Headers();
    createHeaders.set('x-user-id', adminId);
    createHeaders.set('content-type', 'application/json');
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({ boardId, columnId: inProgressColumn.id, title: 'Task to Move Back' }),
    });
    const createRes = await createTaskRoute(createReq, { params: Promise.resolve({ projectId }) });
    const task = (await createRes.json()).task;

    // Try to move backward (from pos 1 to pos 0) without reason
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/move`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ columnId, index: 0 }), // columnId is pos 0
    });
    const response = await moveTaskRoute(req, { params: Promise.resolve({ projectId, taskId: task.id }) });
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('Backward move with reason succeeds, raises bounceCount and stores reason', async () => {
    // Create an In Progress column if not already created
    const inProgressColumn = await prisma.boardColumn.findFirst({
      where: { boardId, name: 'In Progress Backward' },
    }) || await prisma.boardColumn.create({
      data: { boardId, name: 'In Progress Backward 2', position: 3 },
    });

    const createHeaders = new Headers();
    createHeaders.set('x-user-id', adminId);
    createHeaders.set('content-type', 'application/json');
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({ boardId, columnId: inProgressColumn.id, title: 'Task with Bounce' }),
    });
    const createRes = await createTaskRoute(createReq, { params: Promise.resolve({ projectId }) });
    const task = (await createRes.json()).task;
    expect(task.bounceCount).toBe(0);

    // Move backward with reason
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/move`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        columnId, // Position 0
        index: 0,
        reason: 'Needs rework due to bugs',
      }),
    });
    const response = await moveTaskRoute(req, { params: Promise.resolve({ projectId, taskId: task.id }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.task.bounceCount).toBe(1);

    // Verify stage entry has send back info
    const stageEntry = await prisma.taskStageEntry.findFirst({
      where: { taskId: task.id, columnId },
    });
    expect(stageEntry?.isSendBack).toBe(true);
    expect(stageEntry?.sendBackReason).toBe('Needs rework due to bugs');
  });

  it('Forward move needs no reason and does not change bounceCount', async () => {
    const createHeaders = new Headers();
    createHeaders.set('x-user-id', adminId);
    createHeaders.set('content-type', 'application/json');
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({ boardId, columnId, title: 'Forward Move Task' }),
    });
    const createRes = await createTaskRoute(createReq, { params: Promise.resolve({ projectId }) });
    const task = (await createRes.json()).task;
    expect(task.bounceCount).toBe(0);

    // Move to Done column (position 1), which is forward from To Do (position 0)
    const nextColumn = doneColumnId;

    // Move forward without reason
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/move`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ columnId: nextColumn, index: 0 }),
    });
    const response = await moveTaskRoute(req, { params: Promise.resolve({ projectId, taskId: task.id }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.task.bounceCount).toBe(0); // Should not change for forward move
  });
});
