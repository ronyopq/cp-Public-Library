# Cloudflare Deployment Guide - Community Public Library

## 🚀 One-Time Setup (5 minutes)

### Step 1: Create Cloudflare API Token

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Select template: **Edit Cloudflare Workers**
4. Click "Use template"
5. Configure permissions:
   - **Permissions**: Workers (All), D1 (Write), KV (Write), R2 (Write), Account Settings (Read)
   - **Account Resources**: Include "All accounts"
   - **Zone Resources**: Include "All zones"
6. Click "Continue to summary"
7. Click "Create Token"
8. **Copy the token** (it will be shown only once)

### Step 2: Add GitHub Secrets

In your GitHub repo:

1. Go to: **Settings → Secrets and variables → Actions**
2. Click **"New repository secret"**
3. Add these secrets:

| Secret Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | `yePcNYOgACyicgSpA9xr-U3kN3nzakltub3ipT82` |
| `CLOUDFLARE_ACCOUNT_ID` | `0aa3a7240be2b718a369f43f91e200b9` |

### Step 3: Create D1 Database

Run these commands locally:

```bash
# Create database
wrangler d1 create cx-public-library-db

# Apply migrations
wrangler d1 migrations create cx-public-library-db init_schema
# (This creates a migration file in migrations/ folder)

# Apply schema
npm run db:migrate:remote

# Seed data
npm run db:seed:remote
```

### Step 4: Create KV Namespace

```bash
wrangler kv:namespace create "APP_CACHE"
```

### Step 5: Create R2 Bucket

```bash
wrangler r2 bucket create cx-public-library-media
```

---

## 🔄 Automatic Deployment

Once setup is complete, every push to `main` automatically deploys:

```bash
git add .
git commit -m "Your changes"
git push origin main
```

GitHub Actions will:
1. ✅ Run TypeScript checks
2. ✅ Build Vite app and Worker
3. ✅ Deploy to Cloudflare Workers
4. ✅ Configure D1 and KV bindings

**Live URL**: https://cppl.pages.dev/

---

## 🛠️ Manual Deployment (if needed)

```bash
# Build
npm run build

# Deploy
export CLOUDFLARE_API_TOKEN="yePcNYOgACyicgSpA9xr-U3kN3nzakltub3ipT82"
export CLOUDFLARE_ACCOUNT_ID="0aa3a7240be2b718a369f43f91e200b9"
npm run deploy
```

---

## 📊 Environment Setup

### D1 Database

The database includes:
- Members table
- Books / Bibliographic records
- Loans & Circulation
- Fees & Payments  
- Competitions & Results
- Settings & Configuration

### KV Namespaces

- `APP_CACHE` - Session cache, temporary data

### R2 Buckets

- `cx-public-library-media` - Member photos, book covers, documents

### Cron Jobs

Daily maintenance at **3 AM (Asia/Dhaka)**:
- Circulation reminders
- Overdue notifications
- Report generation

---

## 🔐 Security Notes

- ✅ API token is stored in GitHub Secrets (encrypted)
- ✅ Token is never visible in logs
- ✅ Each deployment creates a new version
- ✅ Previous versions are automatically archived
- ✅ All data in D1 is encrypted at rest

---

## 📝 Troubleshooting

### Deployment fails with "Authentication failed"

1. Verify API token has correct permissions
2. Ensure token hasn't expired
3. Check Account ID matches your Cloudflare account

### D1 Database not found

```bash
# View your databases
wrangler d1 list

# The database should show: cx-public-library-db
```

### KV Namespace missing

```bash
# Create if missing
wrangler kv:namespace create "APP_CACHE"

# Update wrangler.jsonc with returned ID
```

### Module not found errors

Ensure `tsconfig.worker.json` has:
```json
"paths": {
  "@shared/*": ["shared/*"],
  "@worker/*": ["worker/*"]
}
```

---

## 🎯 Next Steps

1. ✅ Push updated code to main branch
2. ✅ Watch GitHub Actions deploy automatically
3. ✅ Visit https://cppl.pages.dev to verify
4. ✅ Login with: `admin@library.bd` / `Password123`
5. ✅ Change password in admin settings

---

## 📞 Support

For Cloudflare issues: https://status.cloudflare.com/
For Worker documentation: https://developers.cloudflare.com/workers/

