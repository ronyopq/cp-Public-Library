# Public Library Management System - Architecture

**Project**: CP Public Library Management System  
**Environment**: Cloudflare (D1, KV, R2, Queues, Cron)  
**Tech Stack**: TypeScript, Hono.js, Drizzle ORM, JWT, bcryptjs  
**Status**: Phase 1 - Backend API & Admin  
**Version**: 1.0.0  

---

## 📐 System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer                              │
│  (Admin Dashboard, Web Portal, Mobile - Phase 2)            │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS/REST
┌──────────────────────V──────────────────────────────────────┐
│          Cloudflare Workers (Hono.js API)                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  API Routes Layer                                      │ │
│  │  - Auth (login, register, tokens)                      │ │
│  │  - Books (CRUD, search, filters)                       │ │
│  │  - Members (registration, profiles)                    │ │
│  │  - Loans (issue, return, renew)                        │ │
│  │  - Fines & Payments                                    │ │
│  │  - Reports & Analytics                                 │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Middleware Stack                                      │ │
│  │  - RBAC (Role-Based Access Control)                    │ │
│  │  - Auth (JWT validation)                               │ │
│  │  - Error handling                                      │ │
│  │  - Logging & auditing                                  │ │
│  │  - Rate limiting                                       │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Business Logic Layer                                  │ │
│  │  - Fine calculation                                    │ │
│  │  - Inventory management                                │ │
│  │  - Permission checks                                   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────┬────────────────────────────────┬───────────────┘
              │                                │
    ┌─────────V──────────┐         ┌──────────V────────────┐
    │   D1 Database      │         │   KV Cache/Settings   │
    │ (Relational Data)  │         │                       │
    │                    │         │ - Session cache       │
    │ - Books            │         │ - Config values       │
    │ - Members          │         │ - Rate limit counters │
    │ - Loans            │         │ - Feature flags       │
    │ - Fines            │         └──────────────────────┘
    │ - Payments         │
    │ - Audit Log        │         ┌──────────────────────┐
    │ - Users (staff)    │         │   R2 Storage         │
    │ - Roles/Perms      │         │                      │
    │ - Settings         │         │ - Documents          │
    └────────────────────┘         │ - Book covers        │
                                   │ - Receipts           │
                                   │ - Reports            │
                                   └──────────────────────┘

    ┌──────────────────────────────────────────────────────┐
    │  Queues & Cron (Background Jobs)                     │
    │                                                      │
    │  - Fine reminder emails (Cron daily)                 │
    │  - Loan expiration alerts (Cron)                     │
    │  - Payment confirmations (Queue)                     │
    │  - Report generation (Cron monthly)                  │
    │  - Auto-fine calculation (Cron hourly)               │
    │  - Notification delivery (Queue)                     │
    └──────────────────────────────────────────────────────┘
```

---

## 🎯 Core Concepts

### 1. Bibliography Separation

**Bibliographic Record** = The intellectual work
- ISBN, Title, Author, Publisher, Edition, etc.
- One per unique book work
- Immutable (rarely changes)
- Example: "The Python Cookbook, 3rd Edition"

**Physical Copy** = Actual item in library
- Accession number (library's internal ID)
- Barcode, Location, Condition
- Can be borrowed, lost, replaced
- Many copies per bibliographic record
- Example: "Copy #1 of Python Cookbook - Shelf A3"

**Benefits of Separation**:
- Single book record shared across multiple physical copies
- Track individual copy status (available, damaged, lost)
- Efficient storing of book metadata
- Proper accounting for multiple editions

### 2. Data Storage Strategy

| Data Type | Storage | Reason |
|-----------|---------|--------|
| **Relational** (Books, Members, Loans, Fines, Users, Roles) | D1 | ACID guarantees, complex queries, data integrity |
| **Session/Cache** (Active sessions, temporary tokens, rate limits) | KV | Sub-millisecond lookup, automatic expiration |
| **Large Files** (Documents, covers, receipts, reports) | R2 | Cost-effective, native integration, CDN ready |
| **Background Jobs** (Reminders, notifications) | Queues + Cron | Async execution, reliability, scheduling |

### 3. Authentication Flow

```
User Login Request
    ↓
POST /api/auth/login → (email, password)
    ↓
Validate credentials against users table
    ↓
On success:
  - Generate JWT (exp: 24h)
  - Generate Refresh token (exp: 7d)
  - Store refresh token in KV
  ↓
Return: { accessToken, refreshToken, user }
    ↓
Client stores tokens (localStorage/sessionStorage)
    ↓
All API requests include: Authorization: Bearer <token>
    ↓
Middleware validates token signature, expiry, rate limits
    ↓
Extract user_id and role from token payload
    ↓
Check permissions against role matrix
    ↓
Allow/reject request
```

### 4. RBAC Model

**Roles**: 7 primary roles with hierarchical permissions

| Role | Level | Access | Use Case |
|------|-------|--------|----------|
| **Super Admin** | 0 | Everything | System administrator |
| **Admin** | 1 | All features except system settings | Library manager |
| **Librarian** | 2 | Check in/out, member management, reports | Staff member |
| **Member** | 3 | Borrow, renew, pay fines, view history | Regular user |
| **Guest** | 4 | Search books, view limited info | Unregistered visitor |
| **Auditor** | 5 | View-only analytics, logs | Compliance officer |
| **System** | 6 | Internal system operations | Automated jobs |

**Permission Matrix**: 50+ granular permissions (see ROLE_MATRIX.md)

---

## 📊 Database Design

### Core Tables (20 + junction tables)

**Books & Inventory** (5 tables)
- `bibliographic_records` - Book metadata
- `physical_copies` - Actual copies in library
- `publishers` - Publisher information
- `categories` - Book categories/genres
- `book_copies_categories` - M2M junction

**Members & Users** (4 tables)
- `members` - Library user accounts
- `users` - Staff/admin accounts
- `member_profiles` - Extended member data
- `user_profiles` - Extended staff data

**Loans & Returns** (3 tables)
- `loans` - Borrowing transactions
- `loan_history` - Historical loans (archive)
- `loan_renewals` - Renewal records

**Fines & Payments** (3 tables)
- `fines` - Overdue fines
- `payments` - Payment transactions
- `payment_methods` - Stored payment methods

**Access Control** (2 tables)
- `roles` - Role definitions
- `permissions` - Permission definitions
- `role_permissions` - M2M junction

**Settings & Audit** (3 tables)
- `settings` - System configuration
- `audit_log` - All mutations logged
- `notification_queue` - Pending notifications

**Sessions** (handled in KV, not D1)

---

## 🔐 Permission Model

### Permission Categories (50+ permissions)

```
book:read       - View book details
book:create     - Add new books
book:update     - Edit book metadata
book:delete     - Remove books
book:search     - Full-text search

copy:read       - View copy status
copy:create     - Add physical copy
copy:update     - Update copy condition
copy:delete     - Mark copy lost/damaged
copy:list       - List all copies

member:read     - View member profile
member:create   - Register new member
member:update   - Edit member details
member:delete   - Remove member account
member:list     - List all members

loan:read       - View loan details
loan:create     - Issue book
loan:update     - Renew loan
loan:return     - Return book
loan:list       - List loans

fine:read       - View fine details
fine:create     - Create fine
fine:waive      - Forgive fine
fine:list       - List fines

payment:read    - View payment details
payment:create  - Record payment
payment:delete  - Refund payment
payment:list    - List payments

report:read     - View reports
report:create   - Generate report
report:export   - Download report

admin:create    - Create admin accounts
admin:update    - Modify admin users
admin:delete    - Remove admin users
admin:list      - List admins

settings:read   - View settings
settings:update - Modify configuration

audit:read      - View audit log
audit:export    - Download audit data
```

---

## 🔄 Key Business Flows

### 1. Book Lending Flow

```
Member finds book → Check availability → Borrow request
    ↓
System validates:
  - Member status (valid, not suspended)
  - Copy availability (not borrowed, not damaged)
  - Member limits (max 5 books)
  ↓
Create loan record:
  - issue_date: today
  - due_date: today + 14 days
  - status: active
  ↓
Update copy status → borrowed
    ↓
Log to audit_log
    ↓
Return: loan_id, due_date, fine_per_day
```

### 2. Fine Calculation Flow

```
Cron job runs daily at midnight
    ↓
Query all active loans with due_date < today
    ↓
For each overdue loan:
  - overdue_days = today - due_date
  - amount = overdue_days * fine_per_day (Tk 5 default)
  - Create fine record if not exists
  - Update: total_amount, status
  ↓
Send email notification to member
    ↓
Log to audit_log
    ↓
Update KV cache with daily fine statistics
```

### 3. Payment Flow

```
Member initiates payment
    ↓
POST /api/payments/process
    ↓
Validate:
  - Fine exists and amount matches
  - Member exists
  - Payment method valid
  ↓
Process payment (bKash/Nagad/manual)
    ↓
On success:
  - Record payment transaction
  - Update fine: status = paid
  - Generate receipt PDF → R2
  - Create notification (email/SMS)
  ↓
Return receipt URL
    ↓
Queue notification delivery
    ↓
Log to audit_log
```

### 4. Member Registration Flow

```
Guest submits registration form
    ↓
Validate:
  - Email unique
  - Phone unique
  - Required fields
  ↓
Create member:
  - Auto-generate membership number (format: LIB-2026-001)
  - Hash password with bcryptjs (12 rounds)
  - status: active
  - membership_date: today
  ↓
Send welcome email with:
  - Membership number
  - Borrowing guidelines
  - Library policies
  ↓
Log to audit_log
    ↓
Create default KV cache for member preferences
```

---

## 🏗️ Project Structure

```
public-library-system/
├── src/
│   ├── api/
│   │   ├── index.ts              # API entry point
│   │   ├── middleware/           # Auth, RBAC, error handling
│   │   ├── routes/               # API endpoints
│   │   │   ├── auth.ts           # Login, register, tokens
│   │   │   ├── books.ts          # Book CRUD
│   │   │   ├── copies.ts         # Physical copy management
│   │   │   ├── members.ts        # Member management
│   │   │   ├── loans.ts          # Borrowing operations
│   │   │   ├── fines.ts          # Fine management
│   │   │   ├── payments.ts       # Payment processing
│   │   │   ├── reports.ts        # Analytics & reports
│   │   │   └── admin.ts          # Admin operations
│   │   ├── utils/                # Shared utilities
│   │   ├── db/                   # Database access
│   │   │   ├── schema.ts         # Drizzle schema
│   │   │   ├── queries.ts        # Complex queries
│   │   │   └── seed.sql          # Initial data
│   │   └── types/                # TypeScript types
│   │
│   ├── migrations/               # D1 migrations
│   │   ├── 0001_init_schema.sql
│   │   ├── 0002_add_indexes.sql
│   │   └── 0003_add_permissions.sql
│   │
│   └── worker.ts                 # Cloudflare Worker entry
│
├── docs/
│   ├── ARCHITECTURE.md           # This file
│   ├── API.md                    # API documentation
│   ├── QUICKSTART.md             # Setup guide
│   ├── ERD.md                    # Entity-relationship diagram
│   ├── ROLE_MATRIX.md            # Permission matrix
│   └── ASSUMPTIONS.md            # Design decisions
│
├── .env.example
├── package.json
├── tsconfig.json
├── wrangler.toml                 # Cloudflare config
└── README.md
```

---

## 🚀 Deployment Architecture

### Development Environment
```
Local Machine
├── D1 (local SQLite)
├── KV namespace (local)
├── wrangler dev
└── localhost:8787
```

### Production Environment
```
Cloudflare
├── D1 (managed PostgreSQL-compatible)
├── KV namespace (global)
├── R2 bucket (file storage)
├── Queues (async jobs)
├── Cron Triggers (scheduled tasks)
├── Workers (API endpoints)
└── Pages (optional frontend)
```

### Infrastructure as Code
- `wrangler.toml` - Database, KV, R2 configuration
- Migration files - Schema versioning
- Seed SQL - Initial data
- GitHub Actions - CI/CD deploy

---

## 🔒 Security Architecture

### Authentication
- **JWT Tokens**: HS256, 24h expiry
- **Refresh Tokens**: 7-day sliding window
- **Password Hashing**: bcryptjs (12 rounds)
- **Rate Limiting**: 100 requests/hour per IP
- **CORS**: Configured for frontend domain

### Authorization
- **Server-Side RBAC**: All checks in middleware
- **Permission Matrix**: 50+ granular permissions
- **Audit Logging**: Every mutation logged
- **Field-Level Security**: Sensitive fields excluded from responses

### Data Protection
- **HTTPS Only**: All API calls encrypted
- **Secrets Management**: Environment variables, GitHub Actions secrets
- **SQL Injection Prevention**: Drizzle ORM parameterized queries
- **CSRF Protection**: Token validation
- **XSS Protection**: Input sanitization

### Compliance
- **GDPR**: Member data deletion support
- **PII Handling**: Encrypted sensitive fields
- **Audit Trail**: 7-year retention for compliance
- **Data Backup**: Automatic D1 backups

---

## 📈 Performance Considerations

### Caching Strategy
```
Layer 1: KV (sub-ms)
  - Session cache (10 min TTL)
  - Rate limit counters (1 min)
  - Hot settings (1 hour)
  - Member preferences (30 min)

Layer 2: D1 Query Cache (Drizzle)
  - Book catalog (5 min)
  - Category lists (1 hour)
  - Static reference data

Layer 3: Client Cache
  - Immutable book data (1 week)
  - Member profile (30 min)
  - Active loans (5 min)
```

### Database Optimization
- **Indexes**: On frequently queried columns (member_id, book_id, due_date)
- **Partitioning**: audit_log partitioned by year
- **Query Optimization**: Batch operations where possible
- **Connection Pooling**: Handled by D1

### API Performance
- **Pagination**: Default 50 items, max 500
- **Filtering**: Indexed columns only
- **Search**: Full-text indexes on book titles
- **Response Compression**: gzip enabled

---

## 🔄 Integration Points

### External Services (Phase 2)
- **Email**: SendGrid for notifications
- **SMS**: Twilio for reminders
- **Payment Gateway**: bKash, Nagad, Stripe
- **Document Generation**: LibreOffice API
- **Reporting**: BI tool integration

### Webhooks
- Payment confirmations → update payment status
- Email delivery status → update notification status
- SMS delivery → log in audit

---

## 📋 API Response Structure

### Success Response
```json
{
  "success": true,
  "data": { /* payload */ },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERR_CODE",
    "message": "Error description",
    "details": { /* optional */ }
  }
}
```

### Pagination Response
```json
{
  "success": true,
  "data": [ /* items */ ],
  "pagination": {
    "total": 1500,
    "page": 1,
    "limit": 50,
    "pages": 30
  }
}
```

---

## 📊 Monitoring & Logging

### Logs Stored In
- **API Logs**: D1 audit_log table
- **Error Logs**: Sentry (Phase 2)
- **Performance Logs**: Cloudflare Analytics

### Key Metrics
- API response time (target: <200ms)
- Database query time (target: <50ms)
- Error rate (target: <0.1%)
- Cache hit ratio (target: >80%)
- Concurrent users (tracked in KV)

---

## 🛣️ Development Roadmap

### Phase 1: Backend MVP ✅ (Current)
- [x] Project scaffold
- [x] Database schema
- [x] Authentication system
- [x] RBAC middleware
- [x] Core API endpoints
- [x] Error handling
- [x] Audit logging

### Phase 2: Frontend & Advanced Features (4-6 weeks)
- [ ] Next.js admin dashboard
- [ ] Public web portal
- [ ] Advanced search & filters
- [ ] Report generation (PDF)
- [ ] Print system (barcodes, labels)
- [ ] Email notifications
- [ ] Payment gateway integration

### Phase 3: Mobile & Optimization (2-3 weeks)
- [ ] React Native mobile app
- [ ] Offline sync
- [ ] QR code scanning
- [ ] Performance optimization
- [ ] Load testing

### Phase 4: Production & Scale (1-2 weeks)
- [ ] Load balancing setup
- [ ] Database replication
- [ ] CDN configuration
- [ ] Security audit
- [ ] Staff training
- [ ] Public launch

---

## 🎓 Key Design Principles

1. **Separation of Concerns**: Books ≠ Copies, Bibliography ≠ Inventory
2. **RBAC Over ACL**: Role-based permissions, not per-user rules
3. **Audit Everything**: All mutations logged for compliance
4. **Cache Strategically**: KV for hot data, D1 for permanent storage
5. **Fail Safe**: Graceful degradation, transactional consistency
6. **Security First**: Validate everything server-side
7. **Performance First**: Cache, batch, optimize database queries
8. **Documentation Driven**: Comments, README, API docs, ERD

---

## 📞 Architecture Decision Records (ADRs)

### ADR-001: Separate Bibliographic Records from Physical Copies
**Decision**: Create two tables - one for book metadata, one for copies  
**Rationale**: Allows tracking multiple copies with different conditions/locations  
**Status**: Accepted  

### ADR-002: Use D1 + KV + R2 + Queues
**Decision**: Store relational data in D1, cache in KV, files in R2, jobs in Queues  
**Rationale**: Cloudflare native services, optimized for each use case  
**Status**: Accepted  

### ADR-003: JWT-based Authentication with KV Sessions
**Decision**: Use JWT for stateless auth, KV for session management and blacklist  
**Rationale**: Scalable, supports distributed workers, flexible logout  
**Status**: Accepted  

### ADR-004: Granular RBAC with Permission Matrix
**Decision**: Define 50+ specific permissions, group into 7 roles  
**Rationale**: Fine-grained access control, auditable, flexible for Phase 2  
**Status**: Accepted  

---

**Document Version**: 1.0  
**Last Updated**: March 18, 2026  
**Next Review**: After Phase 1 completion
