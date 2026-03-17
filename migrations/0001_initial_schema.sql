PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  role_key TEXT NOT NULL UNIQUE,
  name_bn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  rank_order INTEGER NOT NULL,
  is_system_role INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  permission_key TEXT NOT NULL UNIQUE,
  module_name TEXT NOT NULL,
  description_bn TEXT NOT NULL,
  description_en TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (permission_id) REFERENCES permissions(id)
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name_bn TEXT NOT NULL,
  full_name_en TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  default_locale TEXT NOT NULL DEFAULT 'bn-BD',
  timezone TEXT NOT NULL DEFAULT 'Asia/Dhaka',
  must_change_password INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assigned_by_user_id TEXT,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (assigned_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS feature_flags (
  id TEXT PRIMARY KEY,
  flag_key TEXT NOT NULL UNIQUE,
  name_bn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_bn TEXT,
  description_en TEXT,
  audience_scope TEXT NOT NULL DEFAULT 'internal',
  enabled INTEGER NOT NULL DEFAULT 0,
  visible_to_public INTEGER NOT NULL DEFAULT 0,
  updated_by_user_id TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS publishers (
  id TEXT PRIMARY KEY,
  publisher_code TEXT UNIQUE,
  name_bn TEXT NOT NULL,
  name_en TEXT,
  city TEXT,
  country TEXT DEFAULT 'Bangladesh',
  website_url TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  category_code TEXT NOT NULL UNIQUE,
  name_bn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (parent_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS languages (
  id TEXT PRIMARY KEY,
  iso_code TEXT NOT NULL UNIQUE,
  name_bn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  script_name TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bibliographic_records (
  id TEXT PRIMARY KEY,
  record_code TEXT UNIQUE,
  isbn_10 TEXT UNIQUE,
  isbn_13 TEXT UNIQUE,
  title_bn TEXT,
  title_en TEXT NOT NULL,
  subtitle_bn TEXT,
  subtitle_en TEXT,
  edition_statement TEXT,
  publisher_id TEXT,
  language_id TEXT,
  primary_category_id TEXT,
  publication_year INTEGER,
  number_of_pages INTEGER,
  summary TEXT,
  subject_keywords TEXT,
  cover_r2_key TEXT,
  source_url TEXT,
  source_note TEXT,
  metadata_status TEXT NOT NULL DEFAULT 'draft' CHECK (metadata_status IN ('draft', 'review', 'active', 'archived')),
  normalized_title TEXT NOT NULL,
  search_blob TEXT,
  created_by_user_id TEXT,
  updated_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (publisher_id) REFERENCES publishers(id),
  FOREIGN KEY (language_id) REFERENCES languages(id),
  FOREIGN KEY (primary_category_id) REFERENCES categories(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS book_contributors (
  id TEXT PRIMARY KEY,
  bibliographic_record_id TEXT NOT NULL,
  contributor_name_bn TEXT,
  contributor_name_en TEXT NOT NULL,
  contributor_role TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  authority_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bibliographic_record_id) REFERENCES bibliographic_records(id)
);

CREATE TABLE IF NOT EXISTS acquisition_records (
  id TEXT PRIMARY KEY,
  acquisition_code TEXT NOT NULL UNIQUE,
  acquisition_type TEXT NOT NULL CHECK (acquisition_type IN ('purchase', 'gift', 'donation', 'replacement', 'other')),
  source_name TEXT,
  invoice_or_reference TEXT,
  donor_name TEXT,
  acquired_on TEXT NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'BDT',
  unit_cost REAL,
  total_cost REAL,
  note TEXT,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL UNIQUE,
  name_bn TEXT NOT NULL,
  name_en TEXT,
  floor_label TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS racks (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  rack_code TEXT NOT NULL UNIQUE,
  name_bn TEXT NOT NULL,
  name_en TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE TABLE IF NOT EXISTS shelves (
  id TEXT PRIMARY KEY,
  rack_id TEXT NOT NULL,
  shelf_code TEXT NOT NULL UNIQUE,
  name_bn TEXT NOT NULL,
  name_en TEXT,
  sequence_no INTEGER NOT NULL DEFAULT 1,
  category_hint TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (rack_id) REFERENCES racks(id)
);

CREATE TABLE IF NOT EXISTS book_copies (
  id TEXT PRIMARY KEY,
  bibliographic_record_id TEXT NOT NULL,
  acquisition_record_id TEXT,
  shelf_id TEXT,
  accession_code TEXT NOT NULL UNIQUE,
  accession_sequence INTEGER NOT NULL UNIQUE,
  copy_number INTEGER NOT NULL,
  copy_label TEXT,
  condition_status TEXT NOT NULL CHECK (condition_status IN ('new', 'good', 'worn', 'damaged', 'lost', 'withdrawn', 'repair')),
  availability_status TEXT NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available', 'on_loan', 'reserved', 'repair', 'lost', 'withdrawn')),
  source_note TEXT,
  last_inventory_checked_at TEXT,
  note TEXT,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (bibliographic_record_id) REFERENCES bibliographic_records(id),
  FOREIGN KEY (acquisition_record_id) REFERENCES acquisition_records(id),
  FOREIGN KEY (shelf_id) REFERENCES shelves(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS barcodes (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  symbology TEXT NOT NULL DEFAULT 'code128',
  barcode_value TEXT NOT NULL UNIQUE,
  printable_label TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qr_links (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  target_type TEXT NOT NULL,
  target_path TEXT NOT NULL,
  payload_json TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE,
  member_no TEXT NOT NULL UNIQUE,
  full_name_bn TEXT NOT NULL,
  full_name_en TEXT,
  guardian_name TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  national_id TEXT,
  date_of_birth TEXT,
  address_line TEXT NOT NULL,
  area TEXT,
  district TEXT,
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  membership_expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'expired')),
  photo_r2_key TEXT,
  note TEXT,
  created_by_user_id TEXT,
  updated_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  account_code TEXT NOT NULL UNIQUE,
  account_name_bn TEXT NOT NULL,
  account_name_en TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'income', 'expense', 'equity', 'receivable')),
  owner_type TEXT,
  owner_id TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  book_copy_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  issued_by_user_id TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  due_at TEXT NOT NULL,
  returned_at TEXT,
  returned_by_user_id TEXT,
  renewed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'returned', 'overdue', 'lost', 'closed')),
  issue_note TEXT,
  return_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_copy_id) REFERENCES book_copies(id),
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (issued_by_user_id) REFERENCES users(id),
  FOREIGN KEY (returned_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS loan_history (
  id TEXT PRIMARY KEY,
  loan_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  previous_status TEXT,
  next_status TEXT,
  event_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_user_id TEXT,
  note TEXT,
  metadata_json TEXT,
  FOREIGN KEY (loan_id) REFERENCES loans(id),
  FOREIGN KEY (actor_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS fines (
  id TEXT PRIMARY KEY,
  loan_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  assessed_amount REAL NOT NULL,
  waived_amount REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partial', 'paid', 'waived', 'cancelled')),
  reason_code TEXT NOT NULL DEFAULT 'overdue',
  note TEXT,
  assessed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  settled_at TEXT,
  created_by_user_id TEXT,
  FOREIGN KEY (loan_id) REFERENCES loans(id),
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  loan_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  reminder_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  scheduled_for TEXT NOT NULL,
  sent_at TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'cancelled')),
  dedupe_key TEXT NOT NULL UNIQUE,
  content_snapshot TEXT,
  provider_reference TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (loan_id) REFERENCES loans(id),
  FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE TABLE IF NOT EXISTS payment_types (
  id TEXT PRIMARY KEY,
  payment_type_code TEXT NOT NULL UNIQUE,
  name_bn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  requires_reference INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  member_id TEXT,
  fine_id TEXT,
  payment_type_id TEXT NOT NULL,
  account_id TEXT,
  amount REAL NOT NULL,
  paid_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  reference_no TEXT,
  external_reference TEXT,
  note TEXT,
  received_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (fine_id) REFERENCES fines(id),
  FOREIGN KEY (payment_type_id) REFERENCES payment_types(id),
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (received_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  receipt_no TEXT NOT NULL UNIQUE,
  payment_id TEXT NOT NULL UNIQUE,
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  file_r2_key TEXT,
  print_job_id TEXT,
  issued_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES payments(id),
  FOREIGN KEY (issued_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ledgers (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
  amount REAL NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'BDT',
  reference_type TEXT,
  reference_id TEXT,
  narration TEXT,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS competitions (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title_bn TEXT NOT NULL,
  title_en TEXT,
  description TEXT,
  registration_fee_amount REAL NOT NULL DEFAULT 0,
  registration_opens_at TEXT,
  registration_closes_at TEXT,
  event_date TEXT,
  result_published_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed', 'published', 'archived')),
  visible_to_public INTEGER NOT NULL DEFAULT 1,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS competition_registrations (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL,
  member_id TEXT,
  payment_id TEXT,
  participant_name TEXT NOT NULL,
  guardian_name TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  category_label TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rejected')),
  note TEXT,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (competition_id) REFERENCES competitions(id),
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (payment_id) REFERENCES payments(id)
);

CREATE TABLE IF NOT EXISTS competition_results (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL,
  registration_id TEXT,
  position_rank INTEGER,
  position_label TEXT NOT NULL,
  score REAL,
  published_note TEXT,
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by_user_id TEXT,
  FOREIGN KEY (competition_id) REFERENCES competitions(id),
  FOREIGN KEY (registration_id) REFERENCES competition_registrations(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS print_templates (
  id TEXT PRIMARY KEY,
  template_key TEXT NOT NULL UNIQUE,
  template_type TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  page_size TEXT NOT NULL,
  config_json TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  updated_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS print_jobs (
  id TEXT PRIMARY KEY,
  template_id TEXT,
  job_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_ids_json TEXT NOT NULL,
  requested_by_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  output_r2_key TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (template_id) REFERENCES print_templates(id),
  FOREIGN KEY (requested_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS exports (
  id TEXT PRIMARY KEY,
  export_type TEXT NOT NULL,
  export_format TEXT NOT NULL,
  requested_tables_json TEXT NOT NULL,
  requested_by_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  output_r2_key TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY (requested_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  actor_role_key TEXT,
  actor_display_name TEXT NOT NULL,
  action_key TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  request_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  before_json TEXT,
  after_json TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module_name);
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(flag_key);
CREATE INDEX IF NOT EXISTS idx_bibliographic_title ON bibliographic_records(normalized_title);
CREATE INDEX IF NOT EXISTS idx_bibliographic_category ON bibliographic_records(primary_category_id);
CREATE INDEX IF NOT EXISTS idx_bibliographic_publisher ON bibliographic_records(publisher_id);
CREATE INDEX IF NOT EXISTS idx_book_contributors_record ON book_contributors(bibliographic_record_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_book_copies_record ON book_copies(bibliographic_record_id);
CREATE INDEX IF NOT EXISTS idx_book_copies_shelf ON book_copies(shelf_id);
CREATE INDEX IF NOT EXISTS idx_barcodes_entity ON barcodes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_qr_links_entity ON qr_links(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_members_member_no ON members(member_no);
CREATE INDEX IF NOT EXISTS idx_loans_member ON loans(member_id, status);
CREATE INDEX IF NOT EXISTS idx_loans_copy ON loans(book_copy_id, status);
CREATE INDEX IF NOT EXISTS idx_loans_due_at ON loans(due_at);
CREATE INDEX IF NOT EXISTS idx_loan_history_loan ON loan_history(loan_id, event_at);
CREATE INDEX IF NOT EXISTS idx_fines_member ON fines(member_id, status);
CREATE INDEX IF NOT EXISTS idx_reminders_schedule ON reminders(scheduled_for, status);
CREATE INDEX IF NOT EXISTS idx_payments_member ON payments(member_id, paid_at);
CREATE INDEX IF NOT EXISTS idx_ledgers_account_date ON ledgers(account_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_competition_registrations_competition ON competition_registrations(competition_id, status);
CREATE INDEX IF NOT EXISTS idx_competition_results_competition ON competition_results(competition_id, position_rank);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_exports_status ON exports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at);
