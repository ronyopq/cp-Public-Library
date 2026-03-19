# Live Deployment Notes

The project now deploys as a Cloudflare Worker with static assets, not as a Pages-only site.

Before a live rollout:

- create the Cloudflare resources
- update `wrangler.jsonc`
- run remote migrations and seeds
- deploy with `npm run deploy`

Details:

- [Deployment Guide](/D:/RONY/OneDrive%20-%20NRDS/CodeX/CX-%20Public%20Library/docs/DEPLOYMENT.md)
- [Cloudflare Bindings Guide](/D:/RONY/OneDrive%20-%20NRDS/CodeX/CX-%20Public%20Library/docs/CLOUDFLARE_DEPLOYMENT.md)
