# 🚀 Complete Deployment Setup for cppl.pages.dev

## 📋 Overview
This guide will set up your complete library system at **https://cppl.pages.dev** with database, storage, and caching.

**Total time: 10-15 minutes**

---

## 🔧 Step 1: GitHub Secrets Setup (2 minutes)

Go to: https://github.com/ronyopq/cp-Public-Library/settings/secrets/actions

### Add Secret #1: CLOUDFLARE_API_TOKEN
```
Name:  CLOUDFLARE_API_TOKEN
Value: yePcNYOgACyicgSpA9xr-U3kN3nzakltub3ipT82
```

### Add Secret #2: CLOUDFLARE_ACCOUNT_ID
```
Name:  CLOUDFLARE_ACCOUNT_ID
Value: 0aa3a7240be2b718a369f43f91e200b9
```

---

## 📊 Step 2: Create Cloudflare D1 Database (3 minutes)

### Option A: Cloudflare Dashboard
1. Go to: https://dash.cloudflare.com/0aa3a7240be2b718a369f43f91e200b9/pages
2. Find project **"cppl"**
3. Go to **Settings** → **Functions**
4. Under **D1 Database Bindings**, click **"Create binding"**
5. Select or create: `cx-public-library-db`
6. Binding name: `DB`
7. Click **"Create binding"**

### Option B: Terminal (Recommended)
```powershell
# Set credentials
$env:CLOUDFLARE_API_TOKEN = "yePcNYOgACyicgSpA9xr-U3kN3nzakltub3ipT82"
$env:CLOUDFLARE_ACCOUNT_ID = "0aa3a7240be2b718a369f43f91e200b9"

# Create D1 database
wrangler d1 create cx-public-library-db --remote

# This returns an ID like: xxxxx-xxxxx-xxxxx
# Save this ID!
```

---

## 🗄️ Step 3: Create Database Schema & Seed Data

### Run Migrations
```powershell
cd "d:\RONY\OneDrive - NRDS\CodeX\CX- Public Library"

# Apply schema
wrangler d1 execute cx-public-library-db --remote --file ./migrations/0001_init_schema.sql

# Seed reference data
wrangler d1 execute cx-public-library-db --remote --file ./seeds/001_reference_data.sql
```

### Create Admin User
```sql
INSERT INTO users (
  id, email, password_hash, role, status, created_at
) VALUES (
  'admin_1',
  'admin@library.bd',
  '$2b$12$...',  -- Hash of "Password123"
  'super_admin',
  'active',
  datetime('now')
);
```

---

## 🔑 Step 4: Create KV Namespace (2 minutes)

For caching and session storage:

```powershell
# Create KV namespace
wrangler kv:namespace create APP_CACHE --remote

# This returns a namespace ID
# Copy the ID for wrangler.jsonc
```

Or via Cloudflare Dashboard:
1. Go to: https://dash.cloudflare.com/0aa3a7240be2b718a369f43f91e200b9
2. Left menu → **Workers & Pages** → **KV**
3. Click **"Create namespace"**
4. Name: `APP_CACHE`
5. Get the namespace ID

---

## 📁 Step 5: Create R2 Bucket (2 minutes)

For file uploads (member photos, documents):

```powershell
# Create R2 bucket
wrangler r2 bucket create cx-public-library-media --remote

# Note the bucket name
```

Or via Cloudflare Dashboard:
1. Go to: https://dash.cloudflare.com/0aa3a7240be2b718a369f43f91e200b9
2. Left menu → **R2**
3. Click **"Create bucket"**
4. Name: `cx-public-library-media`
5. Click **"Create bucket"**

---

## 🔗 Step 6: Update wrangler.jsonc with IDs (2 minutes)

After getting the D1, KV, and R2 IDs, update:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "cx-public-library-db",
      "database_id": "YOUR_D1_ID_HERE"        // Add this!
    }
  ],
  "kv_namespaces": [
    {
      "binding": "APP_CACHE",
      "id": "YOUR_KV_ID_HERE"                 // Add this!
    }
  ],
  "r2_buckets": [
    {
      "binding": "MEDIA_BUCKET",
      "bucket_name": "cx-public-library-media",
      "jurisdiction": "eu"                     // Optional
    }
  ]
}
```

---

## 🚀 Step 7: Final Deployment (1 minute)

### Commit & Push
```powershell
cd "d:\RONY\OneDrive - NRDS\CodeX\CX- Public Library"

git add .
git commit -m "chore: Update Cloudflare configuration with database and storage IDs"
git push origin main
```

### GitHub Actions Will:
1. ✅ Build your code
2. ✅ Create dist folder
3. ✅ Deploy to cppl.pages.dev
4. ✅ Bind D1 database
5. ✅ Bind KV namespace
6. ✅ Bind R2 bucket

**Wait ~2 minutes** → Website goes LIVE! 🎉

---

## ✅ Step 8: Verify Everything Works

1. **Website**: https://cppl.pages.dev
2. **Login**:
   ```
   Email:    admin@library.bd
   Password: Password123
   ```

3. **Test Features**:
   - ✅ Dashboard loads
   - ✅ Can create a fee type
   - ✅ Can search books
   - ✅ Can view competitions

---

## 📝 What Gets Deployed

| Component | Location | Status |
|-----------|----------|--------|
| **Frontend** | Cloudflare Pages | ✅ Automatic |
| **Database** | D1 SQLite | ✅ Remote |
| **Cache** | KV Namespace | ✅ Remote |
| **Files** | R2 Bucket | ✅ Remote |
| **API** | Cloudflare Workers | ✅ Built-in to Pages |

---

## 🔐 What's Included

✅ **Accounting System**
- Fee management
- Multi-month dues
- Receipt generation
- Financial reports

✅ **Competitions**
- Event management
- Member registration
- Result publication

✅ **Member Management**
- Profile management
- ID card generation
- Loan history
- Fine tracking

✅ **Library Catalog**
- Book search
- Category browsing
- Availability tracking
- Public discovery

✅ **Admin Dashboard**
- Settings configuration
- Report generation
- Member management
- Financial analysis

---

## 🆘 Troubleshooting

### "Database not found" Error
```powershell
# Check D1 databases
wrangler d1 list

# Verify binding in wrangler.jsonc
# Make sure database_id is set
```

### "KV Namespace not found"
```powershell
# Check KV namespaces
wrangler kv:namespace list

# Update wrangler.jsonc with correct ID
```

### Deployment Failed
1. Check GitHub Actions: https://github.com/ronyopq/cp-Public-Library/actions
2. Review error logs
3. Ensure all secrets are set
4. Try manual deploy:
   ```powershell
   wrangler pages deploy dist --project-name cppl
   ```

---

## 📞 Quick Reference

| Command | Purpose |
|---------|---------|
| `wrangler d1 create <name> --remote` | Create database |
| `wrangler d1 execute <db> --remote --file schema.sql` | Run migration |
| `wrangler kv:namespace create <name> --remote` | Create KV |
| `wrangler r2 bucket create <name> --remote` | Create R2 |
| `wrangler pages deploy dist --project-name cppl` | Deploy manually |

---

## 🎯 Next Steps

1. **Add GitHub Secrets** (done? ✓)
2. **Create D1 Database** (run migrations)
3. **Create KV Namespace** (session storage)
4. **Create R2 Bucket** (file uploads)
5. **Update wrangler.jsonc** (add IDs)
6. **Push & Deploy** (auto-triggers)
7. **Login & Verify** (test features)

**Everything will be live at: https://cppl.pages.dev** 🚀

---

## Questions?

Check these guides:
- Cloudflare D1: https://developers.cloudflare.com/d1/
- Cloudflare KV: https://developers.cloudflare.com/kv/
- Cloudflare R2: https://developers.cloudflare.com/r2/
- Cloudflare Pages: https://developers.cloudflare.com/pages/
