import "server-only";
import { prisma } from "@/server/lib/prisma";

export class PersonalBoardService {
  static async getOrCreatePersonalBoard(userId: string) {
    // Check if personal project exists
    const existingProject = await prisma.project.findFirst({
      where: {
        ownerId: userId,
        isPersonal: true,
      },
    });

    if (existingProject) {
      // Return existing personal board
      const boards = await prisma.board.findMany({
        where: { projectId: existingProject.id },
        include: {
          columns: {
            orderBy: { position: "asc" },
          },
        },
      });
      const board = boards[0];
      return {
        project: {
          id: existingProject.id,
          name: existingProject.name,
          key: existingProject.key,
          isPersonal: existingProject.isPersonal,
        },
        board: {
          id: board.id,
          name: board.name,
          columns: board.columns,
        },
      };
    }

    // Create new personal project and board
    const uniqueKey = `ME${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    const project = await prisma.project.create({
      data: {
        name: "Personal",
        key: uniqueKey,
        isPersonal: true,
        ownerId: userId,
      },
    });

    // Create board
    const board = await prisma.board.create({
      data: {
        projectId: project.id,
        name: "My board",
        position: 0,
        createdById: userId,
      },
    });

    // Create default columns
    const columnNames = ["To Do", "Doing", "Done"];
    const columns = [];
    for (let i = 0; i < columnNames.length; i++) {
      const column = await prisma.boardColumn.create({
        data: {
          boardId: board.id,
          name: columnNames[i],
          position: i,
          isDone: i === columnNames.length - 1, // Mark "Done" as done column
        },
      });
      columns.push(column);
    }

    return {
      project: {
        id: project.id,
        name: project.name,
        key: project.key,
        isPersonal: project.isPersonal,
      },
      board: {
        id: board.id,
        name: board.name,
        columns,
      },
    };
  }

  static async isPersonalProject(projectId: string): Promise<boolean> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { isPersonal: true },
    });
    return project?.isPersonal ?? false;
  }

  static async canAccessPersonalProject(projectId: string, userId: string): Promise<boolean> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { isPersonal: true, ownerId: true },
    });
    return project?.isPersonal && project?.ownerId === userId ? true : false;
  }

  static async getPersonalProjectIdForUser(userId: string): Promise<string | null> {
    const project = await prisma.project.findFirst({
      where: {
        ownerId: userId,
        isPersonal: true,
      },
      select: { id: true },
    });
    return project?.id || null;
  }
}
