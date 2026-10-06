export const permissionCatalog = {
  // Projects
  "project.create": { label: "Create project", group: "Projects" },
  "project.update": { label: "Update project", group: "Projects" },
  "project.delete": { label: "Delete project", group: "Projects" },

  // Boards
  "board.create": { label: "Create board", group: "Boards" },
  "board.update": { label: "Update board", group: "Boards" },
  "board.delete": { label: "Delete board", group: "Boards" },

  // Columns
  "column.manage": { label: "Manage columns", group: "Boards" },

  // Tasks
  "task.create": { label: "Create task", group: "Tasks" },
  "task.update": { label: "Update task", group: "Tasks" },
  "task.move": { label: "Move task", group: "Tasks" },
  "task.delete": { label: "Delete any task", group: "Tasks" },
  "task.delete.own": { label: "Delete own task", group: "Tasks" },

  // Comments
  "comment.create": { label: "Create comment", group: "Comments" },
  "comment.delete.any": { label: "Delete any comment", group: "Comments" },

  // Attachments
  "attachment.upload": { label: "Upload attachment", group: "Comments" },
  "attachment.delete.any": { label: "Delete any attachment", group: "Comments" },

  // Labels
  "label.manage": { label: "Manage labels", group: "Tasks" },

  // Members
  "member.manage": { label: "Manage members", group: "Administration" },

  // Roles
  "role.manage": { label: "Manage roles", group: "Administration" },

  // Users
  "user.manage": { label: "Manage users", group: "Administration" },

  // Reports
  "report.view.all": { label: "View all reports", group: "Reports" },
} as const;

export type Permission = keyof typeof permissionCatalog;

export function getPermissionsByGroup(group: string): Permission[] {
  return Object.entries(permissionCatalog)
    .filter(([, { group: g }]) => g === group)
    .map(([permission]) => permission as Permission);
}

export function getAllGroups(): string[] {
  const groups = new Set(Object.values(permissionCatalog).map(p => p.group));
  return Array.from(groups).sort();
}

export function getCatalogGrouped() {
  const grouped: Record<string, Array<{ permission: Permission; label: string }>> = {};

  for (const [permission, { label, group }] of Object.entries(permissionCatalog)) {
    if (!grouped[group]) {
      grouped[group] = [];
    }
    grouped[group].push({ permission: permission as Permission, label });
  }

  return grouped;
}
