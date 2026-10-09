# UI Requirements & API Notes

Discrepancies between `docs/UI_GUIDE.md` / `docs/API.md` and the live dev server API responses, plus missing endpoint notes:

## 1. Authentication Endpoints and Payloads (Better Auth)
- **Base path discrepancy**: `docs/UI_GUIDE.md` lists `/auth/sign-in`, `/auth/sign-up`, etc. The live server routes Better Auth under `/api/auth` (e.g. `/api/auth/sign-in/email`, `/api/auth/sign-up/email`, `/api/auth/sign-out`).
- **Error payload format**: `docs/UI_GUIDE.md` specifies that all errors use `{ error: { code: "...", message: "..." } }`. Better Auth authentication endpoints return `{ message: "...", code: "..." }` directly at the top level on 401/403 responses. The frontend auth client handles both structures.
- **Email credential sign-in**: Better Auth requires calling `client.signIn.email({ email, password })` which posts to `/api/auth/sign-in/email`.
- **Password reset request endpoint**: `docs/API.md` lists `POST /api/auth/forgot-password`. In the active Better Auth setup, the route is `POST /api/auth/request-password-reset` with `{ email }`.
- **Password reset execution**: `POST /api/auth/reset-password` accepts `{ token, newPassword }`.
- **Invite accept endpoints**: `GET /api/invites/accept?token=...` validates token and returns `{ email, invitedBy }`. `POST /api/invites/accept` accepts `{ token, name, password }` and creates an active verified user.

## 2. Projects and Boards
- **Project list filtering**: `GET /api/projects` filters to active projects (`archivedAt: null`). Individual project status and details are retrieved with `GET /api/projects/:projectId`.
- **Board column creation**: `POST /api/projects/:projectId/boards` automatically creates three default columns: To Do, In Progress, Done.

## 3. Users and Profiles
- **Users list vs profile**: `GET /api/users` returns active users with `{ id, name, email }`. Complete roles, permissions, projects, and accessible boards are retrieved via `GET /api/users/:userId/profile`.
- **User role replacement**: Updating a user's roles uses `PUT /api/users/:userId/roles` with `{ roleIds: string[] }`.

## 4. Columns and Rules
- **Column rule configuration**: Role view and move rules are managed via `GET` and `PUT /api/projects/:projectId/columns/:columnId/rules` with `{ viewRoleIds, moveRoleIds }`.
- **Column reordering**: Reordering columns uses `PATCH /api/projects/:projectId/boards/:boardId/columns` with `{ columns: [{ id, position }] }`.
- **Column deletion**: Deleting a column with tasks requires `{ targetColumnId }` in `DELETE /api/projects/:projectId/columns/:columnId`.

## 5. Invites
- **Invite list payload**: `GET /api/invites` returns `{ id, email, createdAt, expiresAt, invitedBy, roles }`. Project and board assignments are tracked upon invite creation and applied on acceptance.

## 6. Board and Task Operations
- **Task move payload**: `PATCH /api/projects/:projectId/tasks/:taskId/move` requires `{ columnId, index, reason? }` whereas `docs/UI_GUIDE.md` omitted `columnId`.
- **Column rules endpoint permission**: `GET /api/projects/:projectId/columns/:columnId/rules` requires `column.manage` permission. Users without this permission (such as Developer or Viewer) receive 403 FORBIDDEN; the frontend gracefully falls back and displays column move permissions derived from column flags and cached rules.
- **Board tasks detail**: `GET /api/projects/:projectId/boards/:boardId` supplies ordered tasks with calculated `waitingSeconds` and `overLimit`, but without relational `assignee` object or `labels` array. The UI fetches `GET /api/projects/:projectId/tasks?boardId=:boardId` or maps project users/labels to populate full card metadata (assignee, priority, due date, labels, bounce count).
