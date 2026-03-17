-- ============================================================================
-- MIGRATION: 0003_add_roles_permissions.sql
-- DESCRIPTION: Populate default roles and permissions
-- DATE: 2026-03-18
-- ============================================================================

-- Insert Default Roles
INSERT INTO roles (role_id, name, description, hierarchy_level, status, created_at, updated_at)
VALUES
  ('role_super_admin', 'super_admin', 'Full system access', 0, 'active', unixepoch('now'), unixepoch('now')),
  ('role_admin', 'admin', 'All features except system settings', 1, 'active', unixepoch('now'), unixepoch('now')),
  ('role_librarian', 'librarian', 'Check in/out, reports', 2, 'active', unixepoch('now'), unixepoch('now')),
  ('role_member', 'member', 'Borrow, renew, view history', 3, 'active', unixepoch('now'), unixepoch('now')),
  ('role_guest', 'guest', 'View-only access', 4, 'active', unixepoch('now'), unixepoch('now')),
  ('role_auditor', 'auditor', 'View-only analytics', 5, 'active', unixepoch('now'), unixepoch('now')),
  ('role_system', 'system', 'Automated job execution', 6, 'active', unixepoch('now'), unixepoch('now'));

-- Insert Permissions: Book Management (8 permissions)
INSERT INTO permissions (permission_id, code, description, category, created_at)
VALUES
  ('perm_book_read', 'book:read', 'View book details', 'book', unixepoch('now')),
  ('perm_book_create', 'book:create', 'Add new books', 'book', unixepoch('now')),
  ('perm_book_update', 'book:update', 'Edit book metadata', 'book', unixepoch('now')),
  ('perm_book_delete', 'book:delete', 'Remove books', 'book', unixepoch('now')),
  ('perm_book_search', 'book:search', 'Full-text search', 'book', unixepoch('now')),
  ('perm_copy_read', 'copy:read', 'View copy status', 'copy', unixepoch('now')),
  ('perm_copy_create', 'copy:create', 'Add physical copy', 'copy', unixepoch('now')),
  ('perm_copy_update', 'copy:update', 'Update copy info', 'copy', unixepoch('now')),
  ('perm_copy_delete', 'copy:delete', 'Mark copy lost/damaged', 'copy', unixepoch('now')),
  ('perm_copy_list', 'copy:list', 'List all copies', 'copy', unixepoch('now'));

-- Insert Permissions: Member Management (6 permissions)
INSERT INTO permissions (permission_id, code, description, category, created_at)
VALUES
  ('perm_member_read', 'member:read', 'View member profile', 'member', unixepoch('now')),
  ('perm_member_create', 'member:create', 'Register member', 'member', unixepoch('now')),
  ('perm_member_update', 'member:update', 'Edit member details', 'member', unixepoch('now')),
  ('perm_member_delete', 'member:delete', 'Remove member', 'member', unixepoch('now')),
  ('perm_member_list', 'member:list', 'List all members', 'member', unixepoch('now')),
  ('perm_member_suspend', 'member:suspend', 'Suspend member access', 'member', unixepoch('now'));

-- Insert Permissions: Lending Operations (5 permissions)
INSERT INTO permissions (permission_id, code, description, category, created_at)
VALUES
  ('perm_loan_read', 'loan:read', 'View loan details', 'loan', unixepoch('now')),
  ('perm_loan_create', 'loan:create', 'Issue book', 'loan', unixepoch('now')),
  ('perm_loan_update', 'loan:update', 'Renew loan', 'loan', unixepoch('now')),
  ('perm_loan_return', 'loan:return', 'Return book', 'loan', unixepoch('now')),
  ('perm_loan_list', 'loan:list', 'List loans', 'loan', unixepoch('now'));

-- Insert Permissions: Fine Management (5 permissions)
INSERT INTO permissions (permission_id, code, description, category, created_at)
VALUES
  ('perm_fine_read', 'fine:read', 'View fine details', 'fine', unixepoch('now')),
  ('perm_fine_create', 'fine:create', 'Create fine', 'fine', unixepoch('now')),
  ('perm_fine_waive', 'fine:waive', 'Forgive fine', 'fine', unixepoch('now')),
  ('perm_fine_list', 'fine:list', 'List fines', 'fine', unixepoch('now')),
  ('perm_fine_delete', 'fine:delete', 'Delete fine', 'fine', unixepoch('now'));

-- Insert Permissions: Payment Management (5 permissions)
INSERT INTO permissions (permission_id, code, description, category, created_at)
VALUES
  ('perm_payment_read', 'payment:read', 'View payments', 'payment', unixepoch('now')),
  ('perm_payment_create', 'payment:create', 'Record payment', 'payment', unixepoch('now')),
  ('perm_payment_refund', 'payment:refund', 'Refund payment', 'payment', unixepoch('now')),
  ('perm_payment_list', 'payment:list', 'List payments', 'payment', unixepoch('now')),
  ('perm_payment_export', 'payment:export', 'Export payments', 'payment', unixepoch('now'));

-- Insert Permissions: Reports & Analytics (5 permissions)
INSERT INTO permissions (permission_id, code, description, category, created_at)
VALUES
  ('perm_report_read', 'report:read', 'View reports', 'admin', unixepoch('now')),
  ('perm_report_create', 'report:create', 'Generate reports', 'admin', unixepoch('now')),
  ('perm_report_export', 'report:export', 'Export reports', 'admin', unixepoch('now')),
  ('perm_admin_create', 'admin:create', 'Create admin accounts', 'admin', unixepoch('now')),
  ('perm_admin_manage', 'admin:manage', 'Manage admins', 'admin', unixepoch('now'));

-- Insert Permissions: Settings & Audit (7 permissions)
INSERT INTO permissions (permission_id, code, description, category, created_at)
VALUES
  ('perm_settings_read', 'settings:read', 'View settings', 'admin', unixepoch('now')),
  ('perm_settings_update', 'settings:update', 'Modify settings', 'admin', unixepoch('now')),
  ('perm_audit_read', 'audit:read', 'View audit log', 'audit', unixepoch('now')),
  ('perm_audit_export', 'audit:export', 'Export audit', 'audit', unixepoch('now')),
  ('perm_notification_send', 'notification:send', 'Send notifications', 'admin', unixepoch('now')),
  ('perm_user_create', 'user:create', 'Create users', 'admin', unixepoch('now')),
  ('perm_user_delete', 'user:delete', 'Delete users', 'admin', unixepoch('now'));

-- ============================================================================
-- Role Permission Matrix
-- ============================================================================

-- SUPER_ADMIN: All permissions
INSERT INTO role_permissions (role_permission_id, role_id, permission_id, created_at)
SELECT 'rp_super_' || p.permission_id, 'role_super_admin', p.permission_id, unixepoch('now')
FROM permissions p;

-- ADMIN: All except system settings
INSERT INTO role_permissions (role_permission_id, role_id, permission_id, created_at)
VALUES
  -- Books
  ('rp_admin_book_read', 'role_admin', 'perm_book_read', unixepoch('now')),
  ('rp_admin_book_create', 'role_admin', 'perm_book_create', unixepoch('now')),
  ('rp_admin_book_update', 'role_admin', 'perm_book_update', unixepoch('now')),
  ('rp_admin_book_delete', 'role_admin', 'perm_book_delete', unixepoch('now')),
  ('rp_admin_book_search', 'role_admin', 'perm_book_search', unixepoch('now')),
  ('rp_admin_copy_read', 'role_admin', 'perm_copy_read', unixepoch('now')),
  ('rp_admin_copy_create', 'role_admin', 'perm_copy_create', unixepoch('now')),
  ('rp_admin_copy_update', 'role_admin', 'perm_copy_update', unixepoch('now')),
  ('rp_admin_copy_delete', 'role_admin', 'perm_copy_delete', unixepoch('now')),
  ('rp_admin_copy_list', 'role_admin', 'perm_copy_list', unixepoch('now')),
  -- Members
  ('rp_admin_member_read', 'role_admin', 'perm_member_read', unixepoch('now')),
  ('rp_admin_member_create', 'role_admin', 'perm_member_create', unixepoch('now')),
  ('rp_admin_member_update', 'role_admin', 'perm_member_update', unixepoch('now')),
  ('rp_admin_member_delete', 'role_admin', 'perm_member_delete', unixepoch('now')),
  ('rp_admin_member_list', 'role_admin', 'perm_member_list', unixepoch('now')),
  ('rp_admin_member_suspend', 'role_admin', 'perm_member_suspend', unixepoch('now')),
  -- Loans
  ('rp_admin_loan_read', 'role_admin', 'perm_loan_read', unixepoch('now')),
  ('rp_admin_loan_create', 'role_admin', 'perm_loan_create', unixepoch('now')),
  ('rp_admin_loan_update', 'role_admin', 'perm_loan_update', unixepoch('now')),
  ('rp_admin_loan_return', 'role_admin', 'perm_loan_return', unixepoch('now')),
  ('rp_admin_loan_list', 'role_admin', 'perm_loan_list', unixepoch('now')),
  -- Fines & Payments
  ('rp_admin_fine_read', 'role_admin', 'perm_fine_read', unixepoch('now')),
  ('rp_admin_fine_create', 'role_admin', 'perm_fine_create', unixepoch('now')),
  ('rp_admin_fine_waive', 'role_admin', 'perm_fine_waive', unixepoch('now')),
  ('rp_admin_fine_list', 'role_admin', 'perm_fine_list', unixepoch('now')),
  ('rp_admin_payment_read', 'role_admin', 'perm_payment_read', unixepoch('now')),
  ('rp_admin_payment_create', 'role_admin', 'perm_payment_create', unixepoch('now')),
  ('rp_admin_payment_refund', 'role_admin', 'perm_payment_refund', unixepoch('now')),
  ('rp_admin_payment_list', 'role_admin', 'perm_payment_list', unixepoch('now')),
  -- Reports
  ('rp_admin_report_read', 'role_admin', 'perm_report_read', unixepoch('now')),
  ('rp_admin_report_create', 'role_admin', 'perm_report_create', unixepoch('now')),
  ('rp_admin_report_export', 'role_admin', 'perm_report_export', unixepoch('now')),
  ('rp_admin_audit_read', 'role_admin', 'perm_audit_read', unixepoch('now'));

-- LIBRARIAN: Books, Members, Loans, Reports (no deletions, no settings)
INSERT INTO role_permissions (role_permission_id, role_id, permission_id, created_at)
VALUES
  ('rp_librarian_book_read', 'role_librarian', 'perm_book_read', unixepoch('now')),
  ('rp_librarian_book_search', 'role_librarian', 'perm_book_search', unixepoch('now')),
  ('rp_librarian_copy_read', 'role_librarian', 'perm_copy_read', unixepoch('now')),
  ('rp_librarian_copy_list', 'role_librarian', 'perm_copy_list', unixepoch('now')),
  ('rp_librarian_member_read', 'role_librarian', 'perm_member_read', unixepoch('now')),
  ('rp_librarian_member_create', 'role_librarian', 'perm_member_create', unixepoch('now')),
  ('rp_librarian_member_update', 'role_librarian', 'perm_member_update', unixepoch('now')),
  ('rp_librarian_member_list', 'role_librarian', 'perm_member_list', unixepoch('now')),
  ('rp_librarian_loan_read', 'role_librarian', 'perm_loan_read', unixepoch('now')),
  ('rp_librarian_loan_create', 'role_librarian', 'perm_loan_create', unixepoch('now')),
  ('rp_librarian_loan_update', 'role_librarian', 'perm_loan_update', unixepoch('now')),
  ('rp_librarian_loan_return', 'role_librarian', 'perm_loan_return', unixepoch('now')),
  ('rp_librarian_loan_list', 'role_librarian', 'perm_loan_list', unixepoch('now')),
  ('rp_librarian_fine_read', 'role_librarian', 'perm_fine_read', unixepoch('now')),
  ('rp_librarian_fine_list', 'role_librarian', 'perm_fine_list', unixepoch('now')),
  ('rp_librarian_payment_read', 'role_librarian', 'perm_payment_read', unixepoch('now')),
  ('rp_librarian_payment_list', 'role_librarian', 'perm_payment_list', unixepoch('now')),
  ('rp_librarian_report_read', 'role_librarian', 'perm_report_read', unixepoch('now'));

-- MEMBER: View own profile, borrow, renew
INSERT INTO role_permissions (role_permission_id, role_id, permission_id, created_at)
VALUES
  ('rp_member_book_read', 'role_member', 'perm_book_read', unixepoch('now')),
  ('rp_member_book_search', 'role_member', 'perm_book_search', unixepoch('now')),
  ('rp_member_copy_read', 'role_member', 'perm_copy_read', unixepoch('now')),
  ('rp_member_member_read', 'role_member', 'perm_member_read', unixepoch('now')),
  ('rp_member_loan_read', 'role_member', 'perm_loan_read', unixepoch('now')),
  ('rp_member_loan_create', 'role_member', 'perm_loan_create', unixepoch('now')),
  ('rp_member_loan_update', 'role_member', 'perm_loan_update', unixepoch('now')),
  ('rp_member_fine_read', 'role_member', 'perm_fine_read', unixepoch('now')),
  ('rp_member_payment_read', 'role_member', 'perm_payment_read', unixepoch('now')),
  ('rp_member_payment_create', 'role_member', 'perm_payment_create', unixepoch('now'));

-- GUEST: View-only books
INSERT INTO role_permissions (role_permission_id, role_id, permission_id, created_at)
VALUES
  ('rp_guest_book_read', 'role_guest', 'perm_book_read', unixepoch('now')),
  ('rp_guest_book_search', 'role_guest', 'perm_book_search', unixepoch('now')),
  ('rp_guest_copy_read', 'role_guest', 'perm_copy_read', unixepoch('now'));

-- AUDITOR: Read-only access
INSERT INTO role_permissions (role_permission_id, role_id, permission_id, created_at)
VALUES
  ('rp_auditor_report_read', 'role_auditor', 'perm_report_read', unixepoch('now')),
  ('rp_auditor_audit_read', 'role_auditor', 'perm_audit_read', unixepoch('now')),
  ('rp_auditor_audit_export', 'role_auditor', 'perm_audit_export', unixepoch('now'));

-- SYSTEM: Automated operations (fine calculation, notifications)
INSERT INTO role_permissions (role_permission_id, role_id, permission_id, created_at)
VALUES
  ('rp_system_fine_create', 'role_system', 'perm_fine_create', unixepoch('now')),
  ('rp_system_fine_read', 'role_system', 'perm_fine_read', unixepoch('now')),
  ('rp_system_notification_send', 'role_system', 'perm_notification_send', unixepoch('now')),
  ('rp_system_loan_read', 'role_system', 'perm_loan_read', unixepoch('now'));
