# Deployment Guide

## Production target

This app deploys as a single Cloudflare Worker with static assets, not as a Pages-only frontend.

The Worker serves:

- `/api/*` from [worker/index.ts](/D:/RONY/OneDrive%20-%20NRDS/CodeX/CX-%20Public%20Library/worker/index.ts)
- `/files/*` from authenticated R2-backed asset routes
- all other routes from the built frontend in `dist/`

## Prerequisites

- Cloudflare account with access to Workers, D1, KV, R2, Queues, and Durable Objects
- Wrangler authenticated locally or `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` configured in CI
- Resource IDs added to [wrangler.jsonc](/D:/RONY/OneDrive%20-%20NRDS/CodeX/CX-%20Public%20Library/wrangler.jsonc)

## Recommended rollout

1. Create Cloudflare resources.
2. Replace placeholder binding IDs in `wrangler.jsonc`.
3. Run remote migrations.
4. Run remote seeds.
5. Deploy the Worker.
6. Complete the first-run bootstrap flow immediately after deployment.
7. Enable public modules only after staff verification.

## Commands

```bash
npm install
npm run icons
npm run typecheck
npm run lint
npm run test
npm run build
npm run db:migrate:remote
npm run db:seed:remote
npm run deploy
```

## GitHub Actions

Two workflows are provided:

- CI for pull requests and non-`main` pushes
- Worker deployment on `main`

Required repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Do not commit real credentials to the repository.

## Post-deploy checks

- Open the Worker URL or custom domain.
- Confirm `/api/foundation` returns `ready: true`.
- Complete bootstrap and create the first `super_admin`.
- Log in and verify D1-backed auth/session flows.
- Upload a member photo and a catalog cover to confirm R2 bindings.
- Queue a reminder and confirm Queue/Cron wiring.
- Create an export and confirm R2-backed file delivery.

## Rollback approach

- Redeploy the last known-good commit.
- Do not roll back D1 data with KV or R2 snapshots.
- Use the generated backup/export artifacts for audit and data recovery workflows.
