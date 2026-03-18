PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS fee_types (
  id TEXT PRIMARY KEY,
  fee_code TEXT NOT NULL UNIQUE,
  base_code TEXT,
  name_bn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_bn TEXT,
  description_en TEXT,
  collection_mode TEXT NOT NULL CHECK (collection_mode IN ('monthly', 'one_time')),
  default_amount REAL NOT NULL DEFAULT 0,
  allow_custom_amount INTEGER NOT NULL DEFAULT 1,
  allow_multi_month INTEGER NOT NULL DEFAULT 0,
  income_account_id TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  is_system INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 50,
  created_by_user_id TEXT,
  updated_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (income_account_id) REFERENCES accounts(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS member_fee_periods (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  fee_type_id TEXT NOT NULL,
  period_month TEXT NOT NULL,
  due_date TEXT,
  expected_amount REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  waived_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partial', 'paid', 'waived', 'cancelled')),
  note TEXT,
  source_module TEXT NOT NULL DEFAULT 'accounts',
  created_by_user_id TEXT,
  updated_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (fee_type_id) REFERENCES fee_types(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS payment_allocations (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL,
  member_id TEXT,
  fee_type_id TEXT,
  due_entry_id TEXT,
  fine_id TEXT,
  allocation_kind TEXT NOT NULL CHECK (allocation_kind IN ('due', 'advance', 'direct', 'fine')),
  period_month TEXT,
  amount REAL NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES payments(id),
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (fee_type_id) REFERENCES fee_types(id),
  FOREIGN KEY (due_entry_id) REFERENCES member_fee_periods(id),
  FOREIGN KEY (fine_id) REFERENCES fines(id)
);

ALTER TABLE payments ADD COLUMN fee_type_id TEXT REFERENCES fee_types(id);
ALTER TABLE payments ADD COLUMN metadata_json TEXT;
ALTER TABLE payments ADD COLUMN updated_at TEXT;
ALTER TABLE payments ADD COLUMN updated_by_user_id TEXT REFERENCES users(id);
ALTER TABLE payments ADD COLUMN deleted_at TEXT;
ALTER TABLE payments ADD COLUMN voided_at TEXT;
ALTER TABLE payments ADD COLUMN voided_by_user_id TEXT REFERENCES users(id);
ALTER TABLE payments ADD COLUMN void_reason TEXT;

ALTER TABLE receipts ADD COLUMN member_id TEXT REFERENCES members(id);
ALTER TABLE receipts ADD COLUMN payment_snapshot_json TEXT;
ALTER TABLE receipts ADD COLUMN reprint_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE receipts ADD COLUMN last_reprinted_at TEXT;
ALTER TABLE receipts ADD COLUMN last_reprinted_by_user_id TEXT REFERENCES users(id);
ALTER TABLE receipts ADD COLUMN updated_at TEXT;

ALTER TABLE ledgers ADD COLUMN journal_group_id TEXT;
ALTER TABLE ledgers ADD COLUMN member_id TEXT REFERENCES members(id);
ALTER TABLE ledgers ADD COLUMN payment_id TEXT REFERENCES payments(id);
ALTER TABLE ledgers ADD COLUMN fee_type_id TEXT REFERENCES fee_types(id);
ALTER TABLE ledgers ADD COLUMN due_entry_id TEXT REFERENCES member_fee_periods(id);
ALTER TABLE ledgers ADD COLUMN source_module TEXT;

ALTER TABLE exports ADD COLUMN filter_json TEXT;
ALTER TABLE exports ADD COLUMN file_name TEXT;

UPDATE payments
SET
  updated_at = COALESCE(updated_at, created_at),
  updated_by_user_id = COALESCE(updated_by_user_id, received_by_user_id);

UPDATE receipts
SET
  member_id = COALESCE(
    member_id,
    (
      SELECT payments.member_id
      FROM payments
      WHERE payments.id = receipts.payment_id
      LIMIT 1
    )
  ),
  updated_at = COALESCE(updated_at, created_at);

UPDATE ledgers
SET source_module = COALESCE(source_module, 'legacy')
WHERE source_module IS NULL;

INSERT OR IGNORE INTO accounts (id, account_code, account_name_bn, account_name_en, account_type, owner_type, owner_id, active)
VALUES
  ('acct_bank', '1020-BANK', 'ব্যাংক ক্লিয়ারিং', 'Bank clearing', 'asset', NULL, NULL, 1),
  ('acct_donation_income', '4020-DONATION', 'দান আয়', 'Donation income', 'income', NULL, NULL, 1),
  ('acct_exam_income', '4030-EXAM', 'পরীক্ষা ফি আয়', 'Exam fee income', 'income', NULL, NULL, 1),
  ('acct_competition_income', '4040-COMPETITION', 'প্রতিযোগিতা ফি আয়', 'Competition fee income', 'income', NULL, NULL, 1),
  ('acct_rental_income', '4050-RENTAL', 'বই ভাড়া আয়', 'Book rental income', 'income', NULL, NULL, 1),
  ('acct_other_income', '4060-OTHER', 'অন্যান্য আয়', 'Other income', 'income', NULL, NULL, 1);

INSERT OR IGNORE INTO fee_types (
  id,
  fee_code,
  base_code,
  name_bn,
  name_en,
  description_bn,
  description_en,
  collection_mode,
  default_amount,
  allow_custom_amount,
  allow_multi_month,
  income_account_id,
  active,
  is_system,
  sort_order
)
VALUES
  (
    'fee_monthly_subscription',
    'monthly_subscription',
    'monthly_subscription',
    'মাসিক সাবস্ক্রিপশন',
    'Monthly subscription',
    'মাসভিত্তিক সদস্য চাঁদা ও সাবস্ক্রিপশন আদায়',
    'Recurring monthly membership dues',
    'monthly',
    100,
    1,
    1,
    'acct_membership_income',
    1,
    1,
    10
  ),
  (
    'fee_donation',
    'donation',
    'donation',
    'দান',
    'Donation',
    'স্বেচ্ছা অনুদান',
    'Voluntary donation',
    'one_time',
    0,
    1,
    0,
    'acct_donation_income',
    1,
    1,
    20
  ),
  (
    'fee_fine',
    'fine',
    'fine',
    'জরিমানা',
    'Fine',
    'জরিমানা আদায়',
    'Fine collection',
    'one_time',
    0,
    1,
    0,
    'acct_fine_income',
    1,
    1,
    30
  ),
  (
    'fee_exam',
    'exam_fee',
    'exam_fee',
    'পরীক্ষা ফি',
    'Exam fee',
    'পরীক্ষা বা মূল্যায়ন সংক্রান্ত ফি',
    'Exam or assessment fee',
    'one_time',
    0,
    1,
    0,
    'acct_exam_income',
    1,
    1,
    40
  ),
  (
    'fee_competition',
    'competition_fee',
    'competition_fee',
    'প্রতিযোগিতা ফি',
    'Competition fee',
    'প্রতিযোগিতা নিবন্ধন বা অংশগ্রহণ ফি',
    'Competition registration fee',
    'one_time',
    0,
    1,
    0,
    'acct_competition_income',
    1,
    1,
    50
  ),
  (
    'fee_book_rental',
    'book_rental_fee',
    'book_rental_fee',
    'বই ভাড়া ফি',
    'Book rental fee',
    'স্বল্পমেয়াদি ভাড়া বা ব্যবহার ফি',
    'Book rental fee',
    'one_time',
    0,
    1,
    0,
    'acct_rental_income',
    1,
    1,
    60
  ),
  (
    'fee_other',
    'other_fee',
    'other_fee',
    'অন্যান্য ফি',
    'Other fee',
    'অন্যান্য প্রশাসনিক বা সেবা ফি',
    'Other administrative fee',
    'one_time',
    0,
    1,
    0,
    'acct_other_income',
    1,
    1,
    70
  );

CREATE INDEX IF NOT EXISTS idx_fee_types_active ON fee_types(active, sort_order);
CREATE INDEX IF NOT EXISTS idx_member_fee_periods_member ON member_fee_periods(member_id, period_month);
CREATE INDEX IF NOT EXISTS idx_member_fee_periods_fee_type ON member_fee_periods(fee_type_id, period_month);
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_fee_periods_unique
  ON member_fee_periods(member_id, fee_type_id, period_month)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_member ON payment_allocations(member_id, period_month);
CREATE INDEX IF NOT EXISTS idx_payments_fee_type ON payments(fee_type_id, paid_at);
CREATE INDEX IF NOT EXISTS idx_payments_voided ON payments(voided_at, deleted_at);
CREATE INDEX IF NOT EXISTS idx_receipts_member ON receipts(member_id, issued_at);
CREATE INDEX IF NOT EXISTS idx_ledgers_journal_group ON ledgers(journal_group_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_ledgers_member_date ON ledgers(member_id, entry_date);
