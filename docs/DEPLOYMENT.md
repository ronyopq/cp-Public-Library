# Deployment Notes

## Cloudflare bindings

- `DB`: D1 database for all relational and transactional state.
- `APP_CACHE`: KV namespace for caches, rate limits, and feature flag cache copies.
- `MEDIA_BUCKET`: R2 bucket for covers, photos, scans, receipts, and export artifacts.
- `TASK_QUEUE`: Queue for reminders, export jobs, and retryable background tasks.
- `ACCESSION_COUNTER`: Durable Object for copy accession sequences.
- `ASSETS`: Static frontend assets produced by `vite build`.

## Commands

```bash
npm install
npm run icons
npm run build
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Deploy after authenticating Wrangler:

```bash
npm run db:migrate:remote
npm run db:seed:remote
npm run deploy
```

## Notes

- The cron expression `0 3 * * *` maps to `09:00` in Bangladesh (`Asia/Dhaka`).
- If your account does not auto-provision every binding, create the queue and any named resources first, then redeploy with the same binding names.
- Keep the initial setup route private during rollout and complete first-user bootstrap immediately after first deployment.
