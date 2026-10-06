# cm-task-manager

Internal Jira-style task manager.

## Setup and Development

### Folder Layout

```
cm-task-manager/
├── api/           Node.js backend (Express, TypeScript, Prisma)
├── web/           Next.js frontend (React, TypeScript, Tailwind)
├── docs/          Documentation (API specs, UI requirements)
└── CLAUDE.md      This file
```

### Running the Project

**Prerequisites:**
- Node.js LTS
- Docker and Docker Compose
- PostgreSQL (via Docker)

**Start the stack:**

```bash
# Terminal 1: Database
docker-compose up

# Terminal 2: Backend API
cd api && npm run dev

# Terminal 3: Frontend
cd web && npm run dev
```

API runs on `http://localhost:4000`, frontend on `http://localhost:3000`.

## Development Rules

- **No AI attribution in commits:** Git commits must never contain `Co-Authored-By` lines or any AI attribution.
- **Atomic commits:** One commit per finished piece. Keep commits small and focused.
- **Phase boundaries:**
  - Setup phase (this phase): Initial project structure only. No database models, features, or screens.
  - Backend phase: Work happens in `api/` on `main` branch (backend tool).
  - Frontend phase: Work happens in `web/` on `ui/*` branches (different tool).
  - **After setup, do not modify `web/` directory in backend work.**
- **Database portability:** Keep the database code portable to MySQL. No Postgres-only column types (arrays, etc.) or raw SQL unless absolutely necessary. If a Postgres-only feature is required, stop and ask first.
- **Check npm for dependency versions:** Never write dependency versions from memory. Always run `npm view <package> version` to get the current stable release before updating.

## Phase: Setup (Initial)

### Completed

- [x] Repo root with git, folders, root files
- [x] api/ with TypeScript, Express, Prisma, Zod, testing setup
- [x] web/ with Next.js, shadcn/ui, React Query, form handling
- [x] Verification: typecheck, lint, test, build, health check

### Next Phases

1. **Backend:** Database models (Prisma schema), API routes, services, authentication
2. **Frontend:** Feature screens, API integration, state management
