PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);
CREATE INDEX IF NOT EXISTS idx_members_name_bn ON members(full_name_bn);
CREATE INDEX IF NOT EXISTS idx_members_name_en ON members(full_name_en);
CREATE INDEX IF NOT EXISTS idx_members_status_expiry ON members(status, membership_expires_at);
CREATE INDEX IF NOT EXISTS idx_members_user_id ON members(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status_paid_at ON payments(status, paid_at);
CREATE INDEX IF NOT EXISTS idx_print_templates_type_active ON print_templates(template_type, active, deleted_at);
