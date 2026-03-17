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

## In Progress

- Worker API architecture and shared TypeScript contracts are being expanded from auth/admin into the remaining library modules.
- Bangla-first responsive frontend shell is in place and needs deeper module coverage for cataloging, members, circulation, and finance.

## Next

- Implement copy/item management, members, circulation, reminders, and accounting APIs on top of the new catalog intake foundation.
- Build the remaining dashboard widgets, public catalog flows, competition operations, and print pipelines.
- Add route-level tests and end-to-end auth/RBAC coverage against local D1.
