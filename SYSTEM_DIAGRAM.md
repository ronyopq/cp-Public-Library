# System Architecture Diagram

## 🏗️ Complete System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE WORKERS INFRASTRUCTURE                     │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                          HONO.JS API LAYER                              │  │
│  │                       (src/api/routes/*.ts)                             │  │
│  │                                                                          │  │
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐     │  │
│  │  │ /admin/*        │  │ /api/books/*     │  │ /api/members/*   │     │  │
│  │  │ Users, roles,   │  │ GET/POST/PATCH/  │  │ Registration,    │     │  │
│  │  │ settings,       │  │ DELETE books     │  │ profiles         │     │  │
│  │  │ audit logs      │  │ Search, filter   │  │                  │     │  │
│  │  └─────────────────┘  └──────────────────┘  └──────────────────┘     │  │
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐     │  │
│  │  │ /api/loans/*    │  │ /api/fines/*     │  │ /api/payments/*  │     │  │
│  │  │ Issue, return,  │  │ Auto-calculate,  │  │ Process payment, │     │  │
│  │  │ renew loans     │  │ waive fines      │  │ refund           │     │  │
│  │  └─────────────────┘  └──────────────────┘  └──────────────────┘     │  │
│  │  ┌──────────────────────────────────────────────────────────────┐     │  │
│  │  │              /api/reports/* - Analytics & Exports             │     │  │
│  │  │  Overdue loans, fin summaries, usage reports, CSV export     │     │  │
│  │  └──────────────────────────────────────────────────────────────┘     │  │
│  │                                                                          │  │
│  └────────────────┬───────────────────────────────────────────────────────┘  │
│                   │                                                            │
│  ┌────────────────▼───────────────────────────────────────────────────────┐  │
│  │                      MIDDLEWARE STACK                                   │  │
│  │          (src/api/middleware/auth.ts)                                   │  │
│  │                                                                          │  │
│  │  1. authMiddleware ──── Validate JWT, extract user context             │  │
│  │  2. requireRole ─────── Check user role (super_admin, admin, etc.)     │  │
│  │  3. requirePermission ── Check specific permission (books:read, etc.)  │  │
│  │  4. checkAccountStatus - Verify active/suspended/inactive              │  │
│  │  5. verifyOwnership ─── Members can only access own data               │  │
│  │  6. requireHierarchy ─- Prevent privilege escalation                   │  │
│  │                                                                          │  │
│  │  ✅ All denied attempts logged to audit_log with WHO, WHAT, WHEN      │  │
│  └────────────────┬───────────────────────────────────────────────────────┘  │
│                   │                                                            │
│  ┌────────────────▼────────────────────────────────────────────────────────┐ │
│  │                         AUTH MODULE                                      │ │
│  │              (src/api/auth/tokens.ts)                                    │ │
│  │                                                                           │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐    │ │
│  │  │ JWT Tokens   │  │ Passwords    │  │ Session & Blacklist (KV)   │    │ │
│  │  │              │  │              │  │                            │    │ │
│  │  │ generateAccess  hashPassword   │  │ createSession              │    │ │
│  │  │ (24h expiry) │  │ (bcryptjs)   │  │ blacklistToken (logout)    │    │ │
│  │  │              │  │              │  │ isTokenBlacklisted         │    │ │
│  │  │ generateRefresh verifyPassword │  │ (KV store)                 │    │ │
│  │  │ (7d expiry)  │  │              │  │                            │    │ │
│  │  │              │  │ validate     │  │ Rate limiting              │    │ │
│  │  │ verifyToken  │  │ Password     │  │ (100 req/hr per IP)        │    │ │
│  │  │ (HS256)      │  │             │  │                            │    │ │
│  │  └──────────────┘  └──────────────┘  └────────────────────────────┘    │ │
│  │                                                                           │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                                │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │              DATABASE LAYER (src/db/schema.ts)                            │ │
│  │                    ↓  Drizzle ORM Types                                  │ │
│  └────────────┬─────────────────────────────────────────────────────────────┘ │
│               │                                                                │
└───────────────┼────────────────────────────────────────────────────────────────┘
                │
┌───────────────▼────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE D1 (SQLite Database)                           │
│                                                                                │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────────┐      │
│  │ USERS & ROLES    │  │ BOOKS & COPIES   │  │ LOANS & FINES        │      │
│  │                  │  │                  │  │                       │      │
│  │ users            │  │ bibliographic_   │  │ loans                 │      │
│  │ user_profiles    │  │  records         │  │ loan_renewals         │      │
│  │ roles (7)        │  │ physical_copies  │  │ loan_history          │      │
│  │ permissions (50) │  │ publishers       │  │ fines                 │      │
│  │ role_permissions │  │ categories       │  │ payments              │      │
│  │ members          │  │ book_copies_     │  │ payment_methods       │      │
│  │ member_profiles  │  │  categories      │  │                       │      │
│  └──────────────────┘  └──────────────────┘  └───────────────────────┘      │
│                                                                                │
│  ┌──────────────────────────────────────┐  ┌────────────────────────────┐    │
│  │ SYSTEM & CONFIGURATION               │  │ AUDIT & COMPLIANCE         │    │
│  │                                      │  │                            │    │
│  │ settings (library config)            │  │ audit_log (immutable)      │    │
│  │ notifications (reminders)            │  │ (all mutations captured)   │    │
│  │ inventory_history (copy changes)     │  │ ← WHO, WHAT, WHEN, RESULT  │    │
│  └──────────────────────────────────────┘  └────────────────────────────┘    │
│                                                                                │
│  📊 SCHEMA STATS:                                                             │
│     • 25 tables total                                                         │
│     • 40+ relationships (1:1, 1:M, M:M)                                       │
│     • 30+ performance indexes                                                 │
│     • Soft deletes for compliance                                             │
│     • Temporal tracking (created_at, updated_at)                              │
│     • UUID primary keys (distributed-safe)                                    │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│             CLOUDFLARE WORKERS AUXILIARY SERVICES                             │
│                                                                                │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────┐                  │
│  │  Cloudflare KV │  │  Cloudflare R2  │  │ Durable      │                  │
│  │  (Cache Layer) │  │  (File Storage) │  │ Objects      │                  │
│  │                │  │                 │  │              │                  │
│  │ Sessions (10m) │  │ Images          │  │ Accession    │                  │
│  │ Tokens         │  │ Receipts (PDF)  │  │ number gen   │                  │
│  │ Permissions    │  │ Exports (CSV)   │  │ (atomic)     │                  │
│  │ Rate limits    │  │ Backups         │  │              │                  │
│  │ Cache (1-5h)   │  │ Reports         │  │              │                  │
│  │                │  │                 │  │              │                  │
│  │ Sub-ms access  │  │ No egress fees  │  │ Consistency  │                  │
│  └────────────────┘  └─────────────────┘  └──────────────┘                  │
│                                                                                │
│  ┌──────────────────────────────────────────────────────┐                    │
│  │  Cloudflare Queues + Cron Triggers                    │                    │
│  │  (Background Jobs)                                    │                    │
│  │                                                        │                    │
│  │  • Fine reminders (daily) ─── overdue books          │                    │
│  │  • Payment reminders (cron) ─ outstanding fines       │                    │
│  │  • Loan expiry alerts (daily) ─ upcoming due dates    │                    │
│  │  • Backups (weekly) ────────── database snapshots    │                    │
│  │  • Report generation (weekly) - analytics reports     │                    │
│  │  • Cleanup (daily) ─────────── expired tokens, etc.  │                    │
│  │                                                        │                    │
│  └──────────────────────────────────────────────────────┘                    │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Request Flow Diagram

```
┌──────────────────┐
│   Client        │
│  (Web/Mobile)   │
└────────┬─────────┘
         │
         │ 1. POST /api/loans/issue
         │    Headers: Authorization: Bearer <jwt>
         │    Body: {copy_id, member_id}
         │
┌────────▼──────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE WORKERS                                  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ 2. authMiddleware                                             │    │
│  │    └─ Extract JWT from header                                 │    │
│  │    └─ Validate signature & expiry                             │    │
│  │    └─ Attach user_id, role to context                         │    │
│  └──────────────┬───────────────────────────────────────────────┘    │
│                 │                                                      │
│  ┌──────────────▼───────────────────────────────────────────────┐    │
│  │ 3. requirePermission('loans:create') middleware               │    │
│  │    └─ Query D1: GET user permissions (cached in KV 1h)       │    │
│  │    └─ Check if 'loans:create' in permissions list            │    │
│  │    └─ If denied: Log to audit_log, return 403                │    │
│  └──────────────┬───────────────────────────────────────────────┘    │
│                 │                                                      │
│  ┌──────────────▼───────────────────────────────────────────────┐    │
│  │ 4. Route Handler (POST /api/loans/issue)                     │    │
│  │    └─ Input validation                                         │    │
│  │       ├─ copy_id exists in D1?                                │    │
│  │       ├─ copy status = 'available'?                            │    │
│  │       ├─ member active & not suspended?                        │    │
│  │       └─ member within borrowing limit?                        │    │
│  │    └─ Business logic                                           │    │
│  │       ├─ Calculate due_date (14 days from today)              │    │
│  │       ├─ Set loan status = 'active'                            │    │
│  │       ├─ Update copy status = 'borrowed'                       │    │
│  │       └─ Assign last_borrowed_by_member_id                     │    │
│  └──────────────┬───────────────────────────────────────────────┘    │
│                 │                                                      │
│  ┌──────────────▼───────────────────────────────────────────────┐    │
│  │ 5. Database Operation (D1)                                   │    │
│  │    └─ BEGIN TRANSACTION                                       │    │
│  │       ├─ INSERT INTO loans {copy_id, member_id, due_date}    │    │
│  │       ├─ UPDATE physical_copies SET status='borrowed' WHERE  │    │
│  │       │  copy_id = ? AND status = 'available'                │    │
│  │       └─ COMMIT TRANSACTION                                   │    │
│  └──────────────┬───────────────────────────────────────────────┘    │
│                 │                                                      │
│  ┌──────────────▼───────────────────────────────────────────────┐    │
│  │ 6. Audit Logging (D1)                                        │    │
│  │    └─ INSERT INTO audit_log                                  │    │
│  │       {                                                        │    │
│  │         user_id: context.user_id,                             │    │
│  │         action: 'loans:create',                               │    │
│  │         entity: 'loans',                                       │    │
│  │         entity_id: new_loan_id,                               │    │
│  │         old_values: null,                                      │    │
│  │         new_values: {copy_id, member_id, due_date, status},  │    │
│  │         ip_address: request.ip,                               │    │
│  │         user_agent: request.user_agent,                       │    │
│  │         status: 'success',                                     │    │
│  │         created_at: now()                                      │    │
│  │       }                                                         │    │
│  └──────────────┬───────────────────────────────────────────────┘    │
│                 │                                                      │
│  ┌──────────────▼───────────────────────────────────────────────┐    │
│  │ 7. Enqueue Notification (Queues)                             │    │
│  │    └─ Queue message: "loan_issued"                            │    │
│  │       └─ Consumer: Send SMS/email to member about due date    │    │
│  └──────────────┬───────────────────────────────────────────────┘    │
│                 │                                                      │
│  ┌──────────────▼───────────────────────────────────────────────┐    │
│  │ 8. Return Response (200 OK)                                  │    │
│  │    └─ {                                                        │    │
│  │         success: true,                                         │    │
│  │         data: {                                                │    │
│  │           loan_id: "uuid-...",                                │    │
│  │           copy_id: "uuid-...",                                │    │
│  │           member_id: "uuid-...",                              │    │
│  │           issued_at: "2026-03-18T10:30:00Z",                 │    │
│  │           due_date: "2026-04-01T23:59:59Z",                  │    │
│  │           status: "active",                                    │    │
│  │           renewal_count: 0                                     │    │
│  │         }                                                       │    │
│  │       }                                                         │    │
│  └────────────┬──────────────────────────────────────────────────┘   │
│               │                                                        │
└───────────────┼────────────────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────┐
│   Client                        │
│ Store loan_id & due_date        │
│ Display to member               │
│ Schedule renewal check          │
└─────────────────────────────────┘
```

## 🔐 Permission Checking Flow

```
API Request with JWT Token
  │
  ├─ 1. authMiddleware validates JWT signature & expiry
  │     └─ If invalid: 401 Unauthorized
  │
  ├─ 2. Extract user_id & role from JWT payload
  │     Attach to context
  │
  ├─ 3. @requirePermission('books:create') middleware executes
  │     │
  │     ├─ Check KV cache: "user_<user_id>_permissions"
  │     │  ├─ If cached & valid (< 1h old): Use cached perms
  │     │  └─ If not cached or expired:
  │     │
  │     └─ Query D1: SELECT permissions WHERE user_id = ?
  │        (via role_permissions → permissions)
  │
  ├─ 4. Check if 'books:create' in user's permission list
  │     │
  │     ├─ If YES ✅
  │     │  └─ Continue to route handler
  │     │
  │     └─ If NO ❌
  │        ├─ Log to audit_log: {action: 'PERMISSION_DENIED', 
  │        │                      permission: 'books:create'}
  │        └─ Return 403 Forbidden
  │
  └─ 5. Route handler executes:
       ├─ Input validation
       ├─ Business logic
       ├─ Database operations
       ├─ Audit logging
       └─ Return response
```

## 7️⃣ Role Hierarchy

```
SUPER ADMIN (Level 0)
├─ All 50+ permissions
├─ Can create/modify any user/role
├─ Access to all settings

    │
    ├─── ADMIN (Level 1)
    │    ├─ ~45 permissions (all except system settings)
    │    ├─ Can create/modify Level 2+ users
    │    └─ Cannot modify Level 0-1 users
    │
    │    ├─── LIBRARIAN (Level 2)
    │    │    ├─ ~18 permissions
    │    │    ├─ Issue/return books
    │    │    ├─ Manage members
    │    │    └─ Create fines
    │    │
    │    │    ├─── MEMBER (Level 3)
    │    │    │    ├─ ~10 permissions
    │    │    │    ├─ Borrow books
    │    │    │    ├─ Renew loans
    │    │    │    └─ Pay fines
    │    │    │
    │    │    │    ├─── GUEST (Level 4)
    │    │    │    │    ├─ ~3 permissions
    │    │    │    │    ├─ Search books (read-only)
    │    │    │    │    └─ View public catalog
    │    │    │    │
    │    │    │    └─ (Can't have lower level)
    │    │    │
    │    │    └─ (Hierarchy enforcement prevents jumping)
    │    │
    │    └─ (Cannot create/modify Level 2 users)
    │
    └─ (Cannot create/modify Level 1 users)

AUDITOR (Level 5) ──── Parallel track, read-only audit logs
SYSTEM (Level 6) ───── Background jobs, automated tasks
```

## 📊 Data Model Relationships

```
USER MANAGEMENT
┌─────────────┐
│ users       │ ◄──┐
└─────────────┘    │
  │                │
  ├─ user_id      │ (One user per role)
  ├─ email        │
  ├─ role_id ─────┤──┐
  ├─ password_hash│  │
  └─ status       │  │
                   │  │
┌──────────────────┘  │
│                    │
│   ┌────────────────┘
│   │
└──┤─► roles
   │   ├─ role_id
   │   ├─ name (super_admin, admin, librarian, member, guest, auditor, system)
   │   ├─ hierarchy_level (0-6)
   │   └─ status
   │
   └──► role_permissions
        ├─ role_id
        ├─ permission_id
        │
        └──► permissions
             ├─ permission_id
             ├─ code (books:read, loans:create, etc.)
             ├─ category (books, loans, fines, etc.)
             └─ description

BOOK MANAGEMENT
┌────────────────────────┐
│ bibliographic_records  │  (Book metadata: ISBN, title, author)
└────────────────────────┘
  │
  ├─ isbn (unique)
  ├─ title
  ├─ authors (JSON)
  ├─ publisher_id ──────┐ publishers (name, contact)
  └─ categories ────────┤ book_copies_categories
                        │
                        └──► physical_copies (Actual items)
                             ├─ copy_id
                             ├─ accession_number (unique)
                             ├─ barcode (unique)
                             ├─ status (available, borrowed, damaged, lost, archived)
                             ├─ location (shelf reference)
                             └─ last_borrowed_by_member_id

LENDING & FINES
┌────────────┐
│ members    │
└────────────┘
  │
  ├─ member_id
  ├─ membership_number (unique)
  ├─ full_name
  │
  └──► loans
       ├─ loan_id
       ├─ copy_id ──────────┐ physical_copies
       ├─ issued_by_user_id │
       ├─ due_date
       ├─ status (active, returned, renewed)
       │
       ├──► loan_renewals
       │    └─ renewal_count
       │
       └──► fines
            ├─ fine_date
            ├─ amount
            ├─ status (outstanding, paid, waived)
            │
            └──► payments
                 ├─ payment_id
                 ├─ amount
                 ├─ payment_method
                 └─ transaction_id (unique)

AUDIT & COMPLIANCE
All mutations logged:
┌────────────┐
│ audit_log  │
├────────────┤
│ user_id    │ (Who made the change)
│ action     │ (What changed: loans:create, fines:waive, etc.)
│ entity     │ (What entity: loans, fines, physical_copies, etc.)
│ entity_id  │ (Which specific record)
│ old_values │ (JSON: previous state)
│ new_values │ (JSON: new state)
│ ip_address │ (Where from)
│ user_agent │ (What device/app)
│ status     │ (success or failure)
│ created_at │ (When: immutable timestamp)
└────────────┘

Never deleted, 7-year retention minimum
```

## ✨ Key Features Summary

| Feature | Implementation | Status |
|---------|-----------------|--------|
| **Authentication** | JWT (HS256, 24h) + bcryptjs + KV sessions | ✅ Phase 1 |
| **Authorization** | 7 roles + 50 permissions + hierarchy | ✅ Phase 1 |
| **Database** | 25 tables, 40+ relationships, 30+ indexes | ✅ Phase 1 |
| **Audit Trail** | Immutable audit_log capturing all mutations | ✅ Phase 1 |
| **Admin API** | 10 endpoints (users, roles, settings, audits) | ✅ Phase 1 |
| **Book Management** | Separate bibliography & physical copies | 🔶 Phase 1.1 |
| **Lending** | Issue, return, renew with auto tracking | 🔶 Phase 1.2 |
| **Fines** | Auto-calculation for overdue books | 🔶 Phase 1.2 |
| **Payments** | Payment processing & receipts | 🔶 Phase 1.2 |
| **Reports** | Overdue, activity, revenue analytics | 🔶 Phase 1.3 |
| **Frontend** | Next.js admin dashboard | 🔴 Phase 2 |
| **Mobile** | React Native or PWA | 🔴 Phase 3 |
| **Notifications** | Email/SMS/WhatsApp reminders | 🔴 Phase 3 |

---

**✅ = Complete | 🔶 = In Progress | 🔴 = Not Started**

See INDEX.md for complete overview and status update.
