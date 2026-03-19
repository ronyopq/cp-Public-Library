# Database Setup

Use the Cloudflare-native deployment flow documented in:

- [Deployment Guide](/D:/RONY/OneDrive%20-%20NRDS/CodeX/CX-%20Public%20Library/docs/DEPLOYMENT.md)
- [Cloudflare Bindings Guide](/D:/RONY/OneDrive%20-%20NRDS/CodeX/CX-%20Public%20Library/docs/CLOUDFLARE_DEPLOYMENT.md)

Minimal sequence:

```bash
wrangler d1 create cx-public-library-db
npm run db:migrate:remote
npm run db:seed:remote
```

Security rules:

- do not commit Cloudflare tokens or account IDs
- do not commit default passwords
- use the bootstrap flow to create the first `super_admin`
