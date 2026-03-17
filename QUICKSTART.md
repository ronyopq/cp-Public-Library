# Quick Start Guide - Development

Get the Public Library Management System running locally in 10 minutes.

## Prerequisites

✅ Node.js 18+  
✅ npm or pnpm  
✅ Cloudflare account (free tier OK)  
✅ Git  

## Installation (5 minutes)

### 1. Clone and Install

```bash
git clone https://github.com/your-org/public-library-system.git
cd public-library-system
npm install
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env.local

# Generate JWT secret
# macOS/Linux:
openssl rand -hex 32
# Windows PowerShell:
[Convert]::ToHexString((Get-Random -InputObject (1..256) -Count 32))

# Add the generated secret to .env.local as JWT_SECRET
```

### 3. Database Setup

```bash
# Create local D1 database
wrangler d1 create library-dev --local

# Apply schema
wrangler d1 execute library-dev --local --file migrations/0001_init_schema.sql

# Seed data (roles, permissions, reference data)
wrangler d1 execute library-dev --local --file scripts/seed.sql
```

### 4. Create Initial Super Admin

```bash
# Generate admin user SQL
npx ts-node scripts/bootstrap-admin.ts admin@library.bd Password123 "Admin User"

# Copy the output SQL and execute it:
wrangler d1 execute library-dev --local --command "INSERT INTO users ..."
```

### 5. Start Development Servers

```bash
# Terminal 1: Start API (Hono on Workers)
npm run dev:api

# Terminal 2: Start Frontend (Next.js)
npm run dev:web
```

## Access

- 🌐 **Frontend**: http://localhost:3000
- 🔌 **API**: http://localhost:8787
- 📊 **Health Check**: http://localhost:8787/health

## First Login

**Email**: `admin@library.bd`  
**Password**: `Password123`  

⚠️ **Change password immediately after first login!**

---

## Common Tasks

### Add a Book

```bash
curl -X POST http://localhost:8787/api/books \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "বাংলা উপন্যাস",
    "isbn": "978-984-123456-78-9",
    "publisher_id": "pub_1",
    "category_id": "cat_fiction",
    "language_id": "lang_bn"
  }'
```

### Register a Member

```bash
curl -X POST http://localhost:8787/api/members \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "নতুন সদস্য",
    "phone": "+8801712345678",
    "address": "ঢাকা",
    "membership_type": "GENERAL"
  }'
```

### Issue a Loan

```bash
curl -X POST http://localhost:8787/api/loans \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": "mem_123",
    "book_copy_id": "copy_456"
  }'
```

---

## Project Structure Quick Reference

```
src/
├── api/                    # Hono API server
│   ├── routes/            # Endpoints (auth, books, members, loans, etc)
│   ├── middleware/        # Auth, error handling, RBAC
│   └── utils/             # Database, auth helpers
├── web/                   # Next.js frontend (planned)
└── shared/                # Shared types, schemas

migrations/
├── 0001_init_schema.sql   # Database schema
└── seeds/
    └── seed.sql           # Reference data

docs/
├── API.md                 # API endpoint reference
├── ARCHITECTURE.md        # System design decisions
└── DOMAIN_MODEL.md        # Database ERD

scripts/
├── bootstrap-admin.ts     # Create first admin
└── seed.sql               # Seed data
```

---

## Development Workflow

### 1. Create a New API Endpoint

**File**: `src/api/routes/myfeature.ts`

```typescript
import { Hono } from 'hono';
import { Context } from 'hono';
import { authMiddleware, requireAuth } from '../middleware/auth';
import { db } from '../utils/db';
import { generateId } from '../utils/auth';

const myRoutes = new Hono();

// Endpoint
myRoutes.get('/', authMiddleware, async (ctx: Context) => {
  const auth = requireAuth(ctx);
  
  try {
    const data = await db.queryAll('SELECT * FROM my_table');
    return ctx.json({ success: true, data });
  } catch (error: any) {
    return ctx.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'ত্রুটি।' }
    }, { status: 500 });
  }
});

export default myRoutes;
```

**Register** in `src/api/index.ts`:
```typescript
import myRoutes from './routes/myfeature';
app.route('/api/myfeature', myRoutes);
```

### 2. Add a Database Table

**File**: `migrations/0002_add_mytable.sql`

```sql
CREATE TABLE my_table (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX idx_my_table_created_at ON my_table(created_at);
```

Apply locally:
```bash
wrangler d1 execute library-dev --local --file migrations/0002_add_mytable.sql
```

### 3. Add Permission

**File**: `scripts/seed.sql` (add to permissions INSERT):

```sql
INSERT INTO permissions (id, name, module, description)
VALUES ('perm_myfeature_read', 'myfeature:read', 'myfeature', 'Read my feature');
```

Reseed:
```bash
wrangler d1 execute library-dev --local --file scripts/seed.sql
```

### 4. Check Permission in Code

```typescript
const hasPermission = await db.queryAll(
  `SELECT 1 FROM role_permissions rp
   JOIN permissions p ON rp.permission_id = p.id
   WHERE rp.role_id = ? AND p.name = ?`,
  [auth.role_id, 'myfeature:read']
);

if (!hasPermission.length) {
  return ctx.json({
    success: false,
    error: { code: 'FORBIDDEN', message: 'অনুমতি নেই।' }
  }, { status: 403 });
}
```

---

## Debugging

### View API Logs

```bash
# Watch local D1 queries
wrangler d1 execute library-dev --local --command "SELECT * FROM books LIMIT 5;"

# View API requests
wrangler tail  # (in production)
```

### Test DB Connection

```bash
wrangler d1 execute library-dev --local --command "SELECT 1;"
# Output: Query completed successfully
```

### Check User Exists

```bash
wrangler d1 execute library-dev --local --command "SELECT * FROM users WHERE email = 'admin@library.bd';"
```

---

## Common Issues

### API won't start
```bash
# Ensure D1 is created
wrangler d1 list

# Ensure schema is applied
wrangler d1 execute library-dev --local --command "SELECT name FROM sqlite_master WHERE type='table';"
```

### Frontend can't connect to API
```bash
# Check NEXT_PUBLIC_API_URL in .env.local
# Should be: http://localhost:8787

# Check API is running
curl http://localhost:8787/health
```

### Database error "table X not found"
```bash
# Re-apply migrations
wrangler d1 execute library-dev --local --file migrations/0001_init_schema.sql
wrangler d1 execute library-dev --local --file scripts/seed.sql
```

### Forgot password
```bash
# Update user password directly (dev only!)
wrangler d1 execute library-dev --local --command "UPDATE users SET password_hash = '$2b$12$...' WHERE email = 'admin@library.bd';"

# Or recreate the user:
npx ts-node scripts/bootstrap-admin.ts newemail@library.bd NewPassword123 "Name"
```

---

## Next Steps

1. ✅ API is running locally
2. ⏭️ Create frontend pages (Next.js)
3. ⏭️ Add loan circulation endpoints
4. ⏭️ Add competitions module
5. ⏭️ Deploy to Cloudflare Workers

---

## Deployment

### Deploy to Cloudflare (Once Ready)

```bash
# Authenticate
wrangler login

# Create production database
wrangler d1 create library

# Apply schema
wrangler d1 execute library --file migrations/0001_init_schema.sql --remote

# Seed data
wrangler d1 execute library --file scripts/seed.sql --remote

# Set secrets
wrangler secret put JWT_SECRET

# Deploy API
npm run deploy:api

# Deploy frontend
npm run deploy:web
```

---

## Documentation

📖 Full API Reference: [docs/API.md](../docs/API.md)  
🏗️ Architecture: [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)  
💾 Database: [docs/DOMAIN_MODEL.md](../docs/DOMAIN_MODEL.md)  
🚀 Deployment: [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)  

---

## Support

- 📋 Check [README.md](../README.md) for overview
- 📚 See [docs/](../docs/) for full documentation
- 🐛 Report issues on GitHub
- 💬 Ask questions in GitHub Discussions

---

**Last Updated**: March 18, 2024  
**Version**: 1.0.0-alpha
