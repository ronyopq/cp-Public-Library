PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO roles (id, role_key, name_bn, name_en, rank_order) VALUES
  ('role_public', 'public', 'পাবলিক', 'Public', 10),
  ('role_member', 'member', 'সদস্য', 'Member', 20),
  ('role_librarian', 'librarian', 'লাইব্রেরিয়ান', 'Librarian', 50),
  ('role_officer', 'officer', 'অফিসার', 'Officer', 60),
  ('role_manager', 'manager', 'ম্যানেজার', 'Manager', 70),
  ('role_admin', 'admin', 'অ্যাডমিন', 'Admin', 90),
  ('role_super_admin', 'super_admin', 'সুপার অ্যাডমিন', 'Super Admin', 100);

INSERT OR IGNORE INTO permissions (id, permission_key, module_name, description_bn, description_en) VALUES
  ('perm_catalog_view_public', 'catalog.view_public', 'catalog', 'পাবলিক ক্যাটালগ দেখা', 'View public catalog'),
  ('perm_catalog_view_internal', 'catalog.view_internal', 'catalog', 'ইন্টারনাল ক্যাটালগ দেখা', 'View internal catalog'),
  ('perm_catalog_manage', 'catalog.manage_metadata', 'catalog', 'বইয়ের মেটাডাটা পরিচালনা', 'Manage bibliographic metadata'),
  ('perm_copies_manage', 'copies.manage', 'inventory', 'কপি ও ইনভেন্টরি পরিচালনা', 'Manage book copies and inventory'),
  ('perm_members_manage', 'members.manage', 'members', 'সদস্য তথ্য পরিচালনা', 'Manage members'),
  ('perm_members_self', 'members.self_service', 'members', 'নিজস্ব সদস্য তথ্য দেখা', 'View own member profile'),
  ('perm_circulation_manage', 'circulation.manage', 'circulation', 'ইস্যু, রিটার্ন ও রিনিউ', 'Issue, return, and renew loans'),
  ('perm_loans_view_own', 'loans.view_own', 'circulation', 'নিজের ঋণ অবস্থা দেখা', 'View own loans'),
  ('perm_fines_manage', 'fines.manage', 'accounts', 'জরিমানা হিসাব পরিচালনা', 'Manage fines'),
  ('perm_accounts_view', 'accounts.view', 'accounts', 'হিসাব দেখা', 'View accounts'),
  ('perm_accounts_manage', 'accounts.manage', 'accounts', 'হিসাব ও পেমেন্ট পরিচালনা', 'Manage accounts and payments'),
  ('perm_reports_view', 'reports.view', 'reports', 'রিপোর্ট দেখা', 'View reports'),
  ('perm_competitions_manage', 'competitions.manage', 'competitions', 'প্রতিযোগিতা পরিচালনা', 'Manage competitions'),
  ('perm_competitions_register', 'competitions.register', 'competitions', 'প্রতিযোগিতায় নিবন্ধন', 'Register for competitions'),
  ('perm_settings_manage', 'settings.manage', 'settings', 'সিস্টেম সেটিংস পরিচালনা', 'Manage application settings'),
  ('perm_feature_flags_manage', 'feature_flags.manage', 'settings', 'ফিচার ফ্ল্যাগ পরিচালনা', 'Manage feature flags'),
  ('perm_users_manage', 'users.manage', 'security', 'ইউজার ও ভূমিকা পরিচালনা', 'Manage users'),
  ('perm_roles_manage', 'roles.manage', 'security', 'ভূমিকা ও পারমিশন পরিচালনা', 'Manage roles and permissions'),
  ('perm_audit_view', 'audit.view', 'security', 'অডিট লগ দেখা', 'View audit logs'),
  ('perm_prints_manage', 'prints.manage', 'printing', 'প্রিন্ট টেমপ্লেট ও জব পরিচালনা', 'Manage print templates and jobs'),
  ('perm_exports_manage', 'exports.manage', 'operations', 'এক্সপোর্ট ও ব্যাকআপ পরিচালনা', 'Manage exports and backups');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('role_public', 'perm_catalog_view_public'),
  ('role_public', 'perm_competitions_register'),

  ('role_member', 'perm_catalog_view_public'),
  ('role_member', 'perm_members_self'),
  ('role_member', 'perm_loans_view_own'),
  ('role_member', 'perm_competitions_register'),

  ('role_librarian', 'perm_catalog_view_internal'),
  ('role_librarian', 'perm_catalog_manage'),
  ('role_librarian', 'perm_copies_manage'),
  ('role_librarian', 'perm_members_manage'),
  ('role_librarian', 'perm_circulation_manage'),
  ('role_librarian', 'perm_reports_view'),
  ('role_librarian', 'perm_prints_manage'),

  ('role_officer', 'perm_catalog_view_internal'),
  ('role_officer', 'perm_catalog_manage'),
  ('role_officer', 'perm_copies_manage'),
  ('role_officer', 'perm_members_manage'),
  ('role_officer', 'perm_circulation_manage'),
  ('role_officer', 'perm_fines_manage'),
  ('role_officer', 'perm_accounts_view'),
  ('role_officer', 'perm_reports_view'),
  ('role_officer', 'perm_prints_manage'),
  ('role_officer', 'perm_exports_manage'),

  ('role_manager', 'perm_catalog_view_internal'),
  ('role_manager', 'perm_catalog_manage'),
  ('role_manager', 'perm_copies_manage'),
  ('role_manager', 'perm_members_manage'),
  ('role_manager', 'perm_circulation_manage'),
  ('role_manager', 'perm_fines_manage'),
  ('role_manager', 'perm_accounts_view'),
  ('role_manager', 'perm_accounts_manage'),
  ('role_manager', 'perm_reports_view'),
  ('role_manager', 'perm_competitions_manage'),
  ('role_manager', 'perm_prints_manage'),
  ('role_manager', 'perm_exports_manage'),
  ('role_manager', 'perm_audit_view'),

  ('role_admin', 'perm_catalog_view_internal'),
  ('role_admin', 'perm_catalog_manage'),
  ('role_admin', 'perm_copies_manage'),
  ('role_admin', 'perm_members_manage'),
  ('role_admin', 'perm_circulation_manage'),
  ('role_admin', 'perm_fines_manage'),
  ('role_admin', 'perm_accounts_view'),
  ('role_admin', 'perm_accounts_manage'),
  ('role_admin', 'perm_reports_view'),
  ('role_admin', 'perm_competitions_manage'),
  ('role_admin', 'perm_settings_manage'),
  ('role_admin', 'perm_feature_flags_manage'),
  ('role_admin', 'perm_users_manage'),
  ('role_admin', 'perm_prints_manage'),
  ('role_admin', 'perm_exports_manage'),
  ('role_admin', 'perm_audit_view'),

  ('role_super_admin', 'perm_catalog_view_public'),
  ('role_super_admin', 'perm_catalog_view_internal'),
  ('role_super_admin', 'perm_catalog_manage'),
  ('role_super_admin', 'perm_copies_manage'),
  ('role_super_admin', 'perm_members_manage'),
  ('role_super_admin', 'perm_members_self'),
  ('role_super_admin', 'perm_circulation_manage'),
  ('role_super_admin', 'perm_loans_view_own'),
  ('role_super_admin', 'perm_fines_manage'),
  ('role_super_admin', 'perm_accounts_view'),
  ('role_super_admin', 'perm_accounts_manage'),
  ('role_super_admin', 'perm_reports_view'),
  ('role_super_admin', 'perm_competitions_manage'),
  ('role_super_admin', 'perm_competitions_register'),
  ('role_super_admin', 'perm_settings_manage'),
  ('role_super_admin', 'perm_feature_flags_manage'),
  ('role_super_admin', 'perm_users_manage'),
  ('role_super_admin', 'perm_roles_manage'),
  ('role_super_admin', 'perm_audit_view'),
  ('role_super_admin', 'perm_prints_manage'),
  ('role_super_admin', 'perm_exports_manage');

INSERT OR IGNORE INTO feature_flags (
  id, flag_key, name_bn, name_en, description_bn, description_en, audience_scope, enabled, visible_to_public
) VALUES
  ('flag_public_catalog', 'public_catalog_enabled', 'পাবলিক ক্যাটালগ', 'Public catalog', 'পাবলিক ক্যাটালগ সক্রিয় থাকলে সবাই বই খুঁজতে পারবে', 'Allows public visitors to search the catalog', 'public', 1, 1),
  ('flag_competitions', 'competitions_module_enabled', 'প্রতিযোগিতা মডিউল', 'Competitions module', 'প্রতিযোগিতা মডিউল চালু বা বন্ধ', 'Enable or disable the competitions module', 'public', 1, 1),
  ('flag_online_registration', 'online_registration_enabled', 'অনলাইন রেজিস্ট্রেশন', 'Online registration', 'অনলাইন নিবন্ধন ফর্ম চালু বা বন্ধ', 'Enable or disable online registration', 'public', 1, 1),
  ('flag_ai_intake', 'ai_intake_enabled', 'AI বুক ইনটেক', 'AI book intake', 'বইয়ের AI-assisted draft intake চালু বা বন্ধ', 'Enable or disable AI-assisted book intake', 'internal', 1, 0),
  ('flag_receipt_export', 'receipt_export_enabled', 'রসিদ এক্সপোর্ট', 'Receipt export', 'রসিদ/রিপোর্ট এক্সপোর্ট সুবিধা', 'Enable receipt and report exports', 'internal', 1, 0),
  ('flag_print_center', 'print_center_enabled', 'প্রিন্ট সেন্টার', 'Print center', 'বারকোড, QR, ID card এবং লেবেল প্রিন্ট', 'Enable print center features', 'internal', 1, 0);

INSERT OR IGNORE INTO payment_types (id, payment_type_code, name_bn, name_en, requires_reference, active) VALUES
  ('pay_cash', 'cash', 'নগদ', 'Cash', 0, 1),
  ('pay_bkash', 'bkash', 'বিকাশ', 'bKash', 1, 1),
  ('pay_nagad', 'nagad', 'নগদ মোবাইল', 'Nagad', 1, 1),
  ('pay_bank', 'bank_transfer', 'ব্যাংক ট্রান্সফার', 'Bank transfer', 1, 1),
  ('pay_card', 'card', 'কার্ড', 'Card', 1, 1);

INSERT OR IGNORE INTO accounts (id, account_code, account_name_bn, account_name_en, account_type, owner_type, owner_id, active) VALUES
  ('acct_cash', '1000-CASH', 'ক্যাশ ইন হ্যান্ড', 'Cash in hand', 'asset', NULL, NULL, 1),
  ('acct_wallet', '1010-WALLET', 'মোবাইল ওয়ালেট', 'Mobile wallet clearing', 'asset', NULL, NULL, 1),
  ('acct_bank', '1020-BANK', 'ব্যাংক ক্লিয়ারিং', 'Bank clearing', 'asset', NULL, NULL, 1),
  ('acct_receivable', '1200-RECEIVABLE', 'সদস্য পাওনা', 'Member receivable', 'receivable', NULL, NULL, 1),
  ('acct_membership_income', '4000-MEMBERSHIP', 'সদস্য ফি আয়', 'Membership income', 'income', NULL, NULL, 1),
  ('acct_fine_income', '4010-FINES', 'জরিমানা আয়', 'Fine income', 'income', NULL, NULL, 1),
  ('acct_donation_income', '4020-DONATION', 'দান আয়', 'Donation income', 'income', NULL, NULL, 1),
  ('acct_exam_income', '4030-EXAM', 'পরীক্ষা ফি আয়', 'Exam fee income', 'income', NULL, NULL, 1),
  ('acct_competition_income', '4040-COMPETITION', 'প্রতিযোগিতা ফি আয়', 'Competition fee income', 'income', NULL, NULL, 1),
  ('acct_rental_income', '4050-RENTAL', 'বই ভাড়া আয়', 'Book rental income', 'income', NULL, NULL, 1),
  ('acct_other_income', '4060-OTHER', 'অন্যান্য আয়', 'Other income', 'income', NULL, NULL, 1);

INSERT OR IGNORE INTO fee_types (
  id, fee_code, base_code, name_bn, name_en, description_bn, description_en,
  collection_mode, default_amount, allow_custom_amount, allow_multi_month,
  income_account_id, active, is_system, sort_order
) VALUES
  ('fee_monthly_subscription', 'monthly_subscription', 'monthly_subscription', 'মাসিক সাবস্ক্রিপশন', 'Monthly subscription', 'মাসভিত্তিক সদস্য চাঁদা ও সাবস্ক্রিপশন আদায়', 'Recurring monthly membership dues', 'monthly', 100, 1, 1, 'acct_membership_income', 1, 1, 10),
  ('fee_donation', 'donation', 'donation', 'দান', 'Donation', 'স্বেচ্ছা অনুদান', 'Voluntary donation', 'one_time', 0, 1, 0, 'acct_donation_income', 1, 1, 20),
  ('fee_fine', 'fine', 'fine', 'জরিমানা', 'Fine', 'জরিমানা আদায়', 'Fine collection', 'one_time', 0, 1, 0, 'acct_fine_income', 1, 1, 30),
  ('fee_exam', 'exam_fee', 'exam_fee', 'পরীক্ষা ফি', 'Exam fee', 'পরীক্ষা বা মূল্যায়ন সংক্রান্ত ফি', 'Exam or assessment fee', 'one_time', 0, 1, 0, 'acct_exam_income', 1, 1, 40),
  ('fee_competition', 'competition_fee', 'competition_fee', 'প্রতিযোগিতা ফি', 'Competition fee', 'প্রতিযোগিতা নিবন্ধন বা অংশগ্রহণ ফি', 'Competition registration fee', 'one_time', 0, 1, 0, 'acct_competition_income', 1, 1, 50),
  ('fee_book_rental', 'book_rental_fee', 'book_rental_fee', 'বই ভাড়া ফি', 'Book rental fee', 'স্বল্পমেয়াদি ভাড়া বা ব্যবহার ফি', 'Book rental fee', 'one_time', 0, 1, 0, 'acct_rental_income', 1, 1, 60),
  ('fee_other', 'other_fee', 'other_fee', 'অন্যান্য ফি', 'Other fee', 'অন্যান্য প্রশাসনিক বা সেবা ফি', 'Other administrative fee', 'one_time', 0, 1, 0, 'acct_other_income', 1, 1, 70);

INSERT OR IGNORE INTO languages (id, iso_code, name_bn, name_en, script_name, active) VALUES
  ('lang_bn', 'bn', 'বাংলা', 'Bangla', 'Bengali', 1),
  ('lang_en', 'en', 'ইংরেজি', 'English', 'Latin', 1),
  ('lang_ar', 'ar', 'আরবি', 'Arabic', 'Arabic', 1),
  ('lang_hi', 'hi', 'হিন্দি', 'Hindi', 'Devanagari', 1);

INSERT OR IGNORE INTO categories (id, parent_id, category_code, name_bn, name_en, description, sort_order, active) VALUES
  ('cat_lit', NULL, 'LIT', 'সাহিত্য', 'Literature', 'উপন্যাস, গল্প, কবিতা', 10, 1),
  ('cat_bangla_lit', 'cat_lit', 'LIT-BN', 'বাংলা সাহিত্য', 'Bangla literature', 'বাংলা ভাষার সাহিত্য', 11, 1),
  ('cat_children', NULL, 'CHILD', 'শিশু-কিশোর', 'Children and young readers', 'শিশু ও কিশোর উপযোগী বই', 20, 1),
  ('cat_history', NULL, 'HIST', 'ইতিহাস', 'History', 'বাংলাদেশ ও বিশ্ব ইতিহাস', 30, 1),
  ('cat_science', NULL, 'SCI', 'বিজ্ঞান', 'Science', 'বিজ্ঞান ও প্রযুক্তি', 40, 1),
  ('cat_religion', NULL, 'REL', 'ধর্ম', 'Religion', 'ধর্মীয় পাঠ্য', 50, 1),
  ('cat_reference', NULL, 'REF', 'রেফারেন্স', 'Reference', 'অভিধান, বিশ্বকোষ, তথ্যপঞ্জি', 60, 1),
  ('cat_ict', NULL, 'ICT', 'তথ্যপ্রযুক্তি', 'ICT', 'কম্পিউটার ও তথ্যপ্রযুক্তি', 70, 1);

INSERT OR IGNORE INTO publishers (id, publisher_code, name_bn, name_en, city, country, website_url, notes, active) VALUES
  ('pub_prothoma', 'PROTHOMA', 'প্রথমা প্রকাশন', 'Prothoma Prokashon', 'Dhaka', 'Bangladesh', 'https://www.prothoma.com', NULL, 1),
  ('pub_anannya', 'ANANNYA', 'অন্যন্যা', 'Anannya', 'Dhaka', 'Bangladesh', NULL, NULL, 1),
  ('pub_upl', 'UPL', 'ইউনিভার্সিটি প্রেস লিমিটেড', 'University Press Limited', 'Dhaka', 'Bangladesh', 'https://www.uplbooks.com', NULL, 1),
  ('pub_pathak', 'PATHAK', 'পাঠক সমাবেশ', 'Pathak Shamabesh', 'Dhaka', 'Bangladesh', NULL, NULL, 1),
  ('pub_penguin', 'PENGUIN', 'পেঙ্গুইন', 'Penguin Books', 'London', 'United Kingdom', 'https://www.penguin.co.uk', NULL, 1);

INSERT OR IGNORE INTO print_templates (
  id, template_key, template_type, name_bn, name_en, page_size, config_json, is_default, active
) VALUES
  (
    'print_copy_label',
    'copy-label-a4',
    'copy_label',
    'কপি লেবেল A4',
    'Copy label A4',
    'A4',
    '{"columns":3,"rows":8,"showBarcode":true,"showQr":true}',
    1,
    1
  ),
  (
    'print_member_card',
    'member-card-id',
    'member_card',
    'সদস্য আইডি কার্ড',
    'Member ID card',
    'CR80',
    '{"showQr":true,"showPhoto":true}',
    1,
    1
  ),
  (
    'print_receipt',
    'receipt-thermal',
    'receipt',
    'থার্মাল রসিদ',
    'Thermal receipt',
    '80mm',
    '{"showLogo":true,"showPaymentBreakdown":true}',
    1,
    1
  );
