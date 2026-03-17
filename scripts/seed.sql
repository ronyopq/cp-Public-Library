-- scripts/seed.sql

-- Insert Roles
INSERT INTO roles (id, name, hierarchy_level, description, active) VALUES
('role_public', 'Public', 0, 'Unauthenticated users - Browse catalog only', 1),
('role_member', 'Member', 1, 'Library member - Can borrow, renew, check fines', 1),
('role_librarian', 'Librarian', 2, 'Front desk staff - Issue, return, check status', 1),
('role_officer', 'Officer', 3, 'Senior librarian - Manage books, members, reports', 1),
('role_manager', 'Manager', 4, 'Departmental manager - Edit, delete, configure settings', 1),
('role_admin', 'Admin', 5, 'System admin - All operational control', 1),
('role_super_admin', 'Super Admin', 6, 'Super user - All permissions, system config', 1);

-- Insert Permissions (simplified - only key ones shown)
INSERT INTO permissions (id, name, category, description, active) VALUES
('perm_books_read', 'books:read', 'books', 'Read book catalog', 1),
('perm_books_create', 'books:create', 'books', 'Create new book records', 1),
('perm_books_update', 'books:update', 'books', 'Update book metadata', 1),
('perm_books_delete', 'books:delete', 'books', 'Delete book records', 1),
('perm_members_read', 'members:read', 'members', 'View member details', 1),
('perm_members_create', 'members:create', 'members', 'Register new member', 1),
('perm_members_update', 'members:update', 'members', 'Update member info', 1),
('perm_members_delete', 'members:delete', 'members', 'Soft-delete member', 1),
('perm_loans_read', 'loans:read', 'loans', 'View loan records', 1),
('perm_loans_create', 'loans:create', 'loans', 'Issue book to member', 1),
('perm_loans_return', 'loans:return', 'loans', 'Accept book return', 1),
('perm_loans_renew', 'loans:renew', 'loans', 'Renew a loan', 1),
('perm_fines_read', 'fines:read', 'fines', 'View fines', 1),
('perm_fines_create', 'fines:create', 'fines', 'Record a fine', 1),
('perm_payments_read', 'payments:read', 'fines', 'View payment records', 1),
('perm_payments_create', 'payments:create', 'fines', 'Record payment receipt', 1),
('perm_admin_settings', 'admin:settings', 'admin', 'Configure settings', 1),
('perm_admin_users', 'admin:users', 'admin', 'Manage staff users', 1),
('perm_admin_audit', 'admin:audit', 'admin', 'View audit logs', 1);

-- Insert Role-Permission mappings
INSERT INTO role_permissions (role_id, permission_id) VALUES
('role_public', 'perm_books_read');

-- Member permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
('role_member', 'perm_books_read'),
('role_member', 'perm_loans_read'),
('role_member', 'perm_members_read'),
('role_member', 'perm_loans_renew'),
('role_member', 'perm_fines_read'),
('role_member', 'perm_payments_read');

-- Librarian permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
('role_librarian', 'perm_books_read'),
('role_librarian', 'perm_books_create'),
('role_librarian', 'perm_books_update'),
('role_librarian', 'perm_loans_read'),
('role_librarian', 'perm_loans_create'),
('role_librarian', 'perm_loans_return'),
('role_librarian', 'perm_members_read'),
('role_librarian', 'perm_members_create'),
('role_librarian', 'perm_members_update'),
('role_librarian', 'perm_fines_read'),
('role_librarian', 'perm_fines_create'),
('role_librarian', 'perm_payments_read'),
('role_librarian', 'perm_payments_create');

-- Officer permissions (all create/read/update)
INSERT INTO role_permissions (role_id, permission_id) VALUES
('role_officer', 'perm_books_read'),
('role_officer', 'perm_books_create'),
('role_officer', 'perm_books_update'),
('role_officer', 'perm_members_read'),
('role_officer', 'perm_members_create'),
('role_officer', 'perm_members_update'),
('role_officer', 'perm_loans_read'),
('role_officer', 'perm_loans_create'),
('role_officer', 'perm_loans_return'),
('role_officer', 'perm_loans_renew'),
('role_officer', 'perm_fines_read'),
('role_officer', 'perm_fines_create'),
('role_officer', 'perm_payments_read'),
('role_officer', 'perm_payments_create');

-- Manager permissions (full CRUD)
INSERT INTO role_permissions (role_id, permission_id) VALUES
('role_manager', 'perm_books_read'),
('role_manager', 'perm_books_create'),
('role_manager', 'perm_books_update'),
('role_manager', 'perm_books_delete'),
('role_manager', 'perm_members_read'),
('role_manager', 'perm_members_create'),
('role_manager', 'perm_members_update'),
('role_manager', 'perm_members_delete'),
('role_manager', 'perm_loans_read'),
('role_manager', 'perm_loans_create'),
('role_manager', 'perm_loans_return'),
('role_manager', 'perm_loans_renew'),
('role_manager', 'perm_fines_read'),
('role_manager', 'perm_fines_create'),
('role_manager', 'perm_payments_read'),
('role_manager', 'perm_payments_create'),
('role_manager', 'perm_admin_settings');

-- Admin permissions (all except user/audit admin)
INSERT INTO role_permissions (role_id, permission_id) VALUES
('role_admin', 'perm_books_read'),
('role_admin', 'perm_books_create'),
('role_admin', 'perm_books_update'),
('role_admin', 'perm_books_delete'),
('role_admin', 'perm_members_read'),
('role_admin', 'perm_members_create'),
('role_admin', 'perm_members_update'),
('role_admin', 'perm_members_delete'),
('role_admin', 'perm_loans_read'),
('role_admin', 'perm_loans_create'),
('role_admin', 'perm_loans_return'),
('role_admin', 'perm_loans_renew'),
('role_admin', 'perm_fines_read'),
('role_admin', 'perm_fines_create'),
('role_admin', 'perm_payments_read'),
('role_admin', 'perm_payments_create'),
('role_admin', 'perm_admin_settings'),
('role_admin', 'perm_admin_audit');

-- Super Admin: ALL permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role_super_admin', id FROM permissions WHERE active = 1;

-- Insert Languages
INSERT INTO languages (id, name, code) VALUES
('lang_bn', 'Bengali', 'bn'),
('lang_en', 'English', 'en'),
('lang_hi', 'Hindi', 'hi'),
('lang_ur', 'Urdu', 'ur'),
('lang_ar', 'Arabic', 'ar'),
('lang_fr', 'French', 'fr');

-- Insert Categories
INSERT INTO categories (id, name, code, description) VALUES
('cat_fiction', 'Fiction', 'FIC', 'Novels and short stories'),
('cat_nonfiction', 'Non-Fiction', 'NFI', 'Educational and reference materials'),
('cat_science', 'Science', 'SCI', 'Scientific and technical books'),
('cat_history', 'History', 'HIS', 'History and biography'),
('cat_children', 'Children', 'CHI', 'Books for children'),
('cat_reference', 'Reference', 'REF', 'Encyclopedias and references');

-- Insert Payment Types
INSERT INTO payment_types (id, name, code) VALUES
('ptype_cash', 'Cash', 'CASH'),
('ptype_card', 'Card', 'CARD'),
('ptype_check', 'Check', 'CHECK'),
('ptype_bank', 'Bank Transfer', 'BANK_TRANSFER');

-- Insert Fine Rules
INSERT INTO fine_rules (id, max_days_before_fine, fine_per_day, max_fine_per_book, description) VALUES
('fine_default', 7, 5.00, 100.00, 'Default fine rule - 5 BDT per day after 7 days grace');

-- Insert Feature Flags
INSERT INTO feature_flags (id, key, description, enabled, visible_to_members) VALUES
('flag_renewal', 'enable_online_renewal', 'Allow online renewal', 0, 1),
('flag_holds', 'enable_holds', 'Allow book holds', 0, 1),
('flag_fine_grace', 'enable_fine_grace', 'Apply grace period', 1, 0),
('flag_sms', 'enable_sms_reminders', 'Send SMS reminders', 0, 0),
('flag_email', 'enable_email_reminders', 'Send email reminders', 0, 0);

-- Insert Admin Settings
INSERT INTO admin_settings (id, category, key, value, description, data_type) VALUES
('set_name_bn', 'library_info', 'library_name', 'সম্প্রদায় পাবলিক লাইব্রেরি', 'Library name in Bangla', 'STRING'),
('set_name_en', 'library_info', 'library_name_en', 'Community Public Library', 'Library name in English', 'STRING'),
('set_addr', 'library_info', 'library_address', 'ঢাকা, বাংলাদেশ', 'Physical address', 'STRING'),
('set_phone', 'library_info', 'library_phone', '+880-XX-XXXXXXXX', 'Contact phone', 'STRING'),
('set_tz', 'library_info', 'timezone', 'Asia/Dhaka', 'Timezone', 'STRING'),
('set_loan_days', 'lending_rules', 'default_loan_days', '14', 'Default loan duration', 'INT'),
('set_max_renew', 'lending_rules', 'max_renewals', '2', 'Maximum renewals', 'INT'),
('set_max_books', 'lending_rules', 'max_books_per_member', '5', 'Max books per member', 'INT');
