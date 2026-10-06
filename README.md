# cm-task-manager

An internal Jira-style task manager — full-stack Next.js application for team collaboration and project tracking.

## Project Structure

Full-stack Next.js app with:
- **src/app/api/** — Backend API routes
- **src/app/(pages)/** — Frontend pages
- **src/components/** — UI components with shadcn/ui
- **prisma/** — Database schema and migrations
- **docs/** — API documentation and UI requirements

## Prerequisites

- Node.js 22.22.2 (managed via `.nvmrc`)
- Docker and Docker Compose
- PostgreSQL (runs in Docker)

## Quick Start

### 1. Start the database

```bash
docker-compose up
```

PostgreSQL runs on port 5432.

### 2. Install dependencies and run the app

```bash
npm install
npm run dev
```

Full-stack app runs on `http://localhost:3000`
- Frontend: Pages and UI
- Backend: API routes at `/api/*`

## Available Scripts

- `npm run dev` — Start dev server (frontend + backend)
- `npm run build` — Production build
- `npm run start` — Start production server
- `npm run lint` — Lint code (ESLint)
- `npm run test` — Run tests (Vitest)
- `npm run db:migrate` — Run Prisma migrations
- `npm run db:seed` — Seed database (if seed.ts exists)

## Environment Variables

Create a `.env.local` file:

```env
DATABASE_URL=postgresql://task_user:dev_password@localhost:5432/cm_task_manager
TEST_DATABASE_URL=postgresql://task_user:dev_password@localhost:5432/cm_task_manager_test
NEXT_PUBLIC_API_URL=http://localhost:3000
```

See `.env.example` for all options.

## Documentation

- **docs/API.md** — API specification and endpoints
- **docs/UI_NEEDS.md** — UI requirements and mockups
