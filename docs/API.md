# API Documentation

API specification and endpoint reference for cm-task-manager backend.

## Access Rules

- **Project routes**: User must be a project member AND have the required permission. Admin bypasses membership check.
- **Reading**: Membership only (Viewers can read).
- **Writing**: Specific permission required (project.create, project.update, task.*, etc.)

## Projects

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | /api/projects | project.create | Create project; creator becomes admin member |
| GET | /api/projects | - | List non-archived projects (only owned for non-admins) |
| GET | /api/projects/:id | - | Get project with member list |
| PATCH | /api/projects/:id | project.update | Update project name/description |
| DELETE | /api/projects/:id | project.delete | Archive project (only if no tasks) |

## Project Members

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | /api/projects/:projectId/members | - | List project members |
| POST | /api/projects/:projectId/members | member.manage | Add member to project (with optional boardIds for board access) |
| DELETE | /api/projects/:projectId/members/:userId | member.manage | Remove member from project |

## Roles

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | /api/roles | - | List all roles (any signed-in user) |
| POST | /api/roles | role.manage | Create new role with name and permissions |
| PATCH | /api/roles/:roleId | role.manage | Update role name/permissions |
| DELETE | /api/roles/:roleId | role.manage | Delete role (409 if users assigned without reassignToRoleId) |

## Users

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | /api/users | member.manage | List active users with roles and permissions |
| POST | /api/users | user.manage | Create new user with name, email, roleIds |
| PATCH | /api/users/:userId | user.manage | Update user name/email/isActive |
| PUT | /api/users/:userId/roles | user.manage | Replace user's roles |
| GET | /api/users/:userId/profile | - | Get user profile (name, email, avatar, roles, projects, boards) |
| GET | /api/me | - | Get current user with roles and permissions |
| PATCH | /api/me | - | Update own name |

## Boards

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | /api/projects/:projectId/boards | - | List boards with columns and tasks |
| POST | /api/projects/:projectId/boards | board.create | Create board (auto-creates 3 columns: To Do, In Progress, Done) |
| GET | /api/projects/:projectId/boards/:boardId | - | Get board with columns and tasks in order (kanban-ready) |
| PATCH | /api/projects/:projectId/boards/:boardId | board.update | Rename/reorder board |
| DELETE | /api/projects/:projectId/boards/:boardId | board.delete | Delete board |
| PUT | /api/projects/:projectId/boards/:boardId/access | board.update | Set board access (open or restricted with user/role lists) |

## Columns

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | /api/projects/:projectId/boards/:boardId/columns | - | Get board columns (filtered by view rules, includes canMove) |
| POST | /api/projects/:projectId/boards/:boardId/columns | column.manage | Add column to board |
| PATCH | /api/projects/:projectId/columns/:columnId | column.manage | Rename/recolor/mark as done column |
| DELETE | /api/projects/:projectId/columns/:columnId | column.manage | Delete column (with targetColumnId to move tasks) |
| PATCH | /api/projects/:projectId/boards/:boardId/columns/reorder | column.manage | Reorder columns (atomic transaction) |
| PUT | /api/projects/:projectId/columns/:columnId/rules | column.manage | Set column view/move rules by role |

## Tasks

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | /api/projects/:projectId/tasks | task.create | Create task with boardId, columnId, title, etc. |
| GET | /api/projects/:projectId/tasks | - | List tasks with filters (boardId, columnId, assigneeId, reporterId, priority, labelId, dueFrom, dueTo, overdue, completed, search) and pagination |
| GET | /api/projects/:projectId/tasks/:taskId | - | Get task (404 if column not visible to user) |
| PATCH | /api/projects/:projectId/tasks/:taskId | task.update | Update task fields (title, description, priority, dates, assignee) |
| DELETE | /api/projects/:projectId/tasks/:taskId | task.delete or task.delete.own | Delete task (delete any or only own reported tasks) |
| PATCH | /api/projects/:projectId/tasks/:taskId/move | task.move | Move task to different column with reordering |
| PUT | /api/projects/:projectId/tasks/:taskId/labels | task.update | Replace task's label list |
| GET | /api/projects/:projectId/tasks/:taskId/stages | - | Get task stage history with durations |

## My Tasks

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | /api/me/tasks | - | List tasks assigned to current user with filters (open, overdue, completed) |

## Labels

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | /api/projects/:projectId/labels | - | List project labels |
| POST | /api/projects/:projectId/labels | label.manage | Create label (name, color) |
| PATCH | /api/projects/:projectId/labels/:labelId | label.manage | Update label (name and/or color) |
| DELETE | /api/projects/:projectId/labels/:labelId | label.manage | Delete label |
