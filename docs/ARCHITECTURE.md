# Architecture

## Platform

- Frontend: React 19 + TypeScript SPA built with Vite.
- Edge runtime: Cloudflare Workers + Hono API.
- Database: Cloudflare D1 as the transactional source of truth.
- Cache and ephemeral controls: Cloudflare KV.
- Binary/object storage: Cloudflare R2 for cover images, scans, member photos, receipts, and exports.
- Background work: Cloudflare Queues with a daily Cron Trigger for overdue reminder generation and cleanup.
- Concurrency-safe sequencing: Durable Object for accession number allocation.

## Domain boundaries

- `bibliographic_records` store title-level metadata and remain separate from `book_copies`.
- `book_copies`, `acquisition_records`, `barcodes`, `qr_links`, `rooms`, `racks`, and `shelves` cover physical inventory.
- `roles`, `permissions`, `role_permissions`, `users`, and `user_roles` define RBAC.
- `members`, `loans`, `loan_history`, `fines`, and `reminders` cover circulation and follow-up.
- `accounts`, `ledgers`, `payment_types`, `payments`, and `receipts` cover ledger-ready accounting.
- `competitions`, `competition_registrations`, and `competition_results` support public programs.
- `feature_flags`, `audit_logs`, `print_templates`, `print_jobs`, and `exports` support governance and operations.

## Security posture

- Passwords are hashed with a strong adaptive function before storage.
- Session cookies are `HttpOnly`, `Secure`, and server-validated.
- Mutating endpoints validate origin and role permissions server-side.
- Critical actions write audit events.
- Sensitive records use soft delete.
- Auth and public search endpoints are rate-limited with KV-backed counters.

## Localization

- Bangla is the primary UI language.
- Text is routed through a small translation layer so English can expand without changing route or domain contracts.
