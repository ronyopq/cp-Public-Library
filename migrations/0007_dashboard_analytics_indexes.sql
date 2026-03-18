PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_acquisition_records_acquired_on
  ON acquisition_records(acquired_on, acquisition_type);

CREATE INDEX IF NOT EXISTS idx_loans_issued_at_status
  ON loans(issued_at, status);

CREATE INDEX IF NOT EXISTS idx_book_contributors_role_name
  ON book_contributors(contributor_role, contributor_name_en);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs(created_at, action_key);
