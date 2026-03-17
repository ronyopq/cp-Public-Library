# Public Library Management System

Bangla-first, Cloudflare-native Public Library Management System for community and organizational libraries in Bangladesh.

## Stack

- React 19 + TypeScript + Vite
- Cloudflare Workers + Hono
- Cloudflare D1, KV, R2, Queues, Cron Triggers, Durable Objects
- Mobile-first PWA with offline fallback and installable manifest

## Modules in scope

- Authentication and RBAC
- Book cataloging with AI-assisted intake review
- Copy and accession management
- Barcode, QR, label, and member card printing
- Members, circulation, overdue handling, reminders
- Public online catalog
- Accounts, dues, fines, receipts, reports
- Competition registration and result publication
- Super admin settings, feature flags, audit trails, backup/export/import

## Quick start

```bash
npm install
npm run icons
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Open:

- App: `http://localhost:5173`
- Worker API: `http://localhost:8787`

## Repository foundation

```text
docs/
  adr/
  data-model.md
  role-permission-matrix.md
migrations/
seeds/
shared/
  constants.ts
  domain.ts
  validation.ts
src/
worker/
```

## Key docs

- [Architecture](./docs/ARCHITECTURE.md)
- [Architecture Decision Record](./docs/adr/0001-cloudflare-native-foundation.md)
- [Data Model and ERD](./docs/data-model.md)
- [Role Matrix](./docs/role-permission-matrix.md)
- [Deployment](./docs/DEPLOYMENT.md)
- [Assumptions](./ASSUMPTIONS.md)
- [Progress Log](./TODO.md)
