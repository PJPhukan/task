# cm-task-manager

An internal Jira-style task manager for team collaboration and project tracking.

## Project Structure

- **api/** — Node.js + Express backend with TypeScript
- **web/** — Next.js frontend with React and TypeScript
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

This starts PostgreSQL for development and testing, with named volumes for persistence.

### 2. Start the backend API

```bash
cd api
npm install
npm run dev
```

Runs on `http://localhost:4000`. Health check: `curl http://localhost:4000/health`

### 3. Start the frontend

```bash
cd web
npm install
npm run dev
```

Runs on `http://localhost:3000`.

## Available Scripts

### API (`api/`)

- `npm run dev` — Start dev server with watch mode (tsx)
- `npm run build` — TypeScript build
- `npm run start` — Run compiled server
- `npm run test` — Run tests (Vitest)
- `npm run lint` — Lint code (ESLint)
- `npm run typecheck` — Full TypeScript check
- `npm run db:migrate` — Run Prisma migrations
- `npm run db:seed` — Seed database (if script exists)

### Web (`web/`)

- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run start` — Start production server
- `npm run lint` — Lint code (ESLint)

## Environment Variables

See `.env.example` in each directory.

### API `.env`

```env
DATABASE_URL=postgresql://user:password@localhost:5432/cm_task_manager
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/cm_task_manager_test
PORT=4000
AUTH_MODE=dev
WEB_ORIGIN=http://localhost:3000
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### Web `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Documentation

- **docs/API.md** — API specification and endpoints
- **docs/UI_NEEDS.md** — UI requirements and mockups
