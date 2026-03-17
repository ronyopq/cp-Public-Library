# Data Model and ERD

## Core modeling principles

- Bibliographic records are title-level. A single record may have many physical copies.
- Physical copies are inventory-level. Each copy has its own accession code, condition, barcode, QR, location, and acquisition history.
- Members are library patrons and may optionally link to a `users` record for portal access.
- Financial state is ledger-ready. Payments, receipts, fines, accounts, and ledgers remain separate.
- Generic operational artifacts such as barcodes, QR links, print jobs, and exports are modeled explicitly.

## Security and Identity ERD

```mermaid
erDiagram
  roles ||--o{ user_roles : assigns
  users ||--o{ user_roles : receives
  roles ||--o{ role_permissions : grants
  permissions ||--o{ role_permissions : contains
  users ||--o{ audit_logs : creates
  users ||--o| members : links

  roles {
    text id PK
    text role_key UK
    int rank_order
  }
  permissions {
    text id PK
    text permission_key UK
    text module_name
  }
  user_roles {
    text user_id FK
    text role_id FK
    int is_primary
  }
  users {
    text id PK
    text email UK
    text status
  }
  members {
    text id PK
    text user_id FK
    text member_no UK
    text status
  }
```

## Catalog and Inventory ERD

```mermaid
erDiagram
  publishers ||--o{ bibliographic_records : publishes
  languages ||--o{ bibliographic_records : marks
  categories ||--o{ bibliographic_records : classifies
  bibliographic_records ||--o{ book_contributors : credits
  bibliographic_records ||--o{ book_copies : owns
  acquisition_records ||--o{ book_copies : supplies
  rooms ||--o{ racks : contains
  racks ||--o{ shelves : contains
  shelves ||--o{ book_copies : stores
  book_copies ||--o{ barcodes : tags
  book_copies ||--o{ qr_links : links
  bibliographic_records ||--o{ qr_links : links

  bibliographic_records {
    text id PK
    text isbn_13 UK
    text title_en
    text publisher_id FK
    text language_id FK
    text primary_category_id FK
  }
  book_contributors {
    text id PK
    text bibliographic_record_id FK
    text contributor_role
    int sort_order
  }
  acquisition_records {
    text id PK
    text acquisition_code UK
    text acquisition_type
  }
  book_copies {
    text id PK
    text bibliographic_record_id FK
    text accession_code UK
    text shelf_id FK
    text condition_status
    text availability_status
  }
  rooms {
    text id PK
    text room_code UK
  }
  racks {
    text id PK
    text room_id FK
    text rack_code UK
  }
  shelves {
    text id PK
    text rack_id FK
    text shelf_code UK
  }
```

## Circulation and Accounting ERD

```mermaid
erDiagram
  members ||--o{ loans : borrows
  book_copies ||--o{ loans : circulates
  loans ||--o{ loan_history : records
  loans ||--o{ fines : accrues
  members ||--o{ fines : owes
  members ||--o{ payments : pays
  fines ||--o{ payments : settles
  payment_types ||--o{ payments : classifies
  accounts ||--o{ payments : receives
  payments ||--|| receipts : issues
  accounts ||--o{ ledgers : posts

  loans {
    text id PK
    text book_copy_id FK
    text member_id FK
    text status
    text due_at
  }
  fines {
    text id PK
    text loan_id FK
    text member_id FK
    real assessed_amount
    text status
  }
  payments {
    text id PK
    text member_id FK
    text fine_id FK
    text payment_type_id FK
    text account_id FK
    real amount
  }
  receipts {
    text id PK
    text payment_id FK
    text receipt_no UK
  }
  ledgers {
    text id PK
    text account_id FK
    text direction
    real amount
  }
```

## Programs and Operations ERD

```mermaid
erDiagram
  competitions ||--o{ competition_registrations : receives
  competition_registrations ||--o{ competition_results : produces
  competitions ||--o{ competition_results : publishes
  loans ||--o{ reminders : schedules
  feature_flags ||--o{ audit_logs : affects
  print_templates ||--o{ print_jobs : powers
  users ||--o{ print_jobs : requests
  users ||--o{ exports : requests

  competitions {
    text id PK
    text slug UK
    text status
  }
  competition_registrations {
    text id PK
    text competition_id FK
    text payment_id FK
    text status
  }
  competition_results {
    text id PK
    text competition_id FK
    text registration_id FK
    int position_rank
  }
  print_templates {
    text id PK
    text template_key UK
    text template_type
  }
  print_jobs {
    text id PK
    text template_id FK
    text job_type
    text status
  }
  exports {
    text id PK
    text export_type
    text export_format
    text status
  }
```

## Table notes

- `book_contributors` intentionally keeps contributor names inline so cataloging stays simple for community libraries; an authority table can be added later without changing the title/copy boundary.
- `barcodes` and `qr_links` are polymorphic so the same print pipeline can serve copies, members, receipts, and competition assets.
- `accounts` supports both control accounts and future member-specific subaccounts through `owner_type` and `owner_id`.
