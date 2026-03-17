# ADR 0001: Cloudflare-Native Foundation

## Status

Accepted

## Context

The system must support a real community or organizational public library in Bangladesh with:

- Bangla-first UX and `Asia/Dhaka` timezone defaults
- transactional lending and accounting integrity
- title-level catalog data separated from copy-level inventory
- mobile-first operations, printing, reminders, exports, and public catalog access
- low-ops deployment on Cloudflare

## Decision

We will use a Cloudflare-native full-stack architecture:

- Cloudflare Workers for the full-stack edge application and API layer
- Cloudflare D1 as the source of truth for relational, lending, accounting, RBAC, and print/export job state
- Cloudflare KV only for cache, rate limiting, and lightweight feature-flag cache copies
- Cloudflare R2 for covers, member photos, scans, receipts, reports, and export artifacts
- Cloudflare Queues and Cron Triggers for overdue reminders, export processing, retries, and scheduled maintenance
- Durable Objects for concurrency-safe accession sequence allocation and future print coordination
- React + TypeScript frontend with shared validation/types across client and worker

## Consequences

Positive:

- Single deployment surface with globally distributed access
- clear separation between durable transactional data and ephemeral cache/state
- clean edge-native path for reminders, printing, exports, and media handling
- schema and services are TypeScript-aligned and ready for modular scaling

Trade-offs:

- D1 encourages careful SQL-first modeling and explicit service boundaries
- polymorphic resources such as barcodes and QR links use application-level integrity rules
- some heavy asynchronous tasks should be offloaded to queues rather than handled inline

## Domain boundary decisions

- `bibliographic_records` store title and edition metadata only
- `book_copies` store physical accession, condition, location, barcode, QR, and acquisition references
- `loans`, `fines`, `payments`, `ledgers`, and `receipts` remain distinct so circulation and accounting stay auditable
- RBAC is normalized through `roles`, `permissions`, `role_permissions`, and `user_roles`
