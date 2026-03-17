-- ============================================================================
-- ROLES & PERMISSIONS (Base RBAC)
-- ============================================================================

CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  hierarchy_level INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE role_permissions (
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  granted_by TEXT,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (permission_id) REFERENCES permissions(id)
);

-- ============================================================================
-- USERS (Staff & Administrators)
-- ============================================================================

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  last_login TIMESTAMP,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_deleted ON users(deleted_at);

-- ============================================================================
-- LIBRARY REFERENCE DATA
-- ============================================================================

CREATE TABLE languages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE publishers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  country TEXT,
  city TEXT,
  website TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT UNIQUE,
  description TEXT,
  parent_category_id TEXT,
  dewey_code TEXT,
  icon_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  FOREIGN KEY (parent_category_id) REFERENCES categories(id)
);

CREATE INDEX idx_categories_parent ON categories(parent_category_id);

CREATE TABLE contributors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  birth_year INTEGER,
  country TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- ============================================================================
-- BIBLIOGRAPHIC RECORDS (Book Metadata)
-- ============================================================================

CREATE TABLE bibliographic_records (
  id TEXT PRIMARY KEY,
  isbn TEXT UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  edition TEXT,
  language_id TEXT NOT NULL,
  publisher_id TEXT,
  publication_year INTEGER,
  pages INTEGER,
  description TEXT,
  category_id TEXT,
  cover_image_url TEXT,
  cover_image_r2_key TEXT,
  metadata_source TEXT NOT NULL DEFAULT 'MANUAL',
  isbn_metadata JSON,
  duplicate_check_status TEXT DEFAULT 'PENDING',
  visibility_public BOOLEAN NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  FOREIGN KEY (language_id) REFERENCES languages(id),
  FOREIGN KEY (publisher_id) REFERENCES publishers(id),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE INDEX idx_bibliographic_isbn ON bibliographic_records(isbn);
CREATE INDEX idx_bibliographic_title ON bibliographic_records(title);
CREATE INDEX idx_bibliographic_category ON bibliographic_records(category_id);
CREATE INDEX idx_bibliographic_deleted ON bibliographic_records(deleted_at);

CREATE TABLE book_contributors (
  id TEXT PRIMARY KEY,
  bibliographic_record_id TEXT NOT NULL,
  contributor_id TEXT NOT NULL,
  role TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (bibliographic_record_id, contributor_id, role),
  FOREIGN KEY (bibliographic_record_id) REFERENCES bibliographic_records(id),
  FOREIGN KEY (contributor_id) REFERENCES contributors(id)
);

CREATE INDEX idx_book_contributors_bib ON book_contributors(bibliographic_record_id);
CREATE INDEX idx_book_contributors_contrib ON book_contributors(contributor_id);

-- ============================================================================
-- SHELVES & LOCATION HIERARCHY
-- ============================================================================

CREATE TABLE shelves (
  id TEXT PRIMARY KEY,
  room TEXT NOT NULL,
  rack TEXT NOT NULL,
  shelf_number INTEGER NOT NULL,
  segment TEXT,
  call_number TEXT,
  capacity INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (room, rack, shelf_number)
);

CREATE INDEX idx_shelves_room ON shelves(room);

-- ============================================================================
-- BOOK COPIES (Physical Items)
-- ============================================================================

CREATE TABLE book_copies (
  id TEXT PRIMARY KEY,
  bibliographic_record_id TEXT NOT NULL,
  accession_number TEXT NOT NULL UNIQUE,
  accession_year INTEGER NOT NULL,
  copy_number INTEGER NOT NULL DEFAULT 1,
  barcode TEXT UNIQUE,
  barcode_type TEXT,
  qr_code TEXT UNIQUE,
  qr_public_url TEXT,
  shelf_id TEXT,
  condition TEXT NOT NULL DEFAULT 'NEW',
  acquisition_type TEXT NOT NULL DEFAULT 'PURCHASE',
  acquisition_cost DECIMAL(10, 2),
  acquisition_date DATE NOT NULL,
  acquisition_source TEXT,
  donor_name TEXT,
  acquisition_notes TEXT,
  pages_damaged INTEGER,
  internal_notes TEXT,
  is_available BOOLEAN NOT NULL DEFAULT 1,
  last_loan_date DATE,
  last_return_date DATE,
  total_loans INTEGER NOT NULL DEFAULT 0,
  print_history JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  FOREIGN KEY (bibliographic_record_id) REFERENCES bibliographic_records(id),
  FOREIGN KEY (shelf_id) REFERENCES shelves(id)
);

CREATE INDEX idx_book_copies_bib ON book_copies(bibliographic_record_id);
CREATE INDEX idx_book_copies_accession ON book_copies(accession_number);
CREATE INDEX idx_book_copies_barcode ON book_copies(barcode);
CREATE INDEX idx_book_copies_available ON book_copies(is_available);
CREATE INDEX idx_book_copies_deleted ON book_copies(deleted_at);
CREATE INDEX idx_book_copies_shelf ON book_copies(shelf_id);

-- ============================================================================
-- MEMBERS (Library Patrons)
-- ============================================================================

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  membership_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  address TEXT NOT NULL,
  city TEXT,
  membership_type TEXT NOT NULL DEFAULT 'GENERAL',
  membership_status TEXT NOT NULL DEFAULT 'ACTIVE',
  membership_start_date DATE NOT NULL,
  membership_expiry_date DATE,
  member_photo_url TEXT,
  member_photo_r2_key TEXT,
  date_of_birth DATE,
  guardian_name TEXT,
  id_card_number TEXT,
  outstanding_fine DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_books_borrowed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_members_phone ON members(phone);
CREATE INDEX idx_members_email ON members(email);
CREATE INDEX idx_members_membership_number ON members(membership_number);
CREATE INDEX idx_members_status ON members(membership_status);
CREATE INDEX idx_members_deleted ON members(deleted_at);

-- ============================================================================
-- LOANS (Lending Transactions)
-- ============================================================================

CREATE TABLE loans (
  id TEXT PRIMARY KEY,
  book_copy_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  issued_by TEXT NOT NULL,
  issued_date DATE NOT NULL,
  due_date DATE NOT NULL,
  returned_date DATE,
  return_accepted_by TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  renewal_count INTEGER NOT NULL DEFAULT 0,
  is_overdue BOOLEAN NOT NULL DEFAULT 0,
  fine_amount DECIMAL(10, 2),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_copy_id) REFERENCES book_copies(id),
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (issued_by) REFERENCES users(id),
  FOREIGN KEY (return_accepted_by) REFERENCES users(id)
);

CREATE INDEX idx_loans_member ON loans(member_id, status);
CREATE INDEX idx_loans_copy ON loans(book_copy_id);
CREATE INDEX idx_loans_due_date ON loans(due_date);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_is_overdue ON loans(is_overdue);

CREATE TABLE loan_history (
  id TEXT PRIMARY KEY,
  loan_id TEXT NOT NULL,
  action TEXT NOT NULL,
  action_by TEXT,
  action_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (loan_id) REFERENCES loans(id),
  FOREIGN KEY (action_by) REFERENCES users(id)
);

CREATE INDEX idx_loan_history_loan ON loan_history(loan_id);
CREATE INDEX idx_loan_history_action ON loan_history(action, action_date DESC);

-- ============================================================================
-- FINES & ACCOUNTS
-- ============================================================================

CREATE TABLE fine_rules (
  id TEXT PRIMARY KEY,
  max_days_before_fine INTEGER NOT NULL DEFAULT 7,
  fine_per_day DECIMAL(10, 2) NOT NULL,
  max_fine_per_book DECIMAL(10, 2) NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fines (
  id TEXT PRIMARY KEY,
  loan_id TEXT,
  member_id TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  reason TEXT NOT NULL,
  fine_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  paid_date DATE,
  paid_via TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (loan_id) REFERENCES loans(id),
  FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE INDEX idx_fines_member ON fines(member_id, status);
CREATE INDEX idx_fines_loan ON fines(loan_id);
CREATE INDEX idx_fines_status ON fines(status);

CREATE TABLE payment_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_type_id TEXT NOT NULL,
  payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  receipt_number TEXT UNIQUE,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (payment_type_id) REFERENCES payment_types(id)
);

CREATE INDEX idx_payments_member ON payments(member_id);
CREATE INDEX idx_payments_date ON payments(payment_date DESC);

CREATE TABLE ledger_entries (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  balance_after DECIMAL(10, 2) NOT NULL,
  related_fine_id TEXT,
  related_payment_id TEXT,
  notes TEXT,
  created_by TEXT,
  transaction_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (related_fine_id) REFERENCES fines(id),
  FOREIGN KEY (related_payment_id) REFERENCES payments(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_ledger_member ON ledger_entries(member_id, transaction_date DESC);

CREATE TABLE receipts (
  id TEXT PRIMARY KEY,
  payment_id TEXT,
  member_id TEXT NOT NULL,
  receipt_number TEXT NOT NULL UNIQUE,
  items JSON NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  pdf_url TEXT,
  pdf_r2_key TEXT,
  issued_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  issued_by TEXT,
  FOREIGN KEY (payment_id) REFERENCES payments(id),
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (issued_by) REFERENCES users(id)
);

CREATE INDEX idx_receipts_member ON receipts(member_id);
CREATE INDEX idx_receipts_number ON receipts(receipt_number);

-- ============================================================================
-- REMINDERS (Email/SMS Notifications)
-- ============================================================================

CREATE TABLE reminders (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  loan_id TEXT,
  reminder_type TEXT NOT NULL,
  scheduled_date DATETIME NOT NULL,
  sent_date DATETIME,
  sent_via TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_date DATETIME,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (loan_id) REFERENCES loans(id)
);

CREATE INDEX idx_reminders_status ON reminders(status, scheduled_date);
CREATE INDEX idx_reminders_member ON reminders(member_id);

-- ============================================================================
-- COMPETITIONS
-- ============================================================================

CREATE TABLE competitions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  rules TEXT,
  max_participants INTEGER,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_competitions_status ON competitions(status);

CREATE TABLE competition_registrations (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  registered_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  score DECIMAL(10, 2),
  rank INTEGER,
  status TEXT NOT NULL DEFAULT 'REGISTERED',
  metadata JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (competition_id, member_id),
  FOREIGN KEY (competition_id) REFERENCES competitions(id),
  FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE INDEX idx_comp_reg_competition ON competition_registrations(competition_id);

CREATE TABLE competition_results (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL,
  registration_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  rank INTEGER NOT NULL,
  score DECIMAL(10, 2) NOT NULL,
  prize TEXT,
  published_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (competition_id, member_id),
  FOREIGN KEY (competition_id) REFERENCES competitions(id),
  FOREIGN KEY (registration_id) REFERENCES competition_registrations(id),
  FOREIGN KEY (member_id) REFERENCES members(id)
);

-- ============================================================================
-- FEATURE FLAGS & ADMIN SETTINGS
-- ============================================================================

CREATE TABLE feature_flags (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT 0,
  visible_to_members BOOLEAN NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin_settings (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  data_type TEXT NOT NULL DEFAULT 'STRING',
  updated_by TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (category, key),
  FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE INDEX idx_admin_settings_category ON admin_settings(category);

-- ============================================================================
-- AUDIT LOGS
-- ============================================================================

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  old_values JSON,
  new_values JSON,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'SUCCESS',
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- ============================================================================
-- PRINT JOBS & TEMPLATES
-- ============================================================================

CREATE TABLE print_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  template_type TEXT NOT NULL,
  html_template TEXT NOT NULL,
  css_styles TEXT,
  width_mm DECIMAL(10, 2),
  height_mm DECIMAL(10, 2),
  margin_mm DECIMAL(10, 2),
  created_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE print_jobs (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  job_type TEXT NOT NULL,
  data JSON NOT NULL,
  total_items INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  pdf_url TEXT,
  pdf_r2_key TEXT,
  error_message TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES print_templates(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_print_jobs_status ON print_jobs(status, created_at DESC);

-- ============================================================================
-- DATA EXPORTS & BACKUPS
-- ============================================================================

CREATE TABLE exports (
  id TEXT PRIMARY KEY,
  export_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  file_url TEXT,
  file_r2_key TEXT,
  record_count INTEGER,
  file_size_bytes INTEGER,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  expires_at TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_exports_status ON exports(status);
