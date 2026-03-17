PRAGMA foreign_keys = ON;

ALTER TABLE loans ADD COLUMN expected_return_at TEXT;
ALTER TABLE loans ADD COLUMN overdue_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE loans ADD COLUMN fine_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE loans ADD COLUMN remarks TEXT;
ALTER TABLE loans ADD COLUMN resolution_code TEXT CHECK (resolution_code IN ('returned', 'damaged', 'lost', 'withdrawn', 'repair'));
ALTER TABLE loans ADD COLUMN fine_updated_at TEXT;

UPDATE loans
SET
  expected_return_at = COALESCE(expected_return_at, due_at),
  overdue_days = COALESCE(overdue_days, 0),
  fine_amount = COALESCE(fine_amount, 0)
WHERE expected_return_at IS NULL
   OR overdue_days IS NULL
   OR fine_amount IS NULL;

CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  bibliographic_record_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  requested_copy_id TEXT,
  ready_copy_id TEXT,
  fulfilled_loan_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ready', 'fulfilled', 'cancelled', 'expired')),
  queue_position INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  ready_at TEXT,
  expires_at TEXT,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (bibliographic_record_id) REFERENCES bibliographic_records(id),
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (requested_copy_id) REFERENCES book_copies(id),
  FOREIGN KEY (ready_copy_id) REFERENCES book_copies(id),
  FOREIGN KEY (fulfilled_loan_id) REFERENCES loans(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

ALTER TABLE reminders ADD COLUMN reservation_id TEXT REFERENCES reservations(id);
ALTER TABLE reminders ADD COLUMN template_key TEXT;
ALTER TABLE reminders ADD COLUMN rule_key TEXT;
ALTER TABLE reminders ADD COLUMN provider_key TEXT NOT NULL DEFAULT 'whatsapp_stub';
ALTER TABLE reminders ADD COLUMN delivery_status TEXT NOT NULL DEFAULT 'queued' CHECK (delivery_status IN ('queued', 'sent', 'failed', 'retried', 'cancelled'));
ALTER TABLE reminders ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reminders ADD COLUMN last_attempt_at TEXT;
ALTER TABLE reminders ADD COLUMN last_error TEXT;
ALTER TABLE reminders ADD COLUMN next_retry_at TEXT;
ALTER TABLE reminders ADD COLUMN payload_json TEXT;
ALTER TABLE reminders ADD COLUMN recipient_address TEXT;

UPDATE reminders
SET delivery_status = CASE status
  WHEN 'queued' THEN 'queued'
  WHEN 'sent' THEN 'sent'
  WHEN 'failed' THEN 'failed'
  WHEN 'cancelled' THEN 'cancelled'
  ELSE 'queued'
END
WHERE delivery_status IS NULL OR delivery_status = '';

CREATE INDEX IF NOT EXISTS idx_loans_expected_return ON loans(expected_return_at, status);
CREATE INDEX IF NOT EXISTS idx_loans_fine_updated ON loans(fine_updated_at);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status, created_at);
CREATE INDEX IF NOT EXISTS idx_reservations_member ON reservations(member_id, status);
CREATE INDEX IF NOT EXISTS idx_reservations_record ON reservations(bibliographic_record_id, status);
CREATE INDEX IF NOT EXISTS idx_reminders_delivery_status ON reminders(delivery_status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_reminders_retry ON reminders(next_retry_at, delivery_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_unique_active_member_record
  ON reservations(member_id, bibliographic_record_id)
  WHERE status IN ('active', 'ready') AND deleted_at IS NULL;
