-- ============================================================================
-- MIGRATION: 0002_add_indexes.sql
-- DESCRIPTION: Add performance indexes to tables
-- DATE: 2026-03-18
-- ============================================================================

-- Users & Members Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_membership_number ON members(membership_number);
CREATE INDEX IF NOT EXISTS idx_members_role_id ON members(role_id);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);

-- Books Indexes
CREATE INDEX IF NOT EXISTS idx_bibliographic_isbn ON bibliographic_records(isbn);
CREATE INDEX IF NOT EXISTS idx_bibliographic_publisher ON bibliographic_records(publisher_id);
CREATE INDEX IF NOT EXISTS idx_bibliographic_status ON bibliographic_records(status);
CREATE INDEX IF NOT EXISTS idx_physical_copies_accession ON physical_copies(accession_number);
CREATE INDEX IF NOT EXISTS idx_physical_copies_barcode ON physical_copies(barcode);
CREATE INDEX IF NOT EXISTS idx_physical_copies_bibliographic ON physical_copies(bibliographic_id);
CREATE INDEX IF NOT EXISTS idx_physical_copies_status ON physical_copies(status);
CREATE INDEX IF NOT EXISTS idx_physical_copies_location ON physical_copies(location);

-- Loan Indexes
CREATE INDEX IF NOT EXISTS idx_loans_copy_id ON loans(copy_id);
CREATE INDEX IF NOT EXISTS idx_loans_member_id ON loans(member_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_due_date ON loans(due_date);
CREATE INDEX IF NOT EXISTS idx_loans_issue_date ON loans(issue_date);
CREATE INDEX IF NOT EXISTS idx_loans_member_status ON loans(member_id, status);
CREATE INDEX IF NOT EXISTS idx_loan_history_member_id ON loan_history(member_id);
CREATE INDEX IF NOT EXISTS idx_loan_history_copy_id ON loan_history(copy_id);

-- Fine & Payment Indexes
CREATE INDEX IF NOT EXISTS idx_fines_member_id ON fines(member_id);
CREATE INDEX IF NOT EXISTS idx_fines_status ON fines(status);
CREATE INDEX IF NOT EXISTS idx_fines_loan_id ON fines(loan_id);
CREATE INDEX IF NOT EXISTS idx_payments_member_id ON payments(member_id);
CREATE INDEX IF NOT EXISTS idx_payments_fine_id ON payments(fine_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);

-- Audit Log Indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_member_id ON audit_log(member_id);

-- Notification Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, recipient_type);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Settings Indexes
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_scope ON settings(scope);

-- Category Indexes
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_status ON categories(status);
