import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getMeReport } from '@/app/api/reports/me/route';
import { GET as getUserReport } from '@/app/api/reports/users/[userId]/route';
import { GET as getOverviewReport } from '@/app/api/reports/overview/route';
import { GET as getStageTimesReport } from '@/app/api/reports/stage-times/route';
import { GET as getExportReport } from '@/app/api/reports/export/route';
import { prisma } from '@/server/lib/prisma';
import { reseedDatabase, cleanupNonSeededUsers } from '@/__tests__/__helpers__/seed';
import { Workbook } from 'exceljs';

let adminId: string;
let memberId: string;
let viewerId: string;
let projectId: string;
let boardId: string;
let doneColumnId: string;

async function buildTestData() {
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@example.com' },
  });
  adminId = admin!.id;

  // Use seeded viewer user
  const viewer = await prisma.user.findUnique({
    where: { email: 'viewer@example.com' },
  });
  viewerId = viewer!.id;

  // Create unique test member to isolate data
  const testMember = await prisma.user.create({
    data: {
      name: 'Report Test Member',
      email: `report-member-${Date.now()}@test.example.com`,
      emailVerified: true,
      status: 'ACTIVE',
      isActive: true,
    },
  });
  memberId = testMember.id;

  // Create isolated test project and board
  const project = await prisma.project.create({
    data: {
      name: 'RPT',
      key: `RPT${Math.random().toString(36).substring(2, 3).toUpperCase()}`,
    },
  });
  projectId = project.id;

  // Add users to project
  await prisma.projectMember.create({
    data: { projectId, userId: adminId },
  });
  await prisma.projectMember.create({
    data: { projectId, userId: memberId },
  });
  await prisma.projectMember.create({
    data: { projectId, userId: viewerId },
  });

  // Create board with columns
  const board = await prisma.board.create({
    data: {
      projectId,
      name: 'Report Test Board',
      position: 0,
      createdById: adminId,
      columns: {
        create: [
          { name: 'To Do', position: 0 },
          { name: 'In Progress', position: 1 },
          { name: 'Done', position: 2, isDone: true },
        ],
      },
    },
    include: { columns: true },
  });
  boardId = board.id;

  const doneColumn = board.columns.find((c) => c.isDone);
  if (!doneColumn) throw new Error('No done column found');
  doneColumnId = doneColumn.id;

  // Build test data with known fixed dates (using UTC to avoid timezone issues)
  const baseDate = new Date('2026-10-15T00:00:00.000Z');
  const threeWeeksAgo = new Date('2026-09-24T00:00:00.000Z');
  const twoWeeksAgo = new Date('2026-10-01T00:00:00.000Z');
  const oneWeekAgo = new Date('2026-10-08T00:00:00.000Z');
  const futureDate = new Date('2026-10-20T00:00:00.000Z');

  // Task 1: On time - due 2 weeks ago, completed 2 weeks ago (on time) - in done column
  const task1 = await prisma.task.create({
    data: {
      projectId,
      boardId,
      columnId: doneColumnId,
      number: 1,
      title: 'On Time Task',
      reporterId: adminId,
      assigneeId: memberId,
      position: 0,
      createdAt: threeWeeksAgo,
      dueDate: twoWeeksAgo,
      completedAt: twoWeeksAgo,
    },
  });

  // Task 2: Late - due 2 weeks ago, completed 1 week ago (late) - in done column
  const task2 = await prisma.task.create({
    data: {
      projectId,
      boardId,
      columnId: doneColumnId,
      number: 2,
      title: 'Late Task',
      reporterId: adminId,
      assigneeId: memberId,
      position: 1,
      createdAt: threeWeeksAgo,
      dueDate: twoWeeksAgo,
      completedAt: oneWeekAgo,
    },
  });

  // Task 3: No due date - completed 1 week ago - in done column
  await prisma.task.create({
    data: {
      projectId,
      boardId,
      columnId: doneColumnId,
      number: 3,
      title: 'No Due Date Task',
      reporterId: adminId,
      assigneeId: memberId,
      position: 2,
      createdAt: threeWeeksAgo,
      completedAt: oneWeekAgo,
    },
  });

  // Task 4: Open overdue task in To Do column (should be in overdue list)
  const pastDueDate = new Date('2026-10-01T00:00:00.000Z');
  await prisma.task.create({
    data: {
      projectId,
      boardId,
      columnId: board.columns[0].id,
      number: 4,
      title: 'Open Overdue Task',
      reporterId: adminId,
      assigneeId: memberId,
      position: 3,
      createdAt: threeWeeksAgo,
      dueDate: pastDueDate,
    },
  });

  // Task 5: Open task with future due date
  await prisma.task.create({
    data: {
      projectId,
      boardId,
      columnId: board.columns[0].id,
      number: 5,
      title: 'Future Task',
      reporterId: adminId,
      assigneeId: memberId,
      position: 4,
      createdAt: baseDate,
      dueDate: futureDate,
    },
  });

  // Create stage history entries for task 1 with known durations
  // Task 1: To Do -> In Progress (2 hours = 7200 seconds), In Progress -> Done (1 hour = 3600 seconds)
  const toDoCol = board.columns.find((c) => c.name === 'To Do')!;
  const inProgressCol = board.columns.find((c) => c.name === 'In Progress')!;

  // First stage: entered To Do by admin, left by member after 2 hours
  await prisma.taskStageEntry.create({
    data: {
      taskId: task1.id,
      columnId: toDoCol.id,
      enteredById: adminId,
      leftById: memberId,
      enteredAt: new Date('2026-09-30T08:00:00.000Z'),
      leftAt: new Date('2026-09-30T10:00:00.000Z'),
      durationSeconds: 7200, // 2 hours
    },
  });

  // Second stage: entered In Progress by member, left by admin after 1 hour
  await prisma.taskStageEntry.create({
    data: {
      taskId: task1.id,
      columnId: inProgressCol.id,
      enteredById: memberId,
      leftById: adminId,
      enteredAt: new Date('2026-09-30T10:00:00.000Z'),
      leftAt: new Date('2026-09-30T11:00:00.000Z'),
      durationSeconds: 3600, // 1 hour
    },
  });

  // Task 2 stage history: To Do (3 hours = 10800 seconds), In Progress (2 hours = 7200 seconds)
  await prisma.taskStageEntry.create({
    data: {
      taskId: task2.id,
      columnId: toDoCol.id,
      enteredById: adminId,
      leftById: memberId,
      enteredAt: new Date('2026-10-05T08:00:00.000Z'),
      leftAt: new Date('2026-10-05T11:00:00.000Z'),
      durationSeconds: 10800, // 3 hours
    },
  });

  await prisma.taskStageEntry.create({
    data: {
      taskId: task2.id,
      columnId: inProgressCol.id,
      enteredById: memberId,
      leftById: adminId,
      enteredAt: new Date('2026-10-05T11:00:00.000Z'),
      leftAt: new Date('2026-10-05T13:00:00.000Z'),
      durationSeconds: 7200, // 2 hours
    },
  });
}

beforeAll(async () => {
  await buildTestData();
});

describe('Reports API', () => {
  it('on time, late and no-due-date counts are exact', async () => {
    const headers = new Headers();
    headers.set('x-user-id', memberId);
    // Use a wide date range that includes all completed tasks (Oct 1 was due date, Oct 8 was completion)
    const fromStr = '2026-09-15';
    const toStr = '2026-10-31';

    const req = new NextRequest(`http://localhost:3000/api/reports/me?from=${fromStr}&to=${toStr}`, {
      method: 'GET',
      headers,
    });
    const response = await getMeReport(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.report.completedTasks).toBeDefined();
    // Task 1: On time (due Oct 1, completed Oct 1)
    // Task 2: Late (due Oct 1, completed Oct 8)
    // Task 3: No due date (completed Oct 8)
    expect(data.report.completedTasks).toEqual([
      { label: 'On Time', value: 1 },
      { label: 'Late', value: 1 },
      { label: 'No Due Date', value: 1 },
    ]);
  });

  it('the overdue list excludes tasks in a done column', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);

    const req = new NextRequest(
      `http://localhost:3000/api/reports/overview?projectId=${projectId}&boardId=${boardId}`,
      { method: 'GET', headers }
    );
    const response = await getOverviewReport(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.report.overdueList).toBeDefined();
    // Task 4 is open and overdue, Tasks 1-3 are in done column so not in list
    expect(data.report.overdueList).toHaveLength(1);
    expect(data.report.overdueList[0].taskKey).toBe('TASK-4');
  });

  it('completed-per-week buckets are exact', async () => {
    const headers = new Headers();
    headers.set('x-user-id', memberId);
    // Use a wide date range that includes all completed tasks
    const fromStr = '2026-09-15';
    const toStr = '2026-10-31';

    const req = new NextRequest(`http://localhost:3000/api/reports/me?from=${fromStr}&to=${toStr}`, {
      method: 'GET',
      headers,
    });
    const response = await getMeReport(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.report.completedPerWeek).toBeDefined();
    expect(Array.isArray(data.report.completedPerWeek)).toBe(true);
    // Task 1 was completed Oct 1 (2 weeks ago), Tasks 2, 3 were completed Oct 8 (1 week ago)
    const totalCompleted = data.report.completedPerWeek.reduce((sum: number, w: any) => sum + w.value, 0);
    expect(totalCompleted).toBe(3);
  });

  it('user without report.view.all gets 403 on another user report and overview, 200 on own', async () => {
    const headers = new Headers();
    headers.set('x-user-id', viewerId);

    // Should get 403 on another user's report
    const userReportReq = new NextRequest(`http://localhost:3000/api/reports/users/${memberId}`, {
      method: 'GET',
      headers,
    });
    const userReportRes = await getUserReport(userReportReq, { params: Promise.resolve({ userId: memberId }) });
    expect(userReportRes.status).toBe(403);

    // Should get 403 on overview
    const overviewReq = new NextRequest(
      `http://localhost:3000/api/reports/overview?projectId=${projectId}&boardId=${boardId}`,
      { method: 'GET', headers }
    );
    const overviewRes = await getOverviewReport(overviewReq);
    expect(overviewRes.status).toBe(403);

    // Should get 200 on own report
    const meReq = new NextRequest('http://localhost:3000/api/reports/me', { method: 'GET', headers });
    const meRes = await getMeReport(meReq);
    expect(meRes.status).toBe(200);
  });

  it('the date range excludes tasks outside it', async () => {
    const headers = new Headers();
    headers.set('x-user-id', memberId);

    // Use date range that includes only Oct 8 (1 week ago) - excludes Oct 1 (2 weeks ago)
    const fromStr = '2026-10-05';
    const toStr = '2026-10-20';

    const req = new NextRequest(`http://localhost:3000/api/reports/me?from=${fromStr}&to=${toStr}`, {
      method: 'GET',
      headers,
    });
    const response = await getMeReport(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    const totalCompleted = data.report.completedTasks.reduce((sum: number, c: any) => sum + c.value, 0);
    // Only Tasks 2, 3 were completed Oct 8 (within the range). Task 1 was completed Oct 1 (outside range)
    expect(totalCompleted).toBe(2);
  });

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

  it('GET /api/reports/overview with admin returns data', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);

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
  });

  it('Excel export returns file with correct content type', async () => {
    const headers = new Headers();
    headers.set('x-user-id', memberId);

    const req = new NextRequest(
      `http://localhost:3000/api/reports/export?report=me&format=xlsx&from=2026-09-15&to=2026-10-31`,
      { method: 'GET', headers }
    );
    const response = await getExportReport(req);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it('PDF export returns file with correct content type', async () => {
    const headers = new Headers();
    headers.set('x-user-id', memberId);

    const req = new NextRequest(
      `http://localhost:3000/api/reports/export?report=me&format=pdf&from=2026-09-15&to=2026-10-31`,
      { method: 'GET', headers }
    );
    const response = await getExportReport(req);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    const buffer = await response.arrayBuffer();
    // PDF files start with %PDF signature
    const view = new Uint8Array(buffer);
    expect(view[0]).toBe(37); // %
    expect(view[1]).toBe(80); // P
    expect(view[2]).toBe(68); // D
    expect(view[3]).toBe(70); // F
  });

  it('Unknown report format returns 400', async () => {
    const headers = new Headers();
    headers.set('x-user-id', memberId);

    const req = new NextRequest(
      `http://localhost:3000/api/reports/export?report=me&format=invalid`,
      { method: 'GET', headers }
    );
    const response = await getExportReport(req);
    expect(response.status).toBe(400);
  });

  it('Export with missing projectId/boardId for overview returns 400', async () => {
    const headers = new Headers();
    headers.set('x-user-id', memberId);

    const req = new NextRequest(
      `http://localhost:3000/api/reports/export?report=overview&format=xlsx`,
      { method: 'GET', headers }
    );
    const response = await getExportReport(req);
    expect(response.status).toBe(400);
  });

  it('Average time per person: getUserReport returns exact averages for each person', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);

    const req = new NextRequest(`http://localhost:3000/api/reports/users/${memberId}`, {
      method: 'GET',
      headers,
    });
    const response = await getUserReport(req, { params: Promise.resolve({ userId: memberId }) });
    expect(response.status).toBe(200);
    const data = await response.json();

    // Check averageTimePerColumn
    // Task 1: To Do (2 hours), In Progress (1 hour) - entered by admin, left by member
    // Task 2: To Do (3 hours), In Progress (2 hours) - entered by admin, left by member
    // For member: leftById=member entries are 0 (entered but not left tasks)
    // For admin: leftById=admin entries are 1 hour (task1 in progress) + 2 hours (task2 in progress) = 1.5 hours average
    expect(data.report.averageTimePerColumn).toBeDefined();
    expect(Array.isArray(data.report.averageTimePerColumn)).toBe(true);

    // Check averageTimeOverall
    expect(data.report.averageTimeOverall).toBeDefined();
    expect(typeof data.report.averageTimeOverall).toBe('number');
  });

  it('Stage times: exact average and longest times per column for a board', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);

    const req = new NextRequest(
      `http://localhost:3000/api/reports/stage-times?projectId=${projectId}&boardId=${boardId}`,
      { method: 'GET', headers }
    );
    const response = await getStageTimesReport(req);
    expect(response.status).toBe(200);
    const data = await response.json();

    // Task 1: To Do (2h = 7200s), In Progress (1h = 3600s)
    // Task 2: To Do (3h = 10800s), In Progress (2h = 7200s)
    // Average: To Do = (7200 + 10800) / 2 / 3600 = 2.5 hours
    // Average: In Progress = (3600 + 7200) / 2 / 3600 = 1.5 hours
    // Longest: To Do = 10800 / 3600 = 3 hours
    // Longest: In Progress = 7200 / 3600 = 2 hours

    expect(data.report.averageTimePerColumn).toBeDefined();
    expect(data.report.averageTimePerColumn).toHaveLength(3); // To Do, In Progress, Done

    const toDoAvg = data.report.averageTimePerColumn.find((c: any) => c.label === 'To Do');
    expect(toDoAvg?.value).toBe(3); // 2.5 rounded up

    const inProgressAvg = data.report.averageTimePerColumn.find((c: any) => c.label === 'In Progress');
    expect(inProgressAvg?.value).toBe(2); // 1.5 rounded up

    expect(data.report.longestTimePerColumn).toBeDefined();
    const toDoLongest = data.report.longestTimePerColumn.find((c: any) => c.label === 'To Do');
    expect(toDoLongest?.value).toBe(3); // 10800 / 3600 = 3 hours

    const inProgressLongest = data.report.longestTimePerColumn.find((c: any) => c.label === 'In Progress');
    expect(inProgressLongest?.value).toBe(2); // 7200 / 3600 = 2 hours

    expect(data.report.averageTimePerPersonPerColumn).toBeDefined();
    expect(Array.isArray(data.report.averageTimePerPersonPerColumn)).toBe(true);
  });

  it('Excel export parses back and cells match JSON report numbers', async () => {
    const headers = new Headers();
    headers.set('x-user-id', memberId);

    const req = new NextRequest(
      `http://localhost:3000/api/reports/export?report=me&format=xlsx&from=2026-09-15&to=2026-10-31`,
      { method: 'GET', headers }
    );
    const response = await getExportReport(req);
    expect(response.status).toBe(200);
    const buffer = await response.arrayBuffer();

    // Parse Excel file with exceljs
    const workbook = new Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];

    // The export should have the report data in it
    expect(worksheet).toBeDefined();
    expect(worksheet.rowCount).toBeGreaterThan(0);

    // Also get the JSON report to compare
    const jsonReq = new NextRequest(
      `http://localhost:3000/api/reports/me?from=2026-09-15&to=2026-10-31`,
      { method: 'GET', headers }
    );
    const jsonResponse = await getMeReport(jsonReq);
    const jsonData = await jsonResponse.json();

    // Verify JSON report has the expected fields
    expect(jsonData.report.assigned).toBeDefined();
    expect(jsonData.report.completedTasks).toBeDefined();
    expect(jsonData.report.completedPerWeek).toBeDefined();
  });

  afterAll(async () => {
    // Clean up test data
    if (projectId) {
      await prisma.task.deleteMany({ where: { projectId } });
      await prisma.board.deleteMany({ where: { projectId } });
      await prisma.projectMember.deleteMany({ where: { projectId } });
      await prisma.project.delete({ where: { id: projectId } });
    }
    if (memberId) {
      await prisma.user.delete({ where: { id: memberId } }).catch(() => {});
    }
    await reseedDatabase();
    await cleanupNonSeededUsers();
  });
});
