import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/server/lib/prisma';

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
      key: `SH${Date.now().toString().slice(-2)}`,
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

describe('Stage History API', () => {
  it('GET /api/projects/:projectId/tasks/:taskId/stages returns stage history', async () => {
    const taskRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        boardId,
        columnId: columnId1,
        title: 'Stage Test Task',
      }),
    });
    expect(taskRes.status).toBe(201);
    const task = (await taskRes.json()).task;

    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/stages`,
      { headers: { 'x-user-id': adminId } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.stages)).toBe(true);
    expect(data.stages.length).toBeGreaterThan(0);
  });

  it('Stage history includes task entry info', async () => {
    const taskRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        boardId,
        columnId: columnId1,
        title: 'Stage Info Task',
      }),
    });
    const task = (await taskRes.json()).task;

    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/stages`,
      { headers: { 'x-user-id': adminId } }
    );
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
    const taskRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        boardId,
        columnId: columnId1,
        title: 'Order Test Task',
      }),
    });
    const task = (await taskRes.json()).task;

    // Move to next column
    await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/move`,
      {
        method: 'PATCH',
        headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
        body: JSON.stringify({ columnId: columnId2, index: 0 }),
      }
    );

    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/stages`,
      { headers: { 'x-user-id': adminId } }
    );
    const data = await res.json();

    // Check stages are in chronological order
    for (let i = 1; i < data.stages.length; i++) {
      const prevTime = new Date(data.stages[i - 1].enteredAt).getTime();
      const currTime = new Date(data.stages[i].enteredAt).getTime();
      expect(currTime).toBeGreaterThanOrEqual(prevTime);
    }
  });

  it('Open stage shows elapsed time', async () => {
    const taskRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        boardId,
        columnId: columnId1,
        title: 'Elapsed Time Task',
      }),
    });
    const task = (await taskRes.json()).task;

    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/stages`,
      { headers: { 'x-user-id': adminId } }
    );
    const data = await res.json();
    const currentStage = data.stages[data.stages.length - 1];

    expect(currentStage.leftAt).toBeNull();
    expect(currentStage.durationSeconds).toBeGreaterThanOrEqual(0);
  });

  it('Closed stage shows actual duration', async () => {
    const taskRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        boardId,
        columnId: columnId1,
        title: 'Closed Stage Task',
      }),
    });
    const task = (await taskRes.json()).task;

    // Move to next column to close the first stage
    await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/move`,
      {
        method: 'PATCH',
        headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
        body: JSON.stringify({ columnId: columnId2, index: 0 }),
      }
    );

    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/stages`,
      { headers: { 'x-user-id': adminId } }
    );
    const data = await res.json();
    const firstStage = data.stages[0];

    expect(firstStage.leftAt).not.toBeNull();
    expect(firstStage.leftById).not.toBeNull();
    expect(firstStage.durationSeconds).toBeGreaterThanOrEqual(0);
  });
});
