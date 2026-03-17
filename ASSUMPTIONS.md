# Assumptions & Design Defaults

## Core Business Assumptions

### Library Configuration
- **Timezone**: Asia/Dhaka (hardcoded, non-negotiable)
- **Default Language**: Bangla (বাংলা), English as fallback
- **Membership Types**: STUDENT, STAFF, GENERAL, LIFE
- **Default Loan Duration**: 14 days
- **Maximum Renewals**: 2 per book
- **Maximum Books per Member**: 5 simultaneous

### Lending Rules
- **Grace Period**: 7 days after due date before fine applies
- **Fine Structure**: BDT 5 per day, capped at BDT 100 per book
- **Overdue Detection**: Nightly cron job at 12:00 AM Asia/Dhaka
- **First Login**: Enforces password reset

### Book Management
- **Accession Number Pattern**: YY-XXXX (e.g., 24-0001)
- **Copy Numbers**: YY-XXXX-02, YY-XXXX-03, etc. for multiple copies
- **Barcode Formats**: CODE128 (primary), QR_CODE (optional)
- **ISBN**: Optional but preferred
- **Condition States**: NEW → GOOD → WORN → DAMAGED → LOST, or WITHDRAWN, or REPAIR

### Member Management
- **Phone**: Unique, primary identifier
- **Membership Number**: Auto-generated on registration
- **Soft Delete**: Members marked `deleted_at` can be restored
- **Status Transitions**: ACTIVE ↔ SUSPENDED ↔ EXPIRED ↔ INACTIVE

### Authentication & Security
- **Password Hashing**: bcryptjs with cost factor 12
- **Session Management**: JWT access token (15 min) + KV cache
- **Failed Logins**: 10 attempts → 15-minute lockout
- **Rate Limiting**: Global 100 req/min per IP
- **RBAC Enforcement**: Middleware-level on all protected routes

### Data Governance
- **Source of Truth**: D1 (immutable, ACID)
- **KV Usage**: Cache, sessions, feature flags only (no critical data)
- **R2 Usage**: Images, PDFs, exports
- **Soft Deletes**: All user-facing records, 7-day recovery window

## Technical Assumptions

### Cloudflare Services
- **D1 Limits**: Max 4 GB per database
- **KV Limits**: Used for cache and sessions only
- **Workers Timeout**: 30 seconds (retry logic required)

### API Design
- **Error Responses**: Structured JSON with code, message, details
- **Pagination**: Cursor-based, 50 items per page
- **Validation**: Zod schemas on HTTP boundary

### Frontend Architecture
- **Language Toggle**: Client-side routing (no page reload)
- **PWA**: Offline read-only mode
- **Responsive**: sm (640px), md (768px), lg (1024px), xl (1280px)

## Known Limitations

1. **Concurrent Availability**: Uses single Boolean (`is_available`); may need journaling at scale
2. **Real-Time Notifications**: Cron-based reminders only (no live push)
3. **Search**: Basic LIKE queries only (full-text search future phase)
4. **D1 Size**: Plan migration at 2 GB
5. **Email/SMS**: Optional integrations via third parties

## Configuration Checklist

Before production:

- [ ] Admin settings customized (library name, address, phone)
- [ ] Fine rules created and tested
- [ ] Loan duration configured
- [ ] Initial Super Admin user created
- [ ] R2 bucket CORS enabled
- [ ] Backup schedule verified
- [ ] Feature flags reviewed
- [ ] Email provider configured (if used)
- [ ] Monitoring/alerting setup

## Role Hierarchy

```
Public Visitor (no auth)
  ↓
Member / Reader (self-service, limited view)
  ↓
Librarian (create/read, cannot delete)
  ↓
Officer (create/read/update, key reports)
  ↓
Manager (full CRUD, approve sensitive actions)
  ↓
Admin (all operational control)
  ↓
Super Admin (system-wide config, user management)
```

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Soft deletes over hard deletes | Data recovery, audit trails, referential integrity |
| Ledger entries for all fines | Immutable audit trail for accounting |
| Accession numbers sequential | Global uniqueness, prevents race conditions |
| Feature flags in D1 + KV | Runtime control without redeployment |
| Bangla-first UI | Primary user base in Bangladesh |
| Timezone hardcoded | Prevents confusion; all times in UTC internally |
| Max 5 concurrent borrows | Prevents overdue accumulation |
| 7-day grace period | Aligns with Bangladeshi practices |
| UUID for IDs | Better distribution for future sharding |
