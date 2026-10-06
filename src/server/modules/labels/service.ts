import "server-only";
import { prisma } from "@/server/lib/prisma";
import { ActivityService } from "@/server/modules/activity/service";

export class LabelService {
  static async getProjectLabels(projectId: string) {
    return prisma.label.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
    });
  }

  static async createLabel(projectId: string, name: string, color: string) {
    // Check if label name already exists in project
    const existing = await prisma.label.findFirst({
      where: { projectId, name },
    });
    if (existing) {
      throw new Error("Label name already exists in this project");
    }

    return prisma.label.create({
      data: { projectId, name, color },
    });
  }

  static async updateLabel(
    projectId: string,
    labelId: string,
    name?: string,
    color?: string
  ) {
    const label = await prisma.label.findFirst({
      where: { id: labelId, projectId },
    });
    if (!label) throw new Error("Label not found");

    const updateData: any = {};

    if (name !== undefined) {
      // Check if new name exists (but allow same name)
      if (name !== label.name) {
        const existing = await prisma.label.findFirst({
          where: { projectId, name },
        });
        if (existing) {
          throw new Error("Label name already exists in this project");
        }
      }
      updateData.name = name;
    }

    if (color !== undefined) {
      updateData.color = color;
    }

    if (Object.keys(updateData).length === 0) {
      return label;
    }

    return prisma.label.update({
      where: { id: labelId },
      data: updateData,
    });
  }

  static async deleteLabel(projectId: string, labelId: string) {
    const label = await prisma.label.findFirst({
      where: { id: labelId, projectId },
    });
    if (!label) throw new Error("Label not found");

    // Delete all task label associations
    await prisma.taskLabel.deleteMany({
      where: { labelId },
    });

    // Delete the label
    await prisma.label.delete({
      where: { id: labelId },
    });
  }

  static async updateTaskLabels(
    projectId: string,
    taskId: string,
    labelIds: string[],
    userId: string
  ) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, projectId },
      include: { labels: { include: { label: true } } },
    });
    if (!task) throw new Error("Task not found");

    // Verify all labels exist in project
    const labels = await prisma.label.findMany({
      where: { projectId, id: { in: labelIds } },
    });
    if (labels.length !== labelIds.length) {
      throw new Error("One or more labels not found");
    }

    // Get old label IDs for activity logging
    const oldLabelIds = task.labels.map((tl) => tl.label.id);

    // Delete old associations
    await prisma.taskLabel.deleteMany({
      where: { taskId },
    });

    // Create new associations
    if (labelIds.length > 0) {
      await prisma.taskLabel.createMany({
        data: labelIds.map((labelId) => ({
          taskId,
          labelId,
        })),
      });
    }

    // Record activity
    if (JSON.stringify(oldLabelIds.sort()) !== JSON.stringify(labelIds.sort())) {
      await ActivityService.recordActivity(projectId, "task.updated", userId, taskId, {
        field: "labels",
        oldLabelIds,
        newLabelIds: labelIds,
      });
    }

    // Return updated task with labels
    return prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        reporter: { select: { id: true, name: true, email: true } },
        labels: { include: { label: true } },
      },
    });
  }
}
