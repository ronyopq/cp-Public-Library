# Public Library Management System

Bangla-first, Cloudflare-native Public Library Management System for community and organizational libraries in Bangladesh.

## Stack

- React 19 + TypeScript + Vite
- Cloudflare Workers + Hono
- Cloudflare D1, KV, R2, Queues, Cron Triggers, Durable Objects
- Mobile-first PWA with offline fallback and installable manifest

## Current modules

- Authentication and RBAC
- Book intake and cataloging
- Member management and ID cards
- Circulation, overdue handling, reminders
- Accounting, receipts, reports, exports
- Public catalog and competitions
- Dashboards, analytics, audit logs, backup/import/export

## Local setup

Prerequisites:

- Node.js 20+
- npm 10+
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

Install and run:

```bash
npm install
npm run icons
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Local URLs:

- Frontend: `http://localhost:5173`
- Worker/API: `http://localhost:8787`

Quality checks:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Key scripts

- `npm run dev`: Vite app + local Worker API
- `npm run db:migrate:local`: apply D1 migrations locally
- `npm run db:seed:local`: apply reference seed data locally
- `npm run db:migrate:remote`: apply remote D1 migrations
- `npm run db:seed:remote`: apply remote seed data
- `npm run deploy`: build and deploy the Worker using `wrangler.jsonc`

## Repository layout

```text
docs/
  adr/
  data-model.md
  role-permission-matrix.md
migrations/
seeds/
shared/
src/
worker/
```

## Cloudflare bindings

The Worker expects these bindings in production:

| Binding | Service | Purpose |
| --- | --- | --- |
| `DB` | D1 | Relational and transactional source of truth |
| `APP_CACHE` | KV | Cache, feature-flag cache, rate limits, lightweight temporary state |
| `MEDIA_BUCKET` | R2 | Covers, photos, scans, receipts, reports, exports |
| `TASK_QUEUE` | Queue | Reminder dispatch, retries, export jobs |
| `ACCESSION_COUNTER` | Durable Object | Concurrency-safe accession sequence generation |
| `ASSETS` | Worker assets | Serves the built frontend from `dist/` |

Runtime vars:

- `APP_NAME_BN`
- `APP_NAME_EN`
- `APP_TIMEZONE`
- `LIBRARY_CODE`
- `DEFAULT_FINE_PER_DAY`
- `AI_BOOK_INTAKE_MODEL`

`wrangler.jsonc` is Worker-native and contains placeholder resource IDs. Replace those placeholders before remote deployment.

## Deployment

1. Create Cloudflare resources:
   - D1 database
   - KV namespace
   - R2 bucket
   - Queue
   - Durable Object migration is already declared in `wrangler.jsonc`
2. Update the placeholder IDs in [wrangler.jsonc](/D:/RONY/OneDrive%20-%20NRDS/CodeX/CX-%20Public%20Library/wrangler.jsonc).
3. Apply remote schema and seed data:

```bash
npm run db:migrate:remote
npm run db:seed:remote
```

4. Deploy:

```bash
npm run deploy
```

For GitHub Actions deployment, set repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The deploy workflow validates with `typecheck`, `lint`, `test`, and `build` before running `wrangler deploy`.

## Canonical docs

- [Architecture](/D:/RONY/OneDrive%20-%20NRDS/CodeX/CX-%20Public%20Library/docs/ARCHITECTURE.md)
- [Architecture Decision Record](/D:/RONY/OneDrive%20-%20NRDS/CodeX/CX-%20Public%20Library/docs/adr/0001-cloudflare-native-foundation.md)
- [Data Model and ERD](/D:/RONY/OneDrive%20-%20NRDS/CodeX/CX-%20Public%20Library/docs/data-model.md)
- [Role Matrix](/D:/RONY/OneDrive%20-%20NRDS/CodeX/CX-%20Public%20Library/docs/role-permission-matrix.md)
- [Deployment Guide](/D:/RONY/OneDrive%20-%20NRDS/CodeX/CX-%20Public%20Library/docs/DEPLOYMENT.md)
- [Cloudflare Bindings Guide](/D:/RONY/OneDrive%20-%20NRDS/CodeX/CX-%20Public%20Library/docs/CLOUDFLARE_DEPLOYMENT.md)
- [Assumptions](/D:/RONY/OneDrive%20-%20NRDS/CodeX/CX-%20Public%20Library/ASSUMPTIONS.md)
- [Progress Log](/D:/RONY/OneDrive%20-%20NRDS/CodeX/CX-%20Public%20Library/TODO.md)
