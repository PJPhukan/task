# UI Guide for cm-task-manager Frontend

Reference guide for building the frontend client.

## Authentication (Better Auth)

### Endpoints
- **Sign up**: `POST /auth/sign-up` → creates PENDING account
- **Sign in**: `POST /auth/sign-in` → requires verified email
- **Sign out**: `POST /auth/sign-out`
- **Verify email**: `GET /auth/verify-email?token=...`
- **Forgot password**: `POST /auth/forgot-password`
- **Reset password**: `POST /auth/reset-password`
- **Accept invite**: `POST /invites/accept` (after validating token at `GET /invites/accept?token=...`)

Sessions are stored as cookies; automatically sent on same-origin requests.

## Account States

Display these UX states:
- `ACCOUNT_PENDING`: Show "Verification pending" message, disable full app access
- `ACCOUNT_REJECTED`: Show "Access denied" message, offer support contact

## Error Format

All error responses use:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {} // Optional: validation details
  }
}
```

Common error codes: `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `VALIDATION_ERROR` (400), `ACCOUNT_PENDING` (403), `ACCOUNT_REJECTED` (403)

## Permissions

Full list of permission keys to check with `perms.user().can(key)`:
- `project.create`, `project.update`, `project.delete`
- `board.create`, `board.update`, `board.delete`
- `column.manage`
- `task.create`, `task.update`, `task.move`, `task.delete`, `task.delete.own`
- `comment.create`, `comment.delete.any`
- `mention.all`
- `attachment.upload`, `attachment.delete.any`
- `label.manage`
- `member.manage`
- `user.manage`
- `role.manage`
- `report.view.all`

Use `GET /api/me` to get current user's permissions in `permissions` array; check locally before making API calls.

## Conventions

**Pagination**: All list endpoints return `{ data: [...], total, page, pageSize }`

**Dates**: Use ISO 8601 format (YYYY-MM-DD for dates, ISO 8601 for timestamps)

**Task Keys**: Format is `{PROJECT_KEY}-{NUMBER}` (e.g., `PROJ-123`); for personal projects, always `ME-{NUMBER}`

## Board Response

GET `/api/projects/:projectId/boards/:boardId` returns:
```json
{
  "board": {
    "id": "board-id",
    "name": "Board Name",
    "columns": [
      {
        "id": "col-id",
        "name": "To Do",
        "position": 0,
        "canMove": true,
        "timeLimitHours": 2,
        "isDone": false
      }
    ]
  }
}
```

- `canMove`: Whether current user can move tasks FROM this column
- `waitingSeconds`: Time task has been in column (on task objects)
- `overLimit`: Task exceeds column time limit (on task objects)
- `bounceCount`: Times task was sent back to previous column (on task objects)

Task move request requires:
```json
{
  "index": 0,
  "reason": "reason_string" // Required only when moving backward to a previous column
}
```

## Columns-Only Endpoint

GET `/api/projects/:projectId/boards/:boardId/columns` returns visible columns with `canMove` flag. Cache locally; use this before fetching full board data.

## Upload Flow

1. Get signature: `POST /api/uploads/signature` → returns `{ signature, timestamp, apiKey, cloudName, folder }`
2. Upload to Cloudinary with signature
3. Save to app: `POST /api/projects/:projectId/tasks/:taskId/attachments` with uploaded file info

## Comments

Nested structure (one level deep):
```json
{
  "id": "comment-id",
  "text": "Comment text",
  "author": { "id": "user-id", "name": "User", "avatarPublicId": "..." },
  "likeCount": 5,
  "likedByMe": true,
  "mentions": [{ "id": "user-id", "name": "User" }],
  "mentionsAll": false,
  "deletedAt": null,
  "replies": [
    {
      "id": "reply-id",
      "text": "Reply text",
      ...
    }
  ]
}
```

Deleted comments show `deletedAt` timestamp; soft-deleted if they have replies.

Mention format in text: `@user-id:user-name` (e.g., `@abc123:John Doe`)

GET `/api/projects/:projectId/tasks/:taskId/mentionable?q=searchterm` returns users who can be mentioned.

## Notifications

Types: `task.created`, `task.assigned`, `task.unassigned`, `task.moved`, `task.sent_back`, `task.over_limit`, `comment.added`, `comment.edited`, `due_date_changed`

Poll `GET /api/notifications/unread-count` every 60 seconds; fetch full list with `GET /api/notifications` (paginated, newest first)

Mark read: `POST /api/notifications/:notificationId/read` or `POST /api/notifications/read-all`

## Queue

GET `/api/me/queue` shows tasks requiring action: tasks in columns with MOVE rules for user's roles, plus assigned tasks. Each includes `queueReason` ("move_rule" or "assigned_to_me"), sorted by `waitingSeconds` (descending).

## Calendar

GET `/api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD` returns tasks with start/due dates.

Optional filters: `projectId`, `boardId`, `assignedToMe=true`

## Search

GET `/api/search?q=searchterm` returns up to 8 results each for tasks, projects, boards (min 2 chars). Respects visibility rules.

## Reports

GET `/api/reports/me` (current user's stats)
GET `/api/reports/users/:userId` (specific user, requires `report.view.all`)
GET `/api/reports/overview` (board overview, requires `report.view.all`)
GET `/api/reports/stage-times` (column timing analysis, requires `report.view.all`)
GET `/api/reports/export?format=xlsx&report=overview` (download)

## Development Seeded Accounts

All with password: `development123`

Emails:
- `admin@example.com` (Admin role)
- `manager@example.com` (Manager role)
- `member@example.com` (Member role)
- `viewer@example.com` (Viewer role)
- `developer@example.com` (Developer role)
- `qa@example.com` (QA role)
- `deployment@example.com` (Deployment role)
