import { describe, it, expect, beforeAll } from 'vitest';
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
    await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({ boardId, columnId: toDoColumnId, title: 'Task 1' }),
    });

    await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({ boardId, columnId: toDoColumnId, title: 'Task 2' }),
    });

    const res = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      headers: { 'x-user-id': adminId },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.length).toBeGreaterThanOrEqual(2);
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('page');
    expect(data).toHaveProperty('pageSize');
  });

  it('GET /api/projects/:projectId/tasks filters by assigneeId', async () => {
    const createRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        boardId,
        columnId: toDoColumnId,
        title: 'Assigned Task',
        assigneeId: memberId,
      }),
    });
    expect(createRes.status).toBe(201);

    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks?assigneeId=${memberId}`,
      { headers: { 'x-user-id': adminId } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.every((t: any) => t.assigneeId === memberId)).toBe(true);
  });

  it('GET /api/projects/:projectId/tasks filters by priority', async () => {
    const createRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        boardId,
        columnId: toDoColumnId,
        title: 'High Priority Task',
        priority: 'HIGH',
      }),
    });
    expect(createRes.status).toBe(201);

    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks?priority=HIGH`,
      { headers: { 'x-user-id': adminId } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.length).toBeGreaterThan(0);
  });

  it('GET /api/projects/:projectId/tasks filters by labelId', async () => {
    const createRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        boardId,
        columnId: toDoColumnId,
        title: 'Labeled Task',
      }),
    });
    expect(createRes.status).toBe(201);
    const task = (await createRes.json()).task;

    // Add label
    await fetch(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/labels`, {
      method: 'PUT',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({ labelIds: [labelId1] }),
    });

    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks?labelId=${labelId1}`,
      { headers: { 'x-user-id': adminId } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.some((t: any) => t.id === task.id)).toBe(true);
  });

  it('GET /api/projects/:projectId/tasks filters overdue (past due, not completed, not in done column)', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    const createRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        boardId,
        columnId: toDoColumnId,
        title: 'Overdue Task',
        dueDate: dateStr,
      }),
    });
    expect(createRes.status).toBe(201);
    const task = (await createRes.json()).task;

    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks?overdue=true`,
      { headers: { 'x-user-id': adminId } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.some((t: any) => t.id === task.id)).toBe(true);
  });

  it('GET /api/projects/:projectId/tasks overdue excludes tasks in done column', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    const createRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        boardId,
        columnId: doneColumnId,
        title: 'Completed Overdue Task',
        dueDate: dateStr,
      }),
    });
    expect(createRes.status).toBe(201);
    const task = (await createRes.json()).task;

    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks?overdue=true`,
      { headers: { 'x-user-id': adminId } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.some((t: any) => t.id === task.id)).toBe(false);
  });

  it('GET /api/projects/:projectId/tasks filters by completed', async () => {
    const createRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        boardId,
        columnId: toDoColumnId,
        title: 'Completed Task',
      }),
    });
    expect(createRes.status).toBe(201);
    const task = (await createRes.json()).task;

    // Move to done column to set completedAt
    await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/move`,
      {
        method: 'PATCH',
        headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
        body: JSON.stringify({ columnId: doneColumnId, index: 0 }),
      }
    );

    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks?completed=true`,
      { headers: { 'x-user-id': adminId } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.some((t: any) => t.id === task.id)).toBe(true);
  });

  it('GET /api/projects/:projectId/tasks searches by title (case-insensitive)', async () => {
    const createRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        boardId,
        columnId: toDoColumnId,
        title: 'SearchableTask',
      }),
    });
    expect(createRes.status).toBe(201);

    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks?search=searchable`,
      { headers: { 'x-user-id': adminId } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.some((t: any) => t.title.includes('Searchable'))).toBe(true);
  });

  it('GET /api/projects/:projectId/tasks searches by task key', async () => {
    const createRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        boardId,
        columnId: toDoColumnId,
        title: 'Key Search Task',
      }),
    });
    expect(createRes.status).toBe(201);
    const task = (await createRes.json()).task;

    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks?search=${task.key}`,
      { headers: { 'x-user-id': adminId } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.some((t: any) => t.id === task.id)).toBe(true);
  });

  it('GET /api/projects/:projectId/tasks paginates correctly', async () => {
    // Create 25 tasks
    for (let i = 0; i < 25; i++) {
      await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
        body: JSON.stringify({
          boardId,
          columnId: toDoColumnId,
          title: `Pagination Task ${i}`,
        }),
      });
    }

    const page1 = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks?page=1&pageSize=10`,
      { headers: { 'x-user-id': adminId } }
    );
    const data1 = await page1.json();
    expect(data1.tasks.length).toBeLessThanOrEqual(10);
    expect(data1.page).toBe(1);

    const page2 = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks?page=2&pageSize=10`,
      { headers: { 'x-user-id': adminId } }
    );
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

    const createRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        boardId,
        columnId: hiddenCol.id,
        title: 'Hidden Task',
      }),
    });
    expect(createRes.status).toBe(201);
    const task = (await createRes.json()).task;

    // Member cannot see hidden task
    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks`,
      { headers: { 'x-user-id': memberId } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.some((t: any) => t.id === task.id)).toBe(false);
  });

  it('GET /api/me/tasks lists assigned tasks', async () => {
    const createRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        boardId,
        columnId: toDoColumnId,
        title: 'My Task',
        assigneeId: memberId,
      }),
    });
    expect(createRes.status).toBe(201);

    const res = await fetch(`http://localhost:3000/api/me/tasks`, {
      headers: { 'x-user-id': memberId },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.length).toBeGreaterThan(0);
    expect(data.tasks.every((t: any) => t.assigneeId === memberId)).toBe(true);
  });

  it('GET /api/me/tasks filters by open status', async () => {
    const res = await fetch(`http://localhost:3000/api/me/tasks?open=true`, {
      headers: { 'x-user-id': memberId },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks.every((t: any) => t.completedAt === null)).toBe(true);
  });

  it('GET /api/me/tasks filters by completed status', async () => {
    const res = await fetch(`http://localhost:3000/api/me/tasks?completed=true`, {
      headers: { 'x-user-id': memberId },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    // Should not error, may be empty if no completed tasks
    expect(Array.isArray(data.tasks)).toBe(true);
  });
});
