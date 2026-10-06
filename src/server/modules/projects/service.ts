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
            role: "admin",
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
          members: { select: { userId: true, role: true } },
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
        members: { select: { userId: true, role: true } },
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

  static async archiveProject(projectId: string) {
    const taskCount = await prisma.task.count({
      where: { projectId },
    });

    if (taskCount > 0) {
      throw new Error("Cannot archive project with existing tasks");
    }

    return prisma.project.update({
      where: { id: projectId },
      data: { archivedAt: new Date() },
    });
  }

  static async addMember(
    projectId: string,
    userId: string,
    role: string
  ) {
    return prisma.projectMember.create({
      data: {
        projectId,
        userId,
        role,
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

  static async getUserRole(
    projectId: string,
    userId: string
  ): Promise<string | null> {
    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
      select: { role: true },
    });
    return member?.role ?? null;
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
