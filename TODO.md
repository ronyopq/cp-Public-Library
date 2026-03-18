# Progress Log

## Done

- Created the React + TypeScript project baseline and installed Cloudflare Worker, validation, printing, and testing dependencies.
- Defined Cloudflare deployment configuration for D1, KV, R2, Queue, Cron, and Durable Object bindings.
- Added shared domain constants, utility helpers, and validation contracts to keep worker and client aligned.
- Added PWA manifest, offline page, and a service worker entry for installable/offline behavior.
- Added an architecture decision record, ERD/data model documentation, and a role-permission matrix.
- Replaced the first-pass schema with a normalized D1 migration covering RBAC, cataloging, inventory, circulation, accounting, printing, competitions, exports, and audit logs.
- Added reference seed data for roles, permissions, categories, publishers, languages, feature flags, payment types, starter accounts, and print templates.
- Added D1-backed authentication, password hashing, secure session cookies, and server-side RBAC enforcement.
- Added bootstrap setup, login/logout, password change/reset, protected routes, and a role-aware application shell.
- Added Super Admin settings foundations for branding, metadata, menu/widget visibility, social links, and public feature toggles.
- Added user management flows with role assignment, permission overrides, deactivation, and audit logging for auth/settings/user changes.
- Verified `typecheck`, `lint`, `build`, and applied local D1 migration `0002_auth_and_shell.sql`.
- Added catalog intake schema extensions, R2-backed asset upload flow, ISBN/source URL/AI-assisted metadata draft generation, duplicate detection, and reviewed save flow with bibliographic records separated from physical copies.
- Added the Bangla-first book intake UI with mobile camera/gallery uploads, client-side cover processing, duplicate resolution choices, and protected route wiring for catalog staff.
- Verified `typecheck`, `lint`, `build`, and applied local D1 migration `0003_catalog_intake_extensions.sql`.
- Added member management APIs and Bangla-first staff UI for member create/update/archive, mobile camera/gallery photo upload, searchable listings, detailed borrowing/payment history, and RBAC-protected privacy controls.
- Added self-service member profile rendering inside the account area, R2-backed private photo delivery, ID card preview generation, and single/bulk ID card print job creation with audit logging.
- Verified `typecheck`, `lint`, `build`, and applied local D1 migration `0004_member_indexes_and_printing.sql`.
- Added the circulation backend with issue/return/renew flows, barcode-based copy lookup, reservation handling, overdue snapshot refresh, fine assessment/payment recording, and reminder scheduling backed by D1 + Queues + Cron.
- Added a Bangla-first circulation workspace for quick issue/return, due and overdue loan lists, reservation creation/cancellation, reminder logs, and manager-only policy/reminder settings.
- Verified `typecheck`, `lint`, `build`, and applied local D1 migration `0005_circulation_and_reminders.sql`.
- Added accounting schema extensions for fee types, member due periods, payment allocations, richer receipts, report/export metadata, and ledger links via local migration `0006_accounting_and_reports.sql`.
- Added Bangla-first accounting APIs and UI for dues collection, multi-month payment allocation, member ledgers, receipt reprint, fee-type administration, report filtering, CSV export, HTML print preview, and manager-only payment voiding with audit logs.
- Verified `typecheck`, `lint`, `build`, `db:migrate:local`, and `db:seed:local` after the accounting implementation.
- Added public catalog APIs and Bangla-first public pages for search, filter, newest/popular sorting, safe public book details, and QR-code-based redirection to public book pages.
- Added competition management APIs and staff UI for create/update, registration oversight, result entry/publication, and public visibility controls, plus public competition listing, registration, acknowledgement, and result pages.
- Verified `typecheck`, `lint`, `build`, and `db:migrate:local` after the public catalog and competition implementation.

## In Progress

- Worker API architecture and shared TypeScript contracts are being expanded further into copy management, print center workflows, exports, and dashboard analytics depth.
- Bangla-first responsive frontend shell is in place across admin and public flows and still needs deeper coverage for copy inventory, print center, and richer analytics/report presentation.

## Next

- Implement copy/item management, print-center operations, and deeper accounting statement/export workflows.
- Build the remaining dashboard widgets, more advanced public search refinements, and print/export pipelines.
- Add route-level tests and end-to-end auth/RBAC coverage against local D1.
