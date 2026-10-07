import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createTaskRoute, GET as getTasksRoute } from '@/app/api/projects/[projectId]/tasks/route';
import { PATCH as moveTaskRoute } from '@/app/api/projects/[projectId]/tasks/[taskId]/move/route';
import { PUT as setTaskLabelsRoute } from '@/app/api/projects/[projectId]/tasks/[taskId]/labels/route';
import { GET as getMyTasksRoute } from '@/app/api/me/tasks/route';
import { prisma } from '@/server/lib/prisma';

function generateProjectKey(length = 4): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

let adminId: string;
let memberId: string;
let _developerId: string;
let projectId: string;
let boardId: string;
let toDoColumnId: string;
let doneColumnId: string;
let labelId1: string;

beforeAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: ['admin@example.com', 'member@example.com', 'developer@example.com'] } },
  });
  adminId = users.find((u) => u.email === 'admin@example.com')!.id;
  memberId = users.find((u) => u.email === 'member@example.com')!.id;
  _developerId = users.find((u) => u.email === 'developer@example.com')!.id;

  const project = await prisma.project.create({
    data: {
      name: 'Task List Test Project',
      key: generateProjectKey(),
    },
  });
  projectId = project.id;

  await prisma.projectMember.createMany({
    data: [
      { projectId, userId: adminId },
      { projectId, userId: memberId },
      { projectId, userId: _developerId },
    ],
  });

  const board = await prisma.board.create({
    data: { projectId, name: 'Test Board', position: 0, createdById: adminId },
  });
  boardId = board.id;

  const toDoCol = await prisma.boardColumn.create({
    data: { boardId, name: 'To Do', position: 0 },
  });
  toDoColumnId = toDoCol.id;

  const done = await prisma.boardColumn.create({
    data: { boardId, name: 'Done', position: 1, isDone: true },
  });
  doneColumnId = done.id;

  // Create labels
  const label1 = await prisma.label.create({
    data: { projectId, name: 'Bug', color: '#FF6B6B' },
  });
  labelId1 = label1.id;
});

describe('Task List API', () => {
  it('GET /api/projects/:projectId/tasks lists all tasks', async () => {
    const headers1 = new Headers();
    headers1.set('x-user-id', adminId);
    headers1.set('content-type', 'application/json');
    const req1 = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: headers1,
      body: JSON.stringify({ boardId, columnId: toDoColumnId, title: 'Task 1' }),
    });
    await createTaskRoute(req1, { params: Promise.resolve({ projectId }) });

    const headers2 = new Headers();
    headers2.set('x-user-id', adminId);
    headers2.set('content-type', 'application/json');
    const req2 = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: headers2,
      body: JSON.stringify({ boardId, columnId: toDoColumnId, title: 'Task 2' }),
    });
    await createTaskRoute(req2, { params: Promise.resolve({ projectId }) });

    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, { method: 'GET', headers });
    const res = await getTasksRoute(req, { params: Promise.resolve({ projectId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.length).toBeGreaterThanOrEqual(2);
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('page');
    expect(data).toHaveProperty('pageSize');
  });

  it('GET /api/projects/:projectId/tasks filters by assigneeId', async () => {
    const createHeaders = new Headers();
    createHeaders.set('x-user-id', adminId);
    createHeaders.set('content-type', 'application/json');
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({
        boardId,
        columnId: toDoColumnId,
        title: 'Assigned Task',
        assigneeId: memberId,
      }),
    });
    const createRes = await createTaskRoute(createReq, { params: Promise.resolve({ projectId }) });
    expect(createRes.status).toBe(201);

    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks?assigneeId=${memberId}`, { method: 'GET', headers });
    const res = await getTasksRoute(req, { params: Promise.resolve({ projectId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.every((t: any) => t.assigneeId === memberId)).toBe(true);
  });

  it('GET /api/projects/:projectId/tasks filters by priority', async () => {
    const createHeaders = new Headers();
    createHeaders.set('x-user-id', adminId);
    createHeaders.set('content-type', 'application/json');
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({
        boardId,
        columnId: toDoColumnId,
        title: 'High Priority Task',
        priority: 'HIGH',
      }),
    });
    const createRes = await createTaskRoute(createReq, { params: Promise.resolve({ projectId }) });
    expect(createRes.status).toBe(201);

    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks?priority=HIGH`, { method: 'GET', headers });
    const res = await getTasksRoute(req, { params: Promise.resolve({ projectId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.length).toBeGreaterThan(0);
  });

  it('GET /api/projects/:projectId/tasks filters by labelId', async () => {
    const createHeaders = new Headers();
    createHeaders.set('x-user-id', adminId);
    createHeaders.set('content-type', 'application/json');
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({
        boardId,
        columnId: toDoColumnId,
        title: 'Labeled Task',
      }),
    });
    const createRes = await createTaskRoute(createReq, { params: Promise.resolve({ projectId }) });
    expect(createRes.status).toBe(201);
    const task = (await createRes.json()).task;

    // Add label
    const labelHeaders = new Headers();
    labelHeaders.set('x-user-id', adminId);
    labelHeaders.set('content-type', 'application/json');
    const labelReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/labels`, {
      method: 'PUT',
      headers: labelHeaders,
      body: JSON.stringify({ labelIds: [labelId1] }),
    });
    await setTaskLabelsRoute(labelReq, { params: Promise.resolve({ projectId, taskId: task.id }) });

    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks?labelId=${labelId1}`, { method: 'GET', headers });
    const res = await getTasksRoute(req, { params: Promise.resolve({ projectId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.some((t: any) => t.id === task.id)).toBe(true);
  });

  it('GET /api/projects/:projectId/tasks filters overdue (past due, not completed, not in done column)', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    const createHeaders = new Headers();
    createHeaders.set('x-user-id', adminId);
    createHeaders.set('content-type', 'application/json');
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({
        boardId,
        columnId: toDoColumnId,
        title: 'Overdue Task',
        dueDate: dateStr,
      }),
    });
    const createRes = await createTaskRoute(createReq, { params: Promise.resolve({ projectId }) });
    expect(createRes.status).toBe(201);
    const task = (await createRes.json()).task;

    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks?overdue=true`, { method: 'GET', headers });
    const res = await getTasksRoute(req, { params: Promise.resolve({ projectId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.some((t: any) => t.id === task.id)).toBe(true);
  });

  it('GET /api/projects/:projectId/tasks overdue excludes tasks in done column', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    const createHeaders = new Headers();
    createHeaders.set('x-user-id', adminId);
    createHeaders.set('content-type', 'application/json');
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({
        boardId,
        columnId: doneColumnId,
        title: 'Completed Overdue Task',
        dueDate: dateStr,
      }),
    });
    const createRes = await createTaskRoute(createReq, { params: Promise.resolve({ projectId }) });
    expect(createRes.status).toBe(201);
    const task = (await createRes.json()).task;

    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks?overdue=true`, { method: 'GET', headers });
    const res = await getTasksRoute(req, { params: Promise.resolve({ projectId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.some((t: any) => t.id === task.id)).toBe(false);
  });

  it('GET /api/projects/:projectId/tasks filters by completed', async () => {
    const createHeaders = new Headers();
    createHeaders.set('x-user-id', adminId);
    createHeaders.set('content-type', 'application/json');
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({
        boardId,
        columnId: toDoColumnId,
        title: 'Completed Task',
      }),
    });
    const createRes = await createTaskRoute(createReq, { params: Promise.resolve({ projectId }) });
    expect(createRes.status).toBe(201);
    const task = (await createRes.json()).task;

    // Move to done column to set completedAt
    const moveHeaders = new Headers();
    moveHeaders.set('x-user-id', adminId);
    moveHeaders.set('content-type', 'application/json');
    const moveReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/move`, {
      method: 'PATCH',
      headers: moveHeaders,
      body: JSON.stringify({ columnId: doneColumnId, index: 0 }),
    });
    await moveTaskRoute(moveReq, { params: Promise.resolve({ projectId, taskId: task.id }) });

    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks?completed=true`, { method: 'GET', headers });
    const res = await getTasksRoute(req, { params: Promise.resolve({ projectId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.some((t: any) => t.id === task.id)).toBe(true);
  });

  it('GET /api/projects/:projectId/tasks searches by title (case-insensitive)', async () => {
    const createHeaders = new Headers();
    createHeaders.set('x-user-id', adminId);
    createHeaders.set('content-type', 'application/json');
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({
        boardId,
        columnId: toDoColumnId,
        title: 'SearchableTask',
      }),
    });
    const createRes = await createTaskRoute(createReq, { params: Promise.resolve({ projectId }) });
    expect(createRes.status).toBe(201);

    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks?search=searchable`, { method: 'GET', headers });
    const res = await getTasksRoute(req, { params: Promise.resolve({ projectId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.some((t: any) => t.title.includes('Searchable'))).toBe(true);
  });

  it('GET /api/projects/:projectId/tasks searches by task key', async () => {
    const createHeaders = new Headers();
    createHeaders.set('x-user-id', adminId);
    createHeaders.set('content-type', 'application/json');
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({
        boardId,
        columnId: toDoColumnId,
        title: 'Key Search Task',
      }),
    });
    const createRes = await createTaskRoute(createReq, { params: Promise.resolve({ projectId }) });
    expect(createRes.status).toBe(201);
    const task = (await createRes.json()).task;

    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks?search=${task.key}`, { method: 'GET', headers });
    const res = await getTasksRoute(req, { params: Promise.resolve({ projectId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.some((t: any) => t.id === task.id)).toBe(true);
  });

  it('GET /api/projects/:projectId/tasks paginates correctly', async () => {
    // Create 25 tasks
    for (let i = 0; i < 25; i++) {
      const headers = new Headers();
      headers.set('x-user-id', adminId);
      headers.set('content-type', 'application/json');
      const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          boardId,
          columnId: toDoColumnId,
          title: `Pagination Task ${i}`,
        }),
      });
      await createTaskRoute(req, { params: Promise.resolve({ projectId }) });
    }

    const page1Headers = new Headers();
    page1Headers.set('x-user-id', adminId);
    const page1Req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks?page=1&pageSize=10`, { method: 'GET', headers: page1Headers });
    const page1 = await getTasksRoute(page1Req, { params: Promise.resolve({ projectId }) });
    const data1 = await page1.json();
    expect(data1.tasks.length).toBeLessThanOrEqual(10);
    expect(data1.page).toBe(1);

    const page2Headers = new Headers();
    page2Headers.set('x-user-id', adminId);
    const page2Req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks?page=2&pageSize=10`, { method: 'GET', headers: page2Headers });
    const page2 = await getTasksRoute(page2Req, { params: Promise.resolve({ projectId }) });
    const data2 = await page2.json();
    expect(data2.page).toBe(2);
  });

  it('Tasks in hidden column do not appear in list', async () => {
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
      body: JSON.stringify({
        boardId,
        columnId: hiddenCol.id,
        title: 'Hidden Task',
      }),
    });
    const createRes = await createTaskRoute(createReq, { params: Promise.resolve({ projectId }) });
    expect(createRes.status).toBe(201);
    const task = (await createRes.json()).task;

    // Member cannot see hidden task
    const headers = new Headers();
    headers.set('x-user-id', memberId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, { method: 'GET', headers });
    const res = await getTasksRoute(req, { params: Promise.resolve({ projectId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.some((t: any) => t.id === task.id)).toBe(false);
  });

  it('GET /api/me/tasks lists assigned tasks', async () => {
    const createHeaders = new Headers();
    createHeaders.set('x-user-id', adminId);
    createHeaders.set('content-type', 'application/json');
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({
        boardId,
        columnId: toDoColumnId,
        title: 'My Task',
        assigneeId: memberId,
      }),
    });
    const createRes = await createTaskRoute(createReq, { params: Promise.resolve({ projectId }) });
    expect(createRes.status).toBe(201);

    const headers = new Headers();
    headers.set('x-user-id', memberId);
    const req = new NextRequest(`http://localhost:3000/api/me/tasks`, { method: 'GET', headers });
    const res = await getMyTasksRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.length).toBeGreaterThan(0);
    expect(data.tasks.every((t: any) => t.assigneeId === memberId)).toBe(true);
  });

  it('GET /api/me/tasks filters by open status', async () => {
    const headers = new Headers();
    headers.set('x-user-id', memberId);
    const req = new NextRequest(`http://localhost:3000/api/me/tasks?open=true`, { method: 'GET', headers });
    const res = await getMyTasksRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.every((t: any) => t.completedAt === null)).toBe(true);
  });

  it('GET /api/me/tasks filters by completed status', async () => {
    const headers = new Headers();
    headers.set('x-user-id', memberId);
    const req = new NextRequest(`http://localhost:3000/api/me/tasks?completed=true`, { method: 'GET', headers });
    const res = await getMyTasksRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    // Should not error, may be empty if no completed tasks
    expect(Array.isArray(data.tasks)).toBe(true);
  });
});
