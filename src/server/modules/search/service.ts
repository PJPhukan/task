import "server-only";
import { prisma } from "@/server/lib/prisma";
import { ColumnRulesService } from "@/server/modules/columns/rules-service";
import { getPerms, setupPermissions } from "@/server/lib/permly";

interface SearchResult {
  tasks: Array<{
    key: string;
    title: string;
    projectName: string;
  }>;
  projects: Array<{
    id: string;
    name: string;
  }>;
  boards: Array<{
    id: string;
    name: string;
    projectName: string;
  }>;
}

const MAX_RESULTS_PER_GROUP = 8;

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

export class SearchService {
  private static async canAccessBoard(userId: string, boardId: string, isOpen: boolean): Promise<boolean> {
    // Open boards are accessible to all project members
    if (isOpen) {
      return true;
    }

    // Restricted boards require explicit access
    const hasAccess = await prisma.boardAccess.findUnique({
      where: {
        boardId_userId: { boardId, userId },
      },
    });
    return !!hasAccess;
  }

  static async search(userId: string, query: string): Promise<SearchResult> {
    const perms = getPerms();
    await setupPermissions();
    const userRoles = await perms.user(userId).getRoles();

    const result: SearchResult = {
      tasks: [],
      projects: [],
      boards: [],
    };

    // Get user's projects (for non-admins, only member projects)
    const isAdmin = await perms.user(userId).hasRole("admin");
    const projects = await prisma.project.findMany({
      where: isAdmin ? { archivedAt: null } : { archivedAt: null, members: { some: { userId } } },
    });

    // Search projects
    const matchingProjects = projects.filter((p) => matchesQuery(p.name, query));
    result.projects = matchingProjects.slice(0, MAX_RESULTS_PER_GROUP).map((p) => ({
      id: p.id,
      name: p.name,
    }));

    // Get accessible boards
    const allBoards = await prisma.board.findMany({
      where: { projectId: { in: projects.map((p) => p.id) } },
      include: { project: { select: { name: true } } },
    });

    const accessibleBoards = [];
    for (const board of allBoards) {
      // Check board-level access first
      const hasBoardAccess = await this.canAccessBoard(userId, board.id, board.isOpen);
      if (!hasBoardAccess) continue;

      // Check if user can view at least one column
      const columns = await prisma.boardColumn.findMany({ where: { boardId: board.id } });
      let hasColumnAccess = false;
      for (const col of columns) {
        const canView = await ColumnRulesService.canViewColumn(userRoles, col.id);
        if (canView) {
          hasColumnAccess = true;
          break;
        }
      }
      if (hasColumnAccess && matchesQuery(board.name, query)) {
        accessibleBoards.push(board);
      }
    }
    result.boards = accessibleBoards.slice(0, MAX_RESULTS_PER_GROUP).map((b) => ({
      id: b.id,
      name: b.name,
      projectName: b.project.name,
    }));

    // Search tasks
    const tasks = await prisma.task.findMany({
      where: { projectId: { in: projects.map((p) => p.id) } },
      include: {
        project: { select: { key: true, name: true } },
        column: { select: { id: true } },
        board: { select: { id: true, isOpen: true } },
      },
    });

    const accessibleTasks = [];
    for (const task of tasks) {
      // Check board-level access
      const hasBoardAccess = await this.canAccessBoard(userId, task.board.id, task.board.isOpen);
      if (!hasBoardAccess) continue;

      // Check column-level access
      const canView = await ColumnRulesService.canViewColumn(userRoles, task.column.id);
      if (!canView) continue;

      const key = `${task.project.key}-${task.number}`;
      if (matchesQuery(task.title, query) || matchesQuery(key, query)) {
        accessibleTasks.push({
          key,
          title: task.title,
          projectName: task.project.name,
        });
      }
    }
    result.tasks = accessibleTasks.slice(0, MAX_RESULTS_PER_GROUP);

    return result;
  }
}
