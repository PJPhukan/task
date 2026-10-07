import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getLabelsRoute, POST as createLabelRoute } from '@/app/api/projects/[projectId]/labels/route';
import { PATCH as updateLabelRoute, DELETE as deleteLabelRoute } from '@/app/api/projects/[projectId]/labels/[labelId]/route';
import { PUT as setTaskLabelsRoute } from '@/app/api/projects/[projectId]/tasks/[taskId]/labels/route';
import { POST as createTaskRoute, GET as getTasksRoute } from '@/app/api/projects/[projectId]/tasks/route';
import { GET as getTaskRoute } from '@/app/api/projects/[projectId]/tasks/[taskId]/route';
import { prisma } from '@/server/lib/prisma';

function generateProjectKey(length = 4): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

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
      key: generateProjectKey(),
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
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/labels`, { method: 'GET', headers });
    const res = await getLabelsRoute(req, { params: { projectId } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.labels)).toBe(true);
  });

  it('POST /api/projects/:projectId/labels creates label', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/labels`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Bug', color: '#FF6B6B' }),
    });
    const res = await createLabelRoute(req, { params: { projectId } });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.label.name).toBe('Bug');
    expect(data.label.color).toBe('#FF6B6B');
  });

  it('POST /api/projects/:projectId/labels rejects duplicate names', async () => {
    const headers1 = new Headers();
    headers1.set('x-user-id', adminId);
    headers1.set('content-type', 'application/json');
    const req1 = new NextRequest(`http://localhost:3000/api/projects/${projectId}/labels`, {
      method: 'POST',
      headers: headers1,
      body: JSON.stringify({ name: 'Unique', color: '#FF6B6B' }),
    });
    await createLabelRoute(req1, { params: { projectId } });

    const headers2 = new Headers();
    headers2.set('x-user-id', adminId);
    headers2.set('content-type', 'application/json');
    const req2 = new NextRequest(`http://localhost:3000/api/projects/${projectId}/labels`, {
      method: 'POST',
      headers: headers2,
      body: JSON.stringify({ name: 'Unique', color: '#4ECDC4' }),
    });
    const res = await createLabelRoute(req2, { params: { projectId } });
    expect(res.status).toBe(400);
  });

  it('POST /api/projects/:projectId/labels requires label.manage permission', async () => {
    const headers = new Headers();
    headers.set('x-user-id', memberId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/labels`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Feature', color: '#4ECDC4' }),
    });
    const res = await createLabelRoute(req, { params: { projectId } });
    expect(res.status).toBe(403);
  });

  it('PATCH /api/projects/:projectId/labels/:labelId updates label', async () => {
    const createHeaders = new Headers();
    createHeaders.set('x-user-id', adminId);
    createHeaders.set('content-type', 'application/json');
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/labels`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({ name: 'Update Test', color: '#FF6B6B' }),
    });
    const createRes = await createLabelRoute(createReq, { params: { projectId } });
    const label = (await createRes.json()).label;

    const updateHeaders = new Headers();
    updateHeaders.set('x-user-id', adminId);
    updateHeaders.set('content-type', 'application/json');
    const updateReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/labels/${label.id}`, {
      method: 'PATCH',
      headers: updateHeaders,
      body: JSON.stringify({ name: 'Updated Label', color: '#4ECDC4' }),
    });
    const res = await updateLabelRoute(updateReq, { params: { projectId, labelId: label.id } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.label.name).toBe('Updated Label');
    expect(data.label.color).toBe('#4ECDC4');
  });

  it('DELETE /api/projects/:projectId/labels/:labelId deletes label', async () => {
    const createHeaders = new Headers();
    createHeaders.set('x-user-id', adminId);
    createHeaders.set('content-type', 'application/json');
    const createReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/labels`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({ name: 'Delete Test', color: '#FF6B6B' }),
    });
    const createRes = await createLabelRoute(createReq, { params: { projectId } });
    const label = (await createRes.json()).label;

    const deleteHeaders = new Headers();
    deleteHeaders.set('x-user-id', adminId);
    const deleteReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/labels/${label.id}`, {
      method: 'DELETE',
      headers: deleteHeaders,
    });
    const res = await deleteLabelRoute(deleteReq, { params: { projectId, labelId: label.id } });
    expect(res.status).toBe(200);

    // Verify deleted
    const getHeaders = new Headers();
    getHeaders.set('x-user-id', adminId);
    const getReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/labels`, { method: 'GET', headers: getHeaders });
    const getRes = await getLabelsRoute(getReq, { params: { projectId } });
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

    const taskHeaders = new Headers();
    taskHeaders.set('x-user-id', adminId);
    taskHeaders.set('content-type', 'application/json');
    const taskReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: taskHeaders,
      body: JSON.stringify({
        boardId,
        columnId,
        title: 'Label Task',
      }),
    });
    const taskRes = await createTaskRoute(taskReq, { params: { projectId } });
    const task = (await taskRes.json()).task;

    // Set labels
    const labelsHeaders = new Headers();
    labelsHeaders.set('x-user-id', adminId);
    labelsHeaders.set('content-type', 'application/json');
    const labelsReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/labels`, {
      method: 'PUT',
      headers: labelsHeaders,
      body: JSON.stringify({ labelIds: [label1.id, label2.id] }),
    });
    const res = await setTaskLabelsRoute(labelsReq, { params: { projectId, taskId: task.id } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.task.labels.length).toBe(2);
  });

  it('PUT /api/projects/:projectId/tasks/:taskId/labels records activity', async () => {
    const label1 = await prisma.label.create({
      data: { projectId, name: 'ActivityLabel1', color: '#FF6B6B' },
    });

    const taskHeaders = new Headers();
    taskHeaders.set('x-user-id', adminId);
    taskHeaders.set('content-type', 'application/json');
    const taskReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: taskHeaders,
      body: JSON.stringify({
        boardId,
        columnId,
        title: 'Activity Task',
      }),
    });
    const taskRes = await createTaskRoute(taskReq, { params: { projectId } });
    const task = (await taskRes.json()).task;

    // Add label
    const labelsHeaders = new Headers();
    labelsHeaders.set('x-user-id', adminId);
    labelsHeaders.set('content-type', 'application/json');
    const labelsReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/labels`, {
      method: 'PUT',
      headers: labelsHeaders,
      body: JSON.stringify({ labelIds: [label1.id] }),
    });
    await setTaskLabelsRoute(labelsReq, { params: { projectId, taskId: task.id } });

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

    const taskHeaders = new Headers();
    taskHeaders.set('x-user-id', adminId);
    taskHeaders.set('content-type', 'application/json');
    const taskReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: taskHeaders,
      body: JSON.stringify({
        boardId,
        columnId,
        title: 'Response Task',
      }),
    });
    const taskRes = await createTaskRoute(taskReq, { params: { projectId } });
    const task = (await taskRes.json()).task;

    // Set label
    const labelsHeaders = new Headers();
    labelsHeaders.set('x-user-id', adminId);
    labelsHeaders.set('content-type', 'application/json');
    const labelsReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}/labels`, {
      method: 'PUT',
      headers: labelsHeaders,
      body: JSON.stringify({ labelIds: [label.id] }),
    });
    await setTaskLabelsRoute(labelsReq, { params: { projectId, taskId: task.id } });

    // Get task
    const getHeaders = new Headers();
    getHeaders.set('x-user-id', adminId);
    const getReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/tasks/${task.id}`, { method: 'GET', headers: getHeaders });
    const getRes = await getTaskRoute(getReq, { params: { projectId, taskId: task.id } });
    const data = await getRes.json();
    expect(data.task.labels.some((l: any) => l.id === label.id)).toBe(true);
  });
});
