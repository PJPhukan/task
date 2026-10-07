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
| GET | /api/me | - | Get current user with roles and permissions (status for non-ACTIVE users) |
| PATCH | /api/me | - | Update own name |

## Join Requests

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | /api/join-requests | user.manage | List PENDING users who verified email, oldest first |
| POST | /api/join-requests/:userId/approve | user.manage | Approve user: set ACTIVE, assign roles/projects/boards, send email |
| POST | /api/join-requests/:userId/reject | user.manage | Reject user: set REJECTED, end sessions, send email |

## Invites

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | /api/invites | user.manage | Create invite: email, roleIds, optional projectIds and boardIds; sends invite email |
| GET | /api/invites | user.manage | List pending invites (not yet accepted or revoked), newest first |
| DELETE | /api/invites/:inviteId | user.manage | Revoke pending invite |
| POST | /api/invites/:inviteId/resend | user.manage | Resend invite: generates new token, extends expiry |
| GET | /api/invites/accept?token=... | - | Validate invite token; returns invited email and inviter name |
| POST | /api/invites/accept | - | Accept invite: token, name, password; creates ACTIVE verified user with granted roles |

## Authentication

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | /api/auth/sign-up | - | Sign up with email and password (creates PENDING account) |
| POST | /api/auth/sign-in | - | Sign in with email and password (requires verified email) |
| POST | /api/auth/sign-out | - | Sign out and clear session |
| POST | /api/auth/forgot-password | - | Request password reset email |
| POST | /api/auth/reset-password | - | Reset password using reset token |
| GET | /api/auth/verify-email | - | Verify email using verification token |

## Permissions

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | /api/permissions | - | List all available permissions (any signed-in user) |

## Dev

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | /api/dev/users | - | List all users (dev mode only, returns 404 in production) |

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
| PATCH | /api/projects/:projectId/boards/:boardId/columns | column.manage | Reorder columns (atomic transaction) |
| PATCH | /api/projects/:projectId/columns/:columnId | column.manage | Rename/recolor/mark as done column, optionally set timeLimitHours (cannot set on done columns) |
| DELETE | /api/projects/:projectId/columns/:columnId | column.manage | Delete column (with targetColumnId to move tasks) |
| PUT | /api/projects/:projectId/columns/:columnId/rules | column.manage | Set column view/move rules by role |

## Tasks

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | /api/projects/:projectId/tasks | task.create | Create task with boardId, columnId, title, etc. |
| GET | /api/projects/:projectId/tasks | - | List tasks with filters (boardId, columnId, assigneeId, reporterId, priority, labelId, dueFrom, dueTo, overdue, completed, search) and pagination |
| GET | /api/projects/:projectId/tasks/:taskId | - | Get task (404 if column not visible to user) |
| PATCH | /api/projects/:projectId/tasks/:taskId | task.update | Update task fields (title, description with mentions, priority, dates, assignee) |
| DELETE | /api/projects/:projectId/tasks/:taskId | task.delete or task.delete.own | Delete task (delete any or only own reported tasks) |
| PATCH | /api/projects/:projectId/tasks/:taskId/move | task.move | Move task to different column with reordering; backward move requires reason parameter |
| PUT | /api/projects/:projectId/tasks/:taskId/labels | task.update | Replace task's label list |
| GET | /api/projects/:projectId/tasks/:taskId/stages | - | Get task stage history with durations |

### Task Response Fields

All task responses include:
- `key`: Task identifier (e.g., "PROJ-123")
- `bounceCount`: Number of times task was sent back to a previous column
- `waitingSeconds`: Seconds task has been in current column
- `overLimit`: Boolean indicating if task exceeds column time limit (if set)

## My Tasks

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | /api/me/tasks | - | List tasks assigned to current user with filters (open, overdue, completed) |
| GET | /api/me/queue | - | Get current user's task queue (includes tasks in columns with MOVE rules for their roles, plus assigned tasks in columns with no MOVE rule). Optionally filter with assignedOnly=true for only tasks assigned to user. Each task includes queueReason ("move_rule" or "assigned_to_me"), sorted by waitingSeconds descending |

## Labels

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | /api/projects/:projectId/labels | - | List project labels |
| POST | /api/projects/:projectId/labels | label.manage | Create label (name, color) |
| PATCH | /api/projects/:projectId/labels/:labelId | label.manage | Update label (name and/or color) |
| DELETE | /api/projects/:projectId/labels/:labelId | label.manage | Delete label |

## Comments

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | /api/projects/:projectId/tasks/:taskId/comments | - | List comments (oldest first, paginated), each with replies nested, likeCount/likedByMe, mentions, mentionsAll |
| POST | /api/projects/:projectId/tasks/:taskId/comments | comment.create | Create comment (optional parentId for replies, one level deep) with mentions |
| GET | /api/projects/:projectId/tasks/:taskId/mentionable | - | Get users who can be mentioned (filtered by q), returns canMentionAll |
| PATCH | /api/projects/:projectId/tasks/:taskId/comments/:commentId | - | Update comment (only author) |
| DELETE | /api/projects/:projectId/tasks/:taskId/comments/:commentId | - | Delete comment (author or comment.delete.any; soft-deletes if has replies) |
| POST | /api/projects/:projectId/tasks/:taskId/comments/:commentId/like | - | Like comment (idempotent) |
| DELETE | /api/projects/:projectId/tasks/:taskId/comments/:commentId/like | - | Unlike comment (idempotent) |
| GET | /api/projects/:projectId/tasks/:taskId/comments/:commentId/likes | - | Get list of users who liked comment (name, avatar) |

## Attachments

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | /api/uploads/signature | attachment.upload | Get signed upload URL (returns signature, timestamp, apiKey, cloudName, folder) |
| GET | /api/projects/:projectId/tasks/:taskId/attachments | - | List attachments with thumbnail and full URLs |
| POST | /api/projects/:projectId/tasks/:taskId/attachments | attachment.upload | Save attachment (validates size, format, folder) |
| DELETE | /api/projects/:projectId/tasks/:taskId/attachments/:attachmentId | - | Delete attachment (uploader or attachment.delete.any) |

## Avatar

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| PUT | /api/me/avatar | - | Update user avatar (validates size, format, folder, deletes old) |

## Activity

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | /api/projects/:projectId/tasks/:taskId/activity | - | Get task activity (newest first, paginated, with actor) |
| GET | /api/projects/:projectId/activity | - | Get project activity (newest first, paginated, filters hidden columns) |

## Notifications

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | /api/notifications | - | List user's notifications (newest first, optional unread filter, paginated) |
| GET | /api/notifications/unread-count | - | Get count of unread notifications |
| POST | /api/notifications/:notificationId/read | - | Mark notification as read |
| POST | /api/notifications/read-all | - | Mark all notifications as read |
| GET | /api/me/notification-settings | - | Get user's notification settings |
| PATCH | /api/me/notification-settings | - | Update user's notification settings (emailEnabled) |

### Notification Types

- `task.created`: Sent to assignee when task is created and assigned
- `task.assigned`: Sent to new assignee when task is reassigned
- `task.unassigned`: Sent to previous assignee when task is unassigned
- `task.moved`: Sent when task is moved to done or to users with MOVE rules for the destination column
- `task.sent_back`: Sent to assignee and to person who moved task forward when task is moved backward with reason
- `task.over_limit`: Sent to assignee and users with MOVE rules for the column when task exceeds column time limit
- `comment.added`: Sent to assignee, reporter, and previous commenters when comment is created
- `comment.edited`: App-only notification sent when comment is edited
- `due_date_changed`: Sent to assignee and reporter when due date is changed

## Reports

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | /api/reports/me | - | Get current user's report (tasks assigned with sent_back_count and over_limit_count, reported, commented, on-time metrics) |
| GET | /api/reports/users/:userId | report.view.all (if viewing another user) | Get specific user's report with sent_back_count and over_limit_count |
| GET | /api/reports/overview | report.view.all | Get board overview (tasks per column, completed per week, overdue list, workload) |
| GET | /api/reports/stage-times | report.view.all | Get stage timing analysis (average/longest times per column and person) |
| GET | /api/reports/export | same as underlying report | Export report as Excel (xlsx) or PDF with query params: report, format, userId, from, to, projectId, boardId |

## Jobs

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | /api/jobs/check-time-limits | Bearer {CRON_SECRET} | Check all columns for tasks over time limits and send notifications; requires CRON_SECRET header (no user session required) |
