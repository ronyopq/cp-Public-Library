# Implementation Roadmap & Getting Started

**Public Library Management System**  
**Status**: Phase 1 - Backend API  
**Date**: March 18, 2026  

---

## 📋 What's Been Created

### ✅ Documentation
1. **ARCHITECTURE.md** (4,000 lines)
   - System design overview
   - Data storage strategy (D1, KV, R2)
   - Authentication & RBAC modeling
   - Deployment architecture
   - Performance considerations

2. **ERD.md** (2,000 lines)
   - Complete entity-relationship diagram (Mermaid)
   - 25 tables with relationships
   - Indexes and performance optimizations
   - Data integrity constraints
   - Migration path from spreadsheets

3. **ROLE_MATRIX.md** (1,500 lines)
   - 7 system roles with hierarchy
   - 50+ granular permissions
   - Permission matrix (7 roles × 50 perms)
   - RBAC implementation guide
   - Testing examples

### ✅ Database
1. **Schema (Drizzle ORM)** - `src/db/schema.ts`
   - 25 tables fully typed
   - TypeScript interfaces for all entities
   - Relationships and constraints defined

2. **Migrations**
   - `0001_init_schema.sql` - Initial table creation
   - `0002_add_indexes.sql` - Performance indexes
   - `0003_add_roles_permissions.sql` - Default RBAC setup

### ✅ Authentication System
1. **JWT Module** - `src/api/auth/tokens.ts`
   - JWT generation & verification
   - Password hashing (bcryptjs)
   - Token blacklisting (KV)
   - Session management
   - Rate limiting
   - Token validation helpers

2. **Auth Middleware** - `src/api/middleware/auth.ts` (already exists)
   - JWT verification
   - Role-based access control (RBAC)
   - Permission checking
   - Account status validation
   - Ownership verification

### ✅ Admin Routes
1. **Admin API** - `src/api/routes/admin.ts`
   - User management (list, create, update, delete)
   - Role management with permissions
   - System settings CRUD
   - Audit log viewing & export
   - Permission hierarchy enforcement

---

## 🚀 Getting Started - Step by Step

### Step 1: Initialize Database

```bash
# Start the development server with Wrangler
npm run dev

# This automatically:
# 1. Creates D1 database (local SQLite)
# 2. Runs all migrations
# 3. Populates default roles and permissions
# 4. Sets up KV namespace for sessions/cache
```

### Step 2: Test Database Setup

```bash
# Check if tables were created
wrangler d1 execute library --local --command "SELECT name FROM sqlite_master WHERE type='table';"

# You should see 25 tables:
# - users, members, roles, permissions, role_permissions
# - bibliographic_records, physical_copies, book_copies_categories
# - loans, loan_renewals, loan_history
# - fines, payments, payment_methods
# - notifications, settings, audit_log
# - etc.
```

### Step 3: Create First Super Admin User

Create a script `scripts/create-admin.ts`:

```typescript
import { Hono } from "hono";
import { hashPassword } from "../src/api/auth/tokens";
import { v4 as uuid } from "uuid";

const app = new Hono();

app.post("/create-admin", async (c) => {
  const db = c.env.DB;
  
  const userId = uuid();
  const now = Date.now();
  const passwordHash = await hashPassword("AdminPassword@123");
  
  // Create super admin user
  await db.prepare(`
    INSERT INTO users 
    (user_id, email, display_name, password_hash, role_id, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
  `).bind(
    userId, 
    "admin@library.local", 
    "Super Admin", 
    passwordHash, 
    "role_super_admin", 
    now, 
    now
  ).run();

  // Create profile
  await db.prepare(`
    INSERT INTO user_profiles 
    (user_profile_id, user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `).bind(uuid(), userId, now, now).run();

  return c.json({
    success: true,
    message: "Admin user created",
    credentials: {
      email: "admin@library.local",
      password: "AdminPassword@123"
    }
  });
});

export default app;
```

### Step 4: Test Authentication

```bash
# 1. Get login page
curl http://localhost:8787/

# 2. Login with admin credentials
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@library.local",
    "password": "AdminPassword@123"
  }'

# Response should be:
# {
#   "success": true,
#   "data": {
#     "user_id": "...",
#     "accessToken": "eyJ...",
#     "refreshToken": "eyJ..."
#   }
# }
```

### Step 5: Test RBAC

```bash
# 1. Create a librarian user via admin API
curl -X POST http://localhost:8787/api/admin/users \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "librarian@library.local",
    "display_name": "John Librarian",
    "password": "Librarian@123",
    "role": "role_librarian"
  }'

# 2. Try to access admin endpoint as librarian (should fail)
curl http://localhost:8787/api/admin/users \
  -H "Authorization: Bearer <librarian_token>"

# Response: 403 Forbidden - Insufficient permissions

# 3. Try to issue loan as librarian (should succeed)
curl -X POST http://localhost:8787/api/loans/create \
  -H "Authorization: Bearer <librarian_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "copy_id": "...",
    "member_id": "..."
  }'
```

### Step 6: Test Audit Logging

```bash
# View audit log
curl http://localhost:8787/api/admin/audit-log \
  -H "Authorization: Bearer <admin_token>"

# Response shows all operations with:
# - who (user_id)
# - what (action, entity, entity_id)
# - when (created_at)
# - result (success/failure)

# Export audit log as CSV
curl -X POST http://localhost:8787/api/admin/audit-log/export \
  -H "Authorization: Bearer <admin_token>" > audit-log.csv
```

---

## 🏗️ Architecture Layers

```
┌─────────────────────────────────────────────┐
│         Client (React/Next.js)              │
│                                             │
│  - Admin Dashboard                          │
│  - Web Portal                               │
│  - Mobile App                               │
└──────────────┬──────────────────────────────┘
               │ HTTPS/REST
┌──────────────V──────────────────────────────┐
│      Cloudflare Workers (Hono.js)           │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  API Routes (routes/*.ts)           │   │
│  │  - /auth (login, register)          │   │
│  │  - /books, /members, /loans         │   │
│  │  - /fines, /payments                │   │
│  │  - /admin (user, role, settings)    │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  Middleware Stack (middleware/*.ts) │   │
│  │  - authMiddleware (JWT validation)  │   │
│  │  - requirePermission (RBAC)         │   │
│  │  - errorHandler                     │   │
│  │  - auditLogger                      │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  Business Logic (utils/*.ts)        │   │
│  │  - Fine calculations                │   │
│  │  - Inventory management             │   │
│  │  - Member validations               │   │
│  └─────────────────────────────────────┘   │
└──────────────┬──────────────────────────────┘
       │               │               │
   ┌───V───┐       ┌───V───┐      ┌──V────┐
   │  D1   │       │  KV   │      │  R2   │
   │  DB   │       │Cache  │      │ Files │
   └───────┘       └───────┘      └───────┘
```

---

## 📊 Data Flow Examples

### Example 1: Member Registration

```
POST /api/auth/register
├─ Input: { email, password, full_name, phone, address }
│
├─ Validate
│  ├─ Email format valid & unique
│  ├─ Password strong (8+ chars, mixed case, number)
│  └─ Phone unique
│
├─ Hash password with bcryptjs
│
├─ Create member record
│  ├─ member_id = uuid()
│  ├─ membership_number = "LIB-2026-001" (auto-generated)
│  ├─ role_id = "role_member"
│  ├─ status = "active"
│  └─ membership_date = today
│
├─ Create member profile
│
├─ Log to audit_log
│  └─ action: "create", entity: "member", user_id: system
│
├─ Generate tokens
│  ├─ accessToken (24h expiry)
│  └─ refreshToken (7d expiry, stored in KV)
│
└─ Response: { accessToken, refreshToken, member_id }
```

### Example 2: Issue Loan

```
POST /api/loans/create
├─ Authentication: Verify JWT, extract user_id & role
│
├─ Authorization: Check permission "loan:create"
│
├─ Validation
│  ├─ Copy exists & status = "available"
│  ├─ Member exists & status = "active"
│  ├─ Member current loans < max_books_limit
│  └─ No duplicate active loan for this copy
│
├─ Create loan record
│  ├─ loan_id = uuid()
│  ├─ issue_date = today
│  ├─ due_date = today + 14 days
│  ├─ status = "active"
│  └─ issued_by_user_id = current_user
│
├─ Update copy status
│  └─ status = "borrowed"
│  └─ last_loan_date = today
│  └─ total_loan_count++
│
├─ Log to audit_log
│  └─ action: "create", entity: "loan"
│
├─ Queue notification
│  └─ Send confirmation email to member
│
└─ Response: { loan_id, due_date, fine_per_day }
```

### Example 3: Calculate & Create Fine

```
Cron Job: Daily at midnight
├─ Query all active loans where due_date < today
│
├─ For each overdue loan
│  ├─ Calculate: overdue_days = today - due_date
│  ├─ Calculate: amount = overdue_days × fine_per_day (Tk 5)
│  │
│  ├─ Check if fine exists
│  │  ├─ If exists: update amount, days_overdue
│  │  └─ If not: create new fine record
│  │
│  ├─ Update loan status = "overdue"
│  │
│  ├─ Update member status to "delinquent" if amount > threshold
│  │
│  ├─ Queue notification
│  │  ├─ Email: "You have outstanding fine of Tk X"
│  │  └─ SMS: "Library: Outstanding fine Tk X. Visit library or pay online"
│  │
│  └─ Log to audit_log
│     └─ action: "create", entity: "fine", user_id: "role_system"
│
└─ Update KV cache with daily fine statistics
```

---

## 🧪 Testing Checklist

### Authentication Tests
- [ ] Register member with valid data
- [ ] Register member with duplicate email (should fail)
- [ ] Login with correct credentials
- [ ] Login with wrong password (should fail)
- [ ] Access protected endpoint without token (should fail)
- [ ] Access protected endpoint with expired token (should fail)
- [ ] Access protected endpoint with invalid token (should fail)
- [ ] Logout and verify token blacklist

### RBAC Tests
- [ ] Admin can view all users
- [ ] Librarian cannot create admin accounts
- [ ] Member cannot delete other members
- [ ] Guest can only search books (read-only)
- [ ] Auditor can view audit log but not delete
- [ ] System role can create fines
- [ ] Permission hierarchy prevents lower-level operations

### Book Management Tests
- [ ] Create book (admin only)
- [ ] Create copy (admin only)
- [ ] Search books (all authenticated)
- [ ] View book details (all authenticated)
- [ ] Update copy condition (librarian+)

### Lending Tests
- [ ] Issue book to member
- [ ] Member cannot exceed max_books_limit
- [ ] Cannot issue damaged/lost copies
- [ ] Return book and free up copy
- [ ] Renew loan before due date
- [ ] Cannot renew after max_renewals

### Fine & Payment Tests
- [ ] Auto-fine calculation on overdue
- [ ] Fine waiver by admin
- [ ] Payment processing
- [ ] Payment refund
- [ ] Member status = "delinquent" when fines > threshold

### Audit Logging Tests
- [ ] All mutations logged in audit_log
- [ ] Audit log includes who, what, when, result
- [ ] Admin can view audit log
- [ ] Admin can export audit log as CSV
- [ ] Audit log entries never deleted (immutable)

---

## 🔐 Security Checklist

- [ ] All passwords hashed with bcryptjs (12 rounds)
- [ ] JWT tokens signed with SECRET key (not public)
- [ ] Refresh tokens stored in KV with TTL
- [ ] Rate limiting implemented (100 req/hr per IP)
- [ ] CORS configured for frontend domain
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (input sanitization)
- [ ] Authorization checked server-side (never client-side)
- [ ] Sensitive data excluded from API responses
- [ ] PII fields encrypted if needed
- [ ] Audit log captures all mutations
- [ ] Error messages don't leak system info

---

## 📱 Database Snapshots for Testing

### Sample Member
```json
{
  "member_id": "mem_001",
  "membership_number": "LIB-2026-001",
  "email": "john@example.com",
  "full_name": "John Doe",
  "phone_number": "8801711111111",
  "membership_type": "general",
  "status": "active",
  "max_books_limit": 5,
  "membership_date": "2024-01-15"
}
```

### Sample Librarian
```json
{
  "user_id": "usr_001",
  "email": "librarian@library.org",
  "display_name": "Sarah Librarian",
  "role": "role_librarian",
  "status": "active"
}
```

### Sample Book
```json
{
  "bibliographic_id": "book_001",
  "isbn": "978-1234567890",
  "title": "The Python Cookbook",
  "authors": ["David Beazley", "Brian K. Jones"],
  "publisher_id": "pub_001",
  "edition": "3rd Edition",
  "pages": 656,
  "language": "English",
  "status": "active"
}
```

### Sample Copy
```json
{
  "copy_id": "copy_001",
  "bibliographic_id": "book_001",
  "accession_number": "LIB-2026-00001",
  "barcode": "978-1234567890-001",
  "location": "shelf_a",
  "condition": "excellent",
  "status": "available",
  "total_loan_count": 5
}
```

---

## 🚀 Next Steps (Phase 2)

Start building the frontend:

1. **Next.js Setup**
   - App router structure
   - TypeScript setup
   - Tailwind CSS

2. **Authentication UI**
   - Login page
   - Register page
   - Password reset
   - Token refresh flow

3. **Admin Dashboard**
   - User management
   - Book inventory
   - Member management
   - Reports & analytics

4. **Member Portal**
   - Search & browse books
   - Active loans display
   - Fine payment
   - Account settings

5. **Librarian Interface**
   - Issue/return books
   - Member management
   - Report generation
   - Daily operations

---

## 📞 Architecture Support Files

**Refer to these documents for detailed information:**

| Document | Purpose | Location |
|----------|---------|----------|
| ARCHITECTURE.md | System design & infrastructure | docs/ARCHITECTURE.md |
| ERD.md | Entity relationships & schema | docs/ERD.md |
| ROLE_MATRIX.md | Detailed RBAC reference | docs/ROLE_MATRIX.md |
| API.md | API endpoint documentation | docs/API.md |
| QUICKSTART.md | Development environment setup | QUICKSTART.md |
| ASSUMPTIONS.md | Design decisions | docs/ASSUMPTIONS.md |

---

## 💡 Key Decisions Made

**Why Separate Books & Copies?**
- Books = metadata (ISBN, author, publisher, etc.)
- Copies = physical items (accession number, condition, location)
- Allows handling multiple copies of same book efficiently
- Supports tracking lost/damaged copies separately

**Why JWT with KV Sessions?**
- JWT = stateless, scalable across workers
- KV = session blacklisting for logout, rate limiting
- Combined approach = best of both worlds

**Why D1 for Everything?**
- Single source of truth for all data
- ACID guarantees for critical operations
- Full-text search capabilities
- Automatic backups via Cloudflare

**Why Hierarchical RBAC?**
- Super Admin (level 0) > Admin (1) > Librarian (2) > Member (3) > Guest (4)
- Prevents privilege escalation
- Clear permission delegation rules
- Auditable access control

---

**Version**: 1.0  
**Status**: Ready for Phase 2 Development  
**Date**: March 18, 2026  
**Next Review**: After Phase 1 testing complete
