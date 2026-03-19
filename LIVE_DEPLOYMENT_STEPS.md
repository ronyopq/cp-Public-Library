# Live Deployment Steps

1. Provision Cloudflare resources for `DB`, `APP_CACHE`, `MEDIA_BUCKET`, `TASK_QUEUE`, and `ACCESSION_COUNTER`.
2. Replace the placeholder IDs in [wrangler.jsonc](/D:/RONY/OneDrive%20-%20NRDS/CodeX/CX-%20Public%20Library/wrangler.jsonc).
3. Set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in your shell or GitHub secrets.
4. Run:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run db:migrate:remote
npm run db:seed:remote
npm run deploy
```

5. Complete bootstrap and smoke-test the app.
