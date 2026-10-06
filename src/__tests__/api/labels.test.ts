import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/server/lib/prisma';

let adminId: string;
let managerId: string;
let memberId: string;
let projectId: string;
let boardId: string;
let columnId: string;

beforeAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: ['admin@example.com', 'manager@example.com', 'member@example.com'] } },
  });
  adminId = users.find((u) => u.email === 'admin@example.com')!.id;
  managerId = users.find((u) => u.email === 'manager@example.com')!.id;
  memberId = users.find((u) => u.email === 'member@example.com')!.id;

  const project = await prisma.project.create({
    data: {
      name: 'Label Test Project',
      key: `LB${Math.random().toString(36).substr(2, 3).toUpperCase()}`,
    },
  });
  projectId = project.id;

  await prisma.projectMember.createMany({
    data: [
      { projectId, userId: adminId },
      { projectId, userId: managerId },
      { projectId, userId: memberId },
    ],
  });

  const board = await prisma.board.create({
    data: { projectId, name: 'Test Board', position: 0, createdById: adminId },
  });
  boardId = board.id;

  const col = await prisma.boardColumn.create({
    data: { boardId, name: 'To Do', position: 0 },
  });
  columnId = col.id;
});

describe('Labels API', () => {
  it('GET /api/projects/:projectId/labels lists labels', async () => {
    const res = await fetch(`http://localhost:3000/api/projects/${projectId}/labels`, {
      headers: { 'x-user-id': adminId },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.labels)).toBe(true);
  });

  it('POST /api/projects/:projectId/labels creates label', async () => {
    const res = await fetch(`http://localhost:3000/api/projects/${projectId}/labels`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Bug', color: '#FF6B6B' }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.label.name).toBe('Bug');
    expect(data.label.color).toBe('#FF6B6B');
  });

  it('POST /api/projects/:projectId/labels rejects duplicate names', async () => {
    await fetch(`http://localhost:3000/api/projects/${projectId}/labels`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Unique', color: '#FF6B6B' }),
    });

    const res = await fetch(`http://localhost:3000/api/projects/${projectId}/labels`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Unique', color: '#4ECDC4' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/projects/:projectId/labels requires label.manage permission', async () => {
    const res = await fetch(`http://localhost:3000/api/projects/${projectId}/labels`, {
      method: 'POST',
      headers: { 'x-user-id': memberId, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Feature', color: '#4ECDC4' }),
    });
    expect(res.status).toBe(403);
  });

  it('PATCH /api/projects/:projectId/labels/:labelId updates label', async () => {
    const createRes = await fetch(`http://localhost:3000/api/projects/${projectId}/labels`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Update Test', color: '#FF6B6B' }),
    });
    const label = (await createRes.json()).label;

    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/labels/${label.id}`,
      {
        method: 'PATCH',
        headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Label', color: '#4ECDC4' }),
      }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.label.name).toBe('Updated Label');
    expect(data.label.color).toBe('#4ECDC4');
  });

  it('DELETE /api/projects/:projectId/labels/:labelId deletes label', async () => {
    const createRes = await fetch(`http://localhost:3000/api/projects/${projectId}/labels`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Delete Test', color: '#FF6B6B' }),
    });
    const label = (await createRes.json()).label;

    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/labels/${label.id}`,
      { method: 'DELETE', headers: { 'x-user-id': adminId } }
    );
    expect(res.status).toBe(200);

    // Verify deleted
    const getRes = await fetch(`http://localhost:3000/api/projects/${projectId}/labels`, {
      headers: { 'x-user-id': adminId },
    });
    const data = await getRes.json();
    expect(data.labels.some((l: any) => l.id === label.id)).toBe(false);
  });

  it('PUT /api/projects/:projectId/tasks/:taskId/labels replaces labels', async () => {
    const label1 = await prisma.label.create({
      data: { projectId, name: 'Label1', color: '#FF6B6B' },
    });
    const label2 = await prisma.label.create({
      data: { projectId, name: 'Label2', color: '#4ECDC4' },
    });

    const taskRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        boardId,
        columnId,
        title: 'Label Task',
      }),
    });
    const task = (await taskRes.json()).task;

    // Set labels
    const res = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/labels`,
      {
        method: 'PUT',
        headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
        body: JSON.stringify({ labelIds: [label1.id, label2.id] }),
      }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.task.labels.length).toBe(2);
  });

  it('PUT /api/projects/:projectId/tasks/:taskId/labels records activity', async () => {
    const label1 = await prisma.label.create({
      data: { projectId, name: 'ActivityLabel1', color: '#FF6B6B' },
    });

    const taskRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        boardId,
        columnId,
        title: 'Activity Task',
      }),
    });
    const task = (await taskRes.json()).task;

    // Add label
    await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/labels`,
      {
        method: 'PUT',
        headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
        body: JSON.stringify({ labelIds: [label1.id] }),
      }
    );

    // Check activity was recorded
    const activities = await prisma.activityLog.findMany({
      where: { taskId: task.id },
    });
    expect(activities.some((a) => a.action === 'task.updated')).toBe(true);
  });

  it('Task responses include labels', async () => {
    const label = await prisma.label.create({
      data: { projectId, name: 'ResponseLabel', color: '#FF6B6B' },
    });

    const taskRes = await fetch(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
      body: JSON.stringify({
        boardId,
        columnId,
        title: 'Response Task',
      }),
    });
    const task = (await taskRes.json()).task;

    // Set label
    await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/labels`,
      {
        method: 'PUT',
        headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
        body: JSON.stringify({ labelIds: [label.id] }),
      }
    );

    // Get task
    const getRes = await fetch(
      `http://localhost:3000/api/projects/${projectId}/tasks/${task.id}`,
      { headers: { 'x-user-id': adminId } }
    );
    const data = await getRes.json();
    expect(data.task.labels.some((l: any) => l.id === label.id)).toBe(true);
  });
});
