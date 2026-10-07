import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getStagesRoute } from '@/app/api/projects/[projectId]/tasks/[taskId]/stages/route';
import { PATCH as moveTaskRoute } from '@/app/api/projects/[projectId]/tasks/[taskId]/move/route';
import { POST as createTaskRoute } from '@/app/api/projects/[projectId]/tasks/route';
import { prisma } from '@/server/lib/prisma';
import { reseedDatabase } from '@/__tests__/__helpers__/seed';

function generateProjectKey(length = 4): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

let adminId: string;
let projectId: string;
let boardId: string;
let columnId1: string;
let columnId2: string;

beforeAll(async () => {
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@example.com' },
  });
  adminId = admin!.id;

  const project = await prisma.project.create({
    data: {
      name: 'Stage History Test Project',
      key: generateProjectKey(),
    },
  });
  projectId = project.id;

  await prisma.projectMember.create({
    data: { projectId, userId: adminId },
  });

  const board = await prisma.board.create({
    data: { projectId, name: 'Test Board', position: 0, createdById: adminId },
  });
  boardId = board.id;

  const col1 = await prisma.boardColumn.create({
    data: { boardId, name: 'To Do', position: 0 },
  });
  columnId1 = col1.id;

  const col2 = await prisma.boardColumn.create({
    data: { boardId, name: 'In Progress', position: 1 },
  });
  columnId2 = col2.id;
});

afterAll(async () => {
  await reseedDatabase();
});

describe('Stage History API', () => {
  it('GET /api/projects/:projectId/tasks/:taskId/stages returns stage history', async () => {
    const taskHeaders = new Headers();
    taskHeaders.set('x-user-id', adminId);
    taskHeaders.set('content-type', 'application/json');
    const taskReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: taskHeaders,
      body: JSON.stringify({
        boardId,
        columnId: columnId1,
        title: 'Stage Test Task',
      }),
    });
    const taskRes = await createTaskRoute(taskReq, { params: Promise.resolve({ projectId }) });
    expect(taskRes.status).toBe(201);
    const task = (await taskRes.json()).task;

    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/stages`, { method: 'GET', headers });
    const res = await getStagesRoute(req, { params: Promise.resolve({ projectId, taskId: task.id }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.stages)).toBe(true);
    expect(data.stages.length).toBeGreaterThan(0);
  });

  it('Stage history includes task entry info', async () => {
    const taskHeaders = new Headers();
    taskHeaders.set('x-user-id', adminId);
    taskHeaders.set('content-type', 'application/json');
    const taskReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: taskHeaders,
      body: JSON.stringify({
        boardId,
        columnId: columnId1,
        title: 'Stage Info Task',
      }),
    });
    const taskRes = await createTaskRoute(taskReq, { params: Promise.resolve({ projectId }) });
    const task = (await taskRes.json()).task;

    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/stages`, { method: 'GET', headers });
    const res = await getStagesRoute(req, { params: Promise.resolve({ projectId, taskId: task.id }) });
    const data = await res.json();
    const firstStage = data.stages[0];

    expect(firstStage).toHaveProperty('taskId');
    expect(firstStage).toHaveProperty('columnId');
    expect(firstStage).toHaveProperty('columnName');
    expect(firstStage).toHaveProperty('enteredAt');
    expect(firstStage).toHaveProperty('enteredById');
    expect(firstStage).toHaveProperty('enteredBy');
    expect(firstStage).toHaveProperty('durationSeconds');
  });

  it('Stage history returns entries in order', async () => {
    const taskHeaders = new Headers();
    taskHeaders.set('x-user-id', adminId);
    taskHeaders.set('content-type', 'application/json');
    const taskReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: taskHeaders,
      body: JSON.stringify({
        boardId,
        columnId: columnId1,
        title: 'Order Test Task',
      }),
    });
    const taskRes = await createTaskRoute(taskReq, { params: Promise.resolve({ projectId }) });
    const task = (await taskRes.json()).task;

    // Move to next column
    const moveHeaders = new Headers();
    moveHeaders.set('x-user-id', adminId);
    moveHeaders.set('content-type', 'application/json');
    const moveReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/move`, {
      method: 'PATCH',
      headers: moveHeaders,
      body: JSON.stringify({ columnId: columnId2, index: 0 }),
    });
    await moveTaskRoute(moveReq, { params: Promise.resolve({ projectId, taskId: task.id }) });

    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/stages`, { method: 'GET', headers });
    const res = await getStagesRoute(req, { params: Promise.resolve({ projectId, taskId: task.id }) });
    const data = await res.json();

    // Check stages are in chronological order
    for (let i = 1; i < data.stages.length; i++) {
      const prevTime = new Date(data.stages[i - 1].enteredAt).getTime();
      const currTime = new Date(data.stages[i].enteredAt).getTime();
      expect(currTime).toBeGreaterThanOrEqual(prevTime);
    }
  });

  it('Open stage shows elapsed time', async () => {
    const taskHeaders = new Headers();
    taskHeaders.set('x-user-id', adminId);
    taskHeaders.set('content-type', 'application/json');
    const taskReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: taskHeaders,
      body: JSON.stringify({
        boardId,
        columnId: columnId1,
        title: 'Elapsed Time Task',
      }),
    });
    const taskRes = await createTaskRoute(taskReq, { params: Promise.resolve({ projectId }) });
    const task = (await taskRes.json()).task;

    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/stages`, { method: 'GET', headers });
    const res = await getStagesRoute(req, { params: Promise.resolve({ projectId, taskId: task.id }) });
    const data = await res.json();
    const currentStage = data.stages[data.stages.length - 1];

    expect(currentStage.leftAt).toBeNull();
    expect(currentStage.durationSeconds).toBeGreaterThanOrEqual(0);
  });

  it('Closed stage shows actual duration', async () => {
    const taskHeaders = new Headers();
    taskHeaders.set('x-user-id', adminId);
    taskHeaders.set('content-type', 'application/json');
    const taskReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: taskHeaders,
      body: JSON.stringify({
        boardId,
        columnId: columnId1,
        title: 'Closed Stage Task',
      }),
    });
    const taskRes = await createTaskRoute(taskReq, { params: Promise.resolve({ projectId }) });
    const task = (await taskRes.json()).task;

    // Move to next column to close the first stage
    const moveHeaders = new Headers();
    moveHeaders.set('x-user-id', adminId);
    moveHeaders.set('content-type', 'application/json');
    const moveReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/move`, {
      method: 'PATCH',
      headers: moveHeaders,
      body: JSON.stringify({ columnId: columnId2, index: 0 }),
    });
    await moveTaskRoute(moveReq, { params: Promise.resolve({ projectId, taskId: task.id }) });

    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/stages`, { method: 'GET', headers });
    const res = await getStagesRoute(req, { params: Promise.resolve({ projectId, taskId: task.id }) });
    const data = await res.json();
    const firstStage = data.stages[0];

    expect(firstStage.leftAt).not.toBeNull();
    expect(firstStage.leftById).not.toBeNull();
    expect(firstStage.durationSeconds).toBeGreaterThanOrEqual(0);
  });
});
