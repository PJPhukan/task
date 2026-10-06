import "server-only";
import { prisma } from "@/server/lib/prisma";

export class StageService {
  static async getTaskStages(projectId: string, taskId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, projectId },
    });

    if (!task) {
      throw new Error("Task not found");
    }

    const stages = await (prisma as any).taskStageEntry.findMany({
      where: { taskId },
      include: {
        column: { select: { id: true, name: true } },
        enteredBy: { select: { id: true, name: true, email: true } },
        leftBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { enteredAt: "asc" },
    });

    return stages.map((stage: any) => {
      let durationSeconds: number | null = null;
      if (stage.leftAt) {
        durationSeconds = stage.durationSeconds;
      } else {
        // Open stage: calculate elapsed time
        durationSeconds = Math.floor(
          (new Date().getTime() - new Date(stage.enteredAt).getTime()) / 1000
        );
      }

      return {
        id: stage.id,
        taskId: stage.taskId,
        columnId: stage.columnId,
        columnName: stage.column.name,
        enteredAt: stage.enteredAt,
        enteredById: stage.enteredById,
        enteredBy: stage.enteredBy,
        leftAt: stage.leftAt,
        leftById: stage.leftById,
        leftBy: stage.leftBy,
        durationSeconds,
      };
    });
  }
}
