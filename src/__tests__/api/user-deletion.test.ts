import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/lib/prisma';
import { reseedDatabase, cleanupNonSeededUsers } from '@/__tests__/__helpers__/seed';

let testUserId: string;
let projectId: string;
let boardId: string;
let columnId: string;
let taskId: string;

beforeAll(async () => {
  // Create a test user
  const testUser = await prisma.user.create({
    data: {
      name: 'Test User for Deletion',
      email: `user-deletion-test-${Date.now()}@example.com`,
      emailVerified: true,
      isActive: true,
      status: 'ACTIVE',
    },
  });
  testUserId = testUser.id;

  // Create a project
  const randomKey = Math.random().toString(36).substring(2, 5).toUpperCase();
  const project = await prisma.project.create({
    data: {
      name: 'Test Project',
      key: `TP${randomKey}`,
      description: 'Project created by test user',
    },
  });
  projectId = project.id;

  // Create a board
  const board = await prisma.board.create({
    data: {
      projectId,
      name: 'Test Board',
      description: 'Board created by test user',
      position: 0,
      createdById: testUserId,
    },
  });
  boardId = board.id;

  // Create a default column
  const column = await prisma.boardColumn.create({
    data: {
      boardId,
      name: 'To Do',
      position: 0,
      isDone: false,
    },
  });
  columnId = column.id;

  // Create a task
  const task = await prisma.task.create({
    data: {
      projectId,
      boardId,
      columnId,
      number: 1,
      title: 'Test Task',
      description: 'Task created by test user',
      reporterId: testUserId,
      position: 0,
    },
  });
  taskId = task.id;

  // Create a stage entry
  await prisma.taskStageEntry.create({
    data: {
      taskId,
      columnId,
      enteredById: testUserId,
    },
  });

  // Create an activity log entry
  await prisma.activityLog.create({
    data: {
      projectId,
      taskId,
      actorId: testUserId,
      action: 'task.created',
      meta: { title: 'Test Task' },
    },
  });
});

describe('User Deletion and Cascade Behavior', () => {
  it('Deleting a user preserves their created boards with null createdBy', async () => {
    // Verify board exists and is created by the test user
    const boardBefore = await prisma.board.findUnique({
      where: { id: boardId },
      include: { createdBy: true },
    });

    expect(boardBefore).toBeDefined();
    expect(boardBefore!.name).toBe('Test Board');
    expect(boardBefore!.createdById).toBe(testUserId);
    expect(boardBefore!.createdBy?.id).toBe(testUserId);

    // Delete the test user
    await prisma.user.delete({
      where: { id: testUserId },
    });

    // Board should still exist but createdBy should be null and createdById should be null
    const boardAfter = await prisma.board.findUnique({
      where: { id: boardId },
      include: { createdBy: true },
    });

    expect(boardAfter).toBeDefined();
    expect(boardAfter!.name).toBe('Test Board');
    expect(boardAfter!.createdById).toBeNull();
    expect(boardAfter!.createdBy).toBeNull();
  });

  it('Deleting a user preserves task reporting history', async () => {
    // Create a new user for this test
    const newUser = await prisma.user.create({
      data: {
        name: 'Another Test User',
        email: `another-test-${Date.now()}@example.com`,
        emailVerified: true,
        isActive: true,
        status: 'ACTIVE',
      },
    });

    // Create a task with this user as reporter
    const newTask = await prisma.task.create({
      data: {
        projectId,
        boardId,
        columnId,
        number: 2,
        title: 'Another Task',
        reporterId: newUser.id,
        position: 1,
      },
    });

    // Verify task exists with a reporter
    let task = await prisma.task.findUnique({
      where: { id: newTask.id },
      include: { reporter: true },
    });
    expect(task).toBeDefined();
    expect(task!.reporterId).toBe(newUser.id);
    expect(task!.reporter?.id).toBe(newUser.id);

    // Delete the user
    await prisma.user.delete({
      where: { id: newUser.id },
    });

    // Task should still exist but reporter should be null
    task = await prisma.task.findUnique({
      where: { id: newTask.id },
      include: { reporter: true },
    });
    expect(task).toBeDefined();
    expect(task!.title).toBe('Another Task');
    expect(task!.reporterId).toBeNull();
    expect(task!.reporter).toBeNull();
  });

  it('Deleting a user preserves activity log entries with null actor', async () => {
    // Create a new user and activity for this test
    const newUser = await prisma.user.create({
      data: {
        name: 'Activity Test User',
        email: `activity-test-${Date.now()}@example.com`,
        emailVerified: true,
        isActive: true,
        status: 'ACTIVE',
      },
    });

    const newActivity = await prisma.activityLog.create({
      data: {
        projectId,
        actorId: newUser.id,
        action: 'task.updated',
        meta: { field: 'title' },
      },
    });

    // Verify activity has the new user as actor
    let activity = await prisma.activityLog.findUnique({
      where: { id: newActivity.id },
      include: { actor: true },
    });
    expect(activity!.actorId).toBe(newUser.id);
    expect(activity!.actor?.id).toBe(newUser.id);

    // Delete the user
    await prisma.user.delete({
      where: { id: newUser.id },
    });

    // Activity should still exist but actor should be null
    activity = await prisma.activityLog.findUnique({
      where: { id: newActivity.id },
      include: { actor: true },
    });
    expect(activity).toBeDefined();
    expect(activity!.actorId).toBeNull();
    expect(activity!.actor).toBeNull();
  });

  it('Deleting a user preserves task stage entries with null enteredBy', async () => {
    // Create a new user and stage entry for this test
    const newUser = await prisma.user.create({
      data: {
        name: 'Stage Entry Test User',
        email: `stage-test-${Date.now()}@example.com`,
        emailVerified: true,
        isActive: true,
        status: 'ACTIVE',
      },
    });

    const newStageEntry = await prisma.taskStageEntry.create({
      data: {
        taskId,
        columnId,
        enteredById: newUser.id,
      },
    });

    // Verify stage entry has the new user
    let stageEntry = await prisma.taskStageEntry.findUnique({
      where: { id: newStageEntry.id },
      include: { enteredBy: true },
    });
    expect(stageEntry!.enteredById).toBe(newUser.id);
    expect(stageEntry!.enteredBy?.id).toBe(newUser.id);

    // Delete the user
    await prisma.user.delete({
      where: { id: newUser.id },
    });

    // Stage entry should still exist but enteredBy should be null
    stageEntry = await prisma.taskStageEntry.findUnique({
      where: { id: newStageEntry.id },
      include: { enteredBy: true },
    });
    expect(stageEntry).toBeDefined();
    expect(stageEntry!.enteredById).toBeNull();
    expect(stageEntry!.enteredBy).toBeNull();
  });

  afterAll(async () => {
    await reseedDatabase();
    await cleanupNonSeededUsers();
  });
});
