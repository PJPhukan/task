import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getMeReport } from '@/app/api/reports/me/route';
import { GET as getUserReport } from '@/app/api/reports/users/[userId]/route';
import { GET as getOverviewReport } from '@/app/api/reports/overview/route';
import { GET as getStageTimesReport } from '@/app/api/reports/stage-times/route';
import { prisma } from '@/server/lib/prisma';
import { reseedDatabase, cleanupNonSeededUsers } from '@/__tests__/__helpers__/seed';

let adminId: string;
let memberId: string;
let projectId: string;
let boardId: string;

beforeAll(async () => {
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@example.com' },
  });
  adminId = admin!.id;

  const member = await prisma.user.findUnique({
    where: { email: 'member@example.com' },
  });
  memberId = member!.id;

  const project = await prisma.project.findFirst();
  if (project) {
    projectId = project.id;
    const board = await prisma.board.findFirst({
      where: { projectId },
    });
    if (board) {
      boardId = board.id;
    }
  }
});

describe('Reports API', () => {
  it('GET /api/reports/me returns report for current user', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest('http://localhost:3000/api/reports/me', { method: 'GET', headers });
    const response = await getMeReport(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.report).toBeDefined();
    expect(data.report.assigned).toBeDefined();
    expect(data.report.assigned).toHaveProperty('open');
    expect(data.report.assigned).toHaveProperty('overdue');
    expect(data.report.assigned).toHaveProperty('completed');
  });

  it('GET /api/reports/me with date range filters tasks', async () => {
    const headers = new Headers();
    headers.set('x-user-id', memberId);
    const from = new Date();
    from.setDate(from.getDate() - 7);
    const to = new Date();
    const fromStr = from.toISOString().split('T')[0];
    const toStr = to.toISOString().split('T')[0];

    const req = new NextRequest(`http://localhost:3000/api/reports/me?from=${fromStr}&to=${toStr}`, {
      method: 'GET',
      headers,
    });
    const response = await getMeReport(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.report).toBeDefined();
  });

  it('GET /api/reports/users/:userId returns report for specific user', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest(`http://localhost:3000/api/reports/users/${memberId}`, {
      method: 'GET',
      headers,
    });
    const response = await getUserReport(req, { params: Promise.resolve({ userId: memberId }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.report).toBeDefined();
  });

  it('User without report.view.all cannot view another user report', async () => {
    const viewer = await prisma.user.findUnique({
      where: { email: 'viewer@example.com' },
    });
    const headers = new Headers();
    headers.set('x-user-id', viewer!.id);
    const req = new NextRequest(`http://localhost:3000/api/reports/users/${memberId}`, {
      method: 'GET',
      headers,
    });
    const response = await getUserReport(req, { params: Promise.resolve({ userId: memberId }) });
    expect(response.status).toBe(403);
  });

  it('GET /api/reports/overview requires report.view.all permission', async () => {
    const viewer = await prisma.user.findUnique({
      where: { email: 'viewer@example.com' },
    });
    const headers = new Headers();
    headers.set('x-user-id', viewer!.id);

    if (projectId && boardId) {
      const req = new NextRequest(
        `http://localhost:3000/api/reports/overview?projectId=${projectId}&boardId=${boardId}`,
        { method: 'GET', headers }
      );
      const response = await getOverviewReport(req);
      expect(response.status).toBe(403);
    }
  });

  it('GET /api/reports/overview with admin returns data', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);

    if (projectId && boardId) {
      const req = new NextRequest(
        `http://localhost:3000/api/reports/overview?projectId=${projectId}&boardId=${boardId}`,
        { method: 'GET', headers }
      );
      const response = await getOverviewReport(req);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.report).toBeDefined();
      expect(data.report.tasksPerColumn).toBeDefined();
      expect(Array.isArray(data.report.tasksPerColumn)).toBe(true);
    }
  });

  it('GET /api/reports/stage-times requires report.view.all permission', async () => {
    const viewer = await prisma.user.findUnique({
      where: { email: 'viewer@example.com' },
    });
    const headers = new Headers();
    headers.set('x-user-id', viewer!.id);

    if (projectId && boardId) {
      const req = new NextRequest(
        `http://localhost:3000/api/reports/stage-times?projectId=${projectId}&boardId=${boardId}`,
        { method: 'GET', headers }
      );
      const response = await getStageTimesReport(req);
      expect(response.status).toBe(403);
    }
  });

  it('GET /api/reports/stage-times with admin returns data', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);

    if (projectId && boardId) {
      const req = new NextRequest(
        `http://localhost:3000/api/reports/stage-times?projectId=${projectId}&boardId=${boardId}`,
        { method: 'GET', headers }
      );
      const response = await getStageTimesReport(req);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.report).toBeDefined();
      expect(data.report.averageTimePerColumn).toBeDefined();
      expect(Array.isArray(data.report.averageTimePerColumn)).toBe(true);
    }
  });

  afterAll(async () => {
    await reseedDatabase();
    await cleanupNonSeededUsers();
  });
});
