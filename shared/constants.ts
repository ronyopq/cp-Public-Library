export const APP_TIMEZONE = 'Asia/Dhaka'

export const APP_ROLES = [
  'super_admin',
  'admin',
  'manager',
  'officer',
  'librarian',
  'member',
  'public',
] as const

export const COPY_CONDITIONS = [
  'new',
  'good',
  'worn',
  'damaged',
  'lost',
  'withdrawn',
  'repair',
] as const

export const ACQUISITION_TYPES = [
  'purchase',
  'gift',
  'donation',
  'replacement',
  'other',
] as const

export const MEMBER_STATUSES = ['active', 'inactive', 'suspended', 'expired'] as const

export const BOOK_RECORD_STATUSES = ['draft', 'review', 'active', 'archived'] as const

export const COPY_AVAILABILITY = [
  'available',
  'on_loan',
  'reserved',
  'repair',
  'lost',
  'withdrawn',
] as const

export const LOAN_STATUSES = [
  'issued',
  'returned',
  'overdue',
  'lost',
  'closed',
] as const

export const LOAN_RESOLUTION_CODES = [
  'returned',
  'damaged',
  'lost',
  'withdrawn',
  'repair',
] as const

export const RESERVATION_STATUSES = [
  'active',
  'ready',
  'fulfilled',
  'cancelled',
  'expired',
] as const

export const REMINDER_CHANNELS = ['whatsapp', 'sms', 'email'] as const

export const REMINDER_DELIVERY_STATUSES = [
  'queued',
  'sent',
  'failed',
  'retried',
  'cancelled',
] as const

export const COMPETITION_STATUSES = [
  'draft',
  'open',
  'closed',
  'published',
] as const

export const FEE_TYPE_CODES = [
  'membership',
  'late_fine',
  'replacement',
  'printing',
  'competition',
  'other',
] as const

export const FEATURE_FLAG_KEYS = [
  'public_catalog_enabled',
  'competitions_module_enabled',
  'online_registration_enabled',
  'ai_intake_enabled',
  'receipt_export_enabled',
  'print_center_enabled',
] as const

export const PERMISSION_KEYS = [
  'catalog.view_public',
  'catalog.view_internal',
  'catalog.manage_metadata',
  'copies.manage',
  'members.manage',
  'members.self_service',
  'circulation.manage',
  'loans.view_own',
  'fines.manage',
  'accounts.view',
  'accounts.manage',
  'reports.view',
  'competitions.manage',
  'competitions.register',
  'settings.manage',
  'feature_flags.manage',
  'users.manage',
  'roles.manage',
  'audit.view',
  'prints.manage',
  'exports.manage',
] as const

export const APP_NAV_ITEMS = [
  { key: 'dashboard', href: '/app', labelBn: 'ড্যাশবোর্ড', labelEn: 'Dashboard' },
  { key: 'books', href: '/app/books', labelBn: 'বই', labelEn: 'Books' },
  { key: 'members', href: '/app/members', labelBn: 'সদস্য', labelEn: 'Members' },
  { key: 'circulation', href: '/app/circulation', labelBn: 'ইস্যু ও রিটার্ন', labelEn: 'Circulation' },
  { key: 'accounts', href: '/app/accounts', labelBn: 'হিসাব', labelEn: 'Accounts' },
  { key: 'competitions', href: '/app/competitions', labelBn: 'প্রতিযোগিতা', labelEn: 'Competitions' },
  { key: 'printing', href: '/app/printing', labelBn: 'প্রিন্ট', labelEn: 'Printing' },
  { key: 'users', href: '/app/users', labelBn: 'ইউজার', labelEn: 'Users' },
  { key: 'settings', href: '/app/settings', labelBn: 'সেটিংস', labelEn: 'Settings' },
  { key: 'audit', href: '/app/audit', labelBn: 'অডিট লগ', labelEn: 'Audit Logs' },
  { key: 'account', href: '/app/account', labelBn: 'আমার একাউন্ট', labelEn: 'My Account' },
] as const

export const MENU_KEYS = [
  'dashboard',
  'books',
  'members',
  'circulation',
  'accounts',
  'competitions',
  'printing',
  'users',
  'settings',
  'audit',
  'account',
] as const

export const DASHBOARD_WIDGET_KEYS = [
  'titles',
  'copies',
  'members',
  'issued',
  'overdue',
  'collections',
  'featureFlags',
  'auditFeed',
] as const

export const ROLE_RANK: Record<(typeof APP_ROLES)[number], number> = {
  super_admin: 100,
  admin: 90,
  manager: 80,
  officer: 70,
  librarian: 60,
  member: 20,
  public: 10,
}

export const BANGLADESH_DIVISIONS = [
  'Dhaka',
  'Chattogram',
  'Rajshahi',
  'Khulna',
  'Barishal',
  'Sylhet',
  'Rangpur',
  'Mymensingh',
] as const
