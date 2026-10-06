# cm-task-manager

Internal Jira-style task manager — full-stack Next.js application.

## Setup and Development

### Folder Layout

```
cm-task-manager/
├── src/
│   ├── app/
│   │   ├── api/              API routes (backend)
│   │   ├── (pages)/          Page routes (frontend)
│   │   └── layout.tsx
│   ├── components/           Shared UI components
│   ├── features/             Feature-specific components
│   ├── lib/                  Utilities and API client
│   ├── providers/            React providers
│   └── types/                TypeScript types
├── prisma/                   Database schema and migrations
├── docs/                     Documentation
└── CLAUDE.md                 This file
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

# Terminal 2: Full-stack Next.js app (frontend + backend)
npm install
npm run dev
```

App runs on `http://localhost:3000` (frontend and API routes).

## Development Rules

- **No AI attribution in commits:** Git commits must never contain `Co-Authored-By` lines or any AI attribution.
- **Atomic commits:** One commit per finished piece. Keep commits small and focused.
- **Full-stack Next.js architecture:**
  - API routes: `src/app/api/` (backend)
  - Pages and UI: `src/app/` and `src/components/` (frontend)
  - Database: Prisma with PostgreSQL
  - Single app, single dev server on port 3000
- **Database portability:** Keep code portable to MySQL. No Postgres-only column types (arrays, etc.) or raw SQL unless necessary. If required, stop and ask first.
- **Dependency versions:** Never guess versions from memory. Always run `npm view <package> version` for current stable releases.

## Phase: Setup (Initial)

### Completed

- [x] Repo root with git, folders, and root files
- [x] Full-stack Next.js app with shadcn/ui, React Query, form handling
- [x] Prisma setup for PostgreSQL
- [x] PostgreSQL docker-compose configuration

### Next Phases

1. **Backend:** API routes in `src/app/api/`, Prisma models, services
2. **Frontend:** Feature pages, API integration, state management

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
