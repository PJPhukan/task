import "server-only";
import { prisma } from "@/server/lib/prisma";
import { CreateProjectInput, UpdateProjectInput } from "./schema";

export class ProjectService {
  static async createProject(input: CreateProjectInput, createdById: string) {
    return prisma.project.create({
      data: {
        name: input.name,
        key: input.key,
        description: input.description,
        taskCounter: 0,
        members: {
          create: {
            userId: createdById,
          },
        },
      },
      include: {
        members: true,
      },
    });
  }

  static async getProject(projectId: string) {
    return prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });
  }

  static async listProjectsForUser(userId: string, isAdmin: boolean) {
    if (isAdmin) {
      return prisma.project.findMany({
        where: { archivedAt: null },
        include: {
          members: { select: { userId: true } },
        },
      });
    }

    return prisma.project.findMany({
      where: {
        archivedAt: null,
        members: {
          some: { userId },
        },
      },
      include: {
        members: { select: { userId: true } },
      },
    });
  }

  static async updateProject(
    projectId: string,
    input: UpdateProjectInput
  ) {
    return prisma.project.update({
      where: { id: projectId },
      data: {
        name: input.name,
        description: input.description,
        archivedAt: input.archived ? new Date() : null,
      },
    });
  }

  static async deleteOrArchiveProject(projectId: string) {
    const taskCount = await prisma.task.count({
      where: { projectId },
    });

    if (taskCount > 0) {
      // Archive if has tasks
      return prisma.project.update({
        where: { id: projectId },
        data: { archivedAt: new Date() },
      });
    }

    // Hard delete if no tasks
    return prisma.project.delete({
      where: { id: projectId },
    });
  }

  static async addMember(projectId: string, userId: string) {
    return prisma.projectMember.create({
      data: {
        projectId,
        userId,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  static async removeMember(projectId: string, userId: string) {
    return prisma.projectMember.delete({
      where: {
        projectId_userId: { projectId, userId },
      },
    });
  }

  static async isMember(projectId: string, userId: string): Promise<boolean> {
    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
    });
    return member !== null;
  }

  static async listMembers(projectId: string) {
    return prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
