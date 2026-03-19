# Cloudflare Bindings Guide

## Worker configuration

Canonical config: [wrangler.jsonc](/D:/RONY/OneDrive%20-%20NRDS/CodeX/CX-%20Public%20Library/wrangler.jsonc)

This project uses:

- `main = worker/index.ts`
- `assets.directory = ./dist`
- `assets.binding = ASSETS`
- Worker-native bindings for D1, KV, R2, Queues, and Durable Objects

## Required resources

### D1

Binding: `DB`

Purpose:

- users, sessions, RBAC
- bibliographic records and physical copies
- loans, fines, reminders, reservations
- accounts, ledgers, receipts, exports
- competitions, audit logs, app settings

Create:

```bash
wrangler d1 create cx-public-library-db
```

Add the returned `database_id` to `wrangler.jsonc`.

### KV

Binding: `APP_CACHE`

Purpose:

- cache copies of feature flags
- IP-based rate limit windows
- lightweight temporary state only

Create:

```bash
wrangler kv namespace create APP_CACHE
```

Add the returned namespace ID to `wrangler.jsonc`.

### R2

Binding: `MEDIA_BUCKET`

Purpose:

- book cover images and thumbnails
- title/copyright page scans
- member photos
- receipts, reports, backups, exports, print assets

Create:

```bash
wrangler r2 bucket create cx-public-library-media
```

### Queue

Binding: `TASK_QUEUE`

Purpose:

- reminder dispatch
- retryable background work
- backup/export snapshot jobs

Create:

```bash
wrangler queues create cx-public-library-tasks
```

### Durable Object

Binding: `ACCESSION_COUNTER`

Purpose:

- concurrency-safe accession sequence generation

Migration tag `v1` is already declared in `wrangler.jsonc`.

## Cron

The Worker implements a scheduled handler for reminder sweeps and background maintenance.

Recommended cron:

- `0 3 * * *` UTC

This maps to `09:00` in `Asia/Dhaka`.

Example:

```bash
wrangler triggers create cx-public-library --cron "0 3 * * *"
```

## Runtime vars

Set in `wrangler.jsonc` or per-environment:

- `APP_NAME_BN`
- `APP_NAME_EN`
- `APP_TIMEZONE=Asia/Dhaka`
- `LIBRARY_CODE`
- `DEFAULT_FINE_PER_DAY`
- `AI_BOOK_INTAKE_MODEL`

## Remote deployment sequence

```bash
npm run build
npm run db:migrate:remote
npm run db:seed:remote
npm run deploy
```

## CI secrets

For GitHub deployment workflows, define:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

These secrets must be added in GitHub Actions settings and must never be committed into repository files or scripts.
