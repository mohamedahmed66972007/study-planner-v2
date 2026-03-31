# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Study Planner — a pure-frontend PWA web app for managing study schedules in Arabic (RTL). All data stored in the browser's **localStorage** — no backend or database needed.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS + Framer Motion
- **Storage**: Browser localStorage (no server/database)
- **PWA**: vite-plugin-pwa (Workbox) — installable, offline-capable

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/               # (legacy, not used in production)
│   └── study-planner-extension/  # React + Vite frontend (Arabic RTL PWA)
│       └── src/
│           ├── lib/storage.ts    # localStorage utilities + data types
│           ├── hooks/use-study.ts # All data hooks (React Query + localStorage)
│           ├── pages/
│           │   ├── home.tsx
│           │   ├── add-subject.tsx
│           │   └── postponed.tsx
│           └── components/
├── lib/                          # (legacy shared libraries, not used)
├── start.sh                      # Starts only the frontend dev server
└── package.json
```

## Study Planner Features

- **Add/Edit Subject**: Choose from fixed subject list (عربي, إنجليزي, رياضيات, etc.), set date, add lessons
- **Time Mode**: Fixed (from/to time) or Duration (with countdown timer)
- **Distribute Time**: Toggle to allocate time per lesson
- **Active Tracking**: Checkboxes per lesson during study session
- **Completed Subjects**: Collapsible section for finished subjects
- **Postponed Lessons**: Incomplete lessons automatically moved to postponed tab
- **Full Arabic RTL UI** with dark purple gradient design

## Data Storage

All data is stored in **localStorage** as JSON:
- `study_subjects` — Array of Subject objects
- `study_postponed` — Array of PostponedLesson objects

Types defined in `artifacts/study-planner-extension/src/lib/storage.ts`

## Development

```bash
bash start.sh
# or directly:
PORT=5000 BASE_PATH=/ pnpm --filter @workspace/study-planner-extension run dev
```

## Render Deployment (Static Site)

- **Service type**: Static Site
- **Build command**: `npm install -g pnpm && pnpm install && PORT=3000 BASE_PATH=/ pnpm --filter @workspace/study-planner-extension run build`
- **Publish directory**: `artifacts/study-planner-extension/dist/public`
- No environment variables needed (no database, no backend)
