# Deployment Checklist

- [ ] Create D1, KV, R2, Queue resources in Cloudflare
- [ ] Replace placeholder IDs in [wrangler.jsonc](/D:/RONY/OneDrive%20-%20NRDS/CodeX/CX-%20Public%20Library/wrangler.jsonc)
- [ ] Run `npm run typecheck`
- [ ] Run `npm run lint`
- [ ] Run `npm run test`
- [ ] Run `npm run build`
- [ ] Run `npm run db:migrate:remote`
- [ ] Run `npm run db:seed:remote`
- [ ] Run `npm run deploy`
- [ ] Complete first-user bootstrap
- [ ] Verify R2 uploads, reminder queue, audit logs, and exports
- [ ] Store Cloudflare credentials only in local env vars or GitHub secrets
