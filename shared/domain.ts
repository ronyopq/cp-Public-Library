import type {
  ACQUISITION_TYPES,
  APP_ROLES,
  BOOK_RECORD_STATUSES,
  COMPETITION_STATUSES,
  COPY_AVAILABILITY,
  COPY_CONDITIONS,
  DASHBOARD_WIDGET_KEYS,
  FEATURE_FLAG_KEYS,
  FEE_TYPE_CODES,
  LOAN_STATUSES,
  MENU_KEYS,
  MEMBER_STATUSES,
  PERMISSION_KEYS,
} from './constants'

export type AppRole = (typeof APP_ROLES)[number]
export type CopyCondition = (typeof COPY_CONDITIONS)[number]
export type AcquisitionType = (typeof ACQUISITION_TYPES)[number]
export type MemberStatus = (typeof MEMBER_STATUSES)[number]
export type LoanStatus = (typeof LOAN_STATUSES)[number]
export type CompetitionStatus = (typeof COMPETITION_STATUSES)[number]
export type CopyAvailability = (typeof COPY_AVAILABILITY)[number]
export type BookRecordStatus = (typeof BOOK_RECORD_STATUSES)[number]
export type FeeTypeCode = (typeof FEE_TYPE_CODES)[number]
export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number]
export type MenuKey = (typeof MENU_KEYS)[number]
export type DashboardWidgetKey = (typeof DASHBOARD_WIDGET_KEYS)[number]
export type PermissionKey = (typeof PERMISSION_KEYS)[number]

export interface ApiErrorShape {
  code: string
  message: string
  details?: unknown
}

export interface ApiResult<T> {
  ok: boolean
  data?: T
  error?: ApiErrorShape
}

export interface PaginationQuery {
  page: number
  pageSize: number
  search?: string
  status?: string
}

export interface PaginatedResult<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}

export interface SessionUser {
  id: string
  email: string
  nameBn: string
  nameEn?: string | null
  phone?: string | null
  status?: string
  role: AppRole
  roles: AppRole[]
  permissions: PermissionKey[]
  mustChangePassword: boolean
}

export interface FeatureFlags {
  public_catalog_enabled: boolean
  competitions_module_enabled: boolean
  online_registration_enabled: boolean
  ai_intake_enabled: boolean
  receipt_export_enabled: boolean
  print_center_enabled: boolean
}

export interface SocialLink {
  id: string
  label: string
  url: string
}

export interface MenuConfigItem {
  key: MenuKey
  enabled: boolean
  order: number
}

export interface DashboardWidgetConfigItem {
  key: DashboardWidgetKey
  enabled: boolean
  order: number
  minRole: AppRole
}

export interface SiteProfileSettings {
  siteNameBn: string
  siteNameEn: string
  taglineBn: string
  taglineEn: string
  logoKey?: string | null
  faviconKey?: string | null
}

export interface SiteMetadataSettings {
  metaTitleBn: string
  metaTitleEn: string
  metaDescriptionBn: string
  metaDescriptionEn: string
  canonicalUrl?: string | null
}

export interface ShellSettings {
  profile: SiteProfileSettings
  metadata: SiteMetadataSettings
  socialLinks: SocialLink[]
  menuConfig: MenuConfigItem[]
  dashboardWidgets: DashboardWidgetConfigItem[]
}

export interface RoleRecord {
  id: string
  roleKey: AppRole
  nameBn: string
  nameEn: string
  rankOrder: number
}

export interface PermissionOverrideRecord {
  permissionKey: PermissionKey
  effect: 'allow' | 'deny'
}

export interface ManagedUser {
  id: string
  email: string
  fullNameBn: string
  fullNameEn?: string | null
  phone?: string | null
  status: 'active' | 'inactive' | 'suspended'
  primaryRole: AppRole
  roles: AppRole[]
  mustChangePassword: boolean
  lastLoginAt?: string | null
  createdAt: string
  permissionOverrides: PermissionOverrideRecord[]
}

export interface AuditLogRecord {
  id: string
  actorDisplayName: string
  actorRoleKey?: string | null
  actionKey: string
  entityType: string
  entityId: string
  note?: string | null
  createdAt: string
}

export interface DashboardSummary {
  stats: {
    totalTitles: number
    totalCopies: number
    activeMembers: number
    issuedCopies: number
    overdueCopies: number
    todayCollections: number
  }
  overdueByBucket: Array<{ label: string; count: number }>
  topCategories: Array<{ name: string; totalTitles: number }>
  recentActivities: AuditEntry[]
  featureFlags: FeatureFlags
}

export type CatalogLookupSourceType =
  | 'isbn'
  | 'url'
  | 'ocr'
  | 'manual'
  | 'cover'

export type CatalogLookupEngine =
  | 'open_library'
  | 'google_books'
  | 'open_library_url'
  | 'google_books_url'
  | 'rokomari'
  | 'schema_org'
  | 'generic_html'
  | 'workers_ai'
  | 'manual'

export type DuplicateResolutionStrategy =
  | 'create_new_record'
  | 'use_existing_record'
  | 'add_copy_to_existing_record'

export interface CatalogLookupLog {
  source: CatalogLookupEngine
  status: 'success' | 'warning' | 'failed' | 'skipped'
  message: string
}

export interface IntakeSourceRecord {
  type: CatalogLookupSourceType
  value: string
}

export interface IntakeCompleteness {
  title: boolean
  authors: boolean
  publisher: boolean
  publicationYear: boolean
  isbn: boolean
  language: boolean
  cover: boolean
}

export interface CatalogOption {
  id: string
  labelBn: string
  labelEn: string
  code?: string | null
}

export interface BibliographicRecord {
  id: string
  recordCode?: string | null
  isbn10?: string | null
  isbn13?: string | null
  titleBn?: string | null
  titleEn: string
  subtitleBn?: string | null
  subtitleEn?: string | null
  authors: string[]
  coAuthors: string[]
  editors: string[]
  translators: string[]
  publisherId?: string | null
  publisherName?: string | null
  edition?: string | null
  publicationYear?: number | null
  pageCount?: number | null
  languageCode: string
  categoryId?: string | null
  categoryName?: string | null
  subcategoryId?: string | null
  subcategoryName?: string | null
  tags: string[]
  summary?: string | null
  notes?: string | null
  publicVisibility: boolean
  coverImageKey?: string | null
  coverThumbnailKey?: string | null
  metadataPageKey?: string | null
  sourceUrl?: string | null
  sourceNote?: string | null
  recordStatus: BookRecordStatus
  duplicateScore?: number | null
  duplicateHints?: string[]
  createdAt: string
  updatedAt: string
}

export interface CopyItem {
  id: string
  bibliographicRecordId: string
  accessionCode: string
  barcodeValue: string
  qrValue: string
  copyNumber: number
  condition: CopyCondition
  availability: CopyAvailability
  locationRoom?: string | null
  locationRack?: string | null
  locationShelf?: string | null
  quantity?: number
  acquisitionType: AcquisitionType
  acquisitionDate?: string | null
  acquisitionPrice?: number | null
  acquisitionSource?: string | null
  invoiceReference?: string | null
  vendorName?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface BookIntakeDraft {
  seed: {
    isbn?: string
    sourceUrl?: string
    manualTitle?: string
    manualAuthor?: string
    manualPublisher?: string
  }
  metadata: Partial<BibliographicRecord>
  copyDefaults?: Partial<CopyItem>
  sources: IntakeSourceRecord[]
  lookupLog: CatalogLookupLog[]
  completeness: IntakeCompleteness
  requiresMetadataPage: boolean
  warnings: string[]
  duplicates: DuplicateCandidate[]
}

export interface DuplicateCandidate {
  record: BibliographicRecord
  reason: string
  resolutionHint: DuplicateResolutionStrategy
  exactIsbnMatch: boolean
  similarityScore: number
}

export interface IntakeAsset {
  key: string
  url: string
  kind: 'cover' | 'cover_thumbnail' | 'metadata_page'
  fileName: string
  contentType: string
}

export interface CatalogOptionsPayload {
  publishers: CatalogOption[]
  languages: CatalogOption[]
  categories: Array<
    CatalogOption & {
      parentId?: string | null
    }
  >
}

export interface CatalogSaveResult {
  bibliographicRecord: BibliographicRecord
  duplicateStrategy: DuplicateResolutionStrategy
  createdCopyIds: string[]
  createdBarcodeValues: string[]
  createdQrCodes: string[]
}

export interface Member {
  id: string
  memberCode: string
  fullNameBn: string
  fullNameEn?: string | null
  guardianName?: string | null
  email?: string | null
  phone: string
  nationalId?: string | null
  addressLine: string
  area?: string | null
  district?: string | null
  dateOfBirth?: string | null
  joinedAt: string
  membershipExpiresAt?: string | null
  memberStatus: MemberStatus
  photoKey?: string | null
  notes?: string | null
}

export interface LoanTransaction {
  id: string
  memberId: string
  copyItemId: string
  issuedAt: string
  dueAt: string
  returnedAt?: string | null
  renewedCount: number
  fineAccrued: number
  finePaid: number
  status: LoanStatus
}

export interface FinancialTransaction {
  id: string
  memberId?: string | null
  loanId?: string | null
  feeTypeCode: FeeTypeCode
  amount: number
  direction: 'debit' | 'credit'
  receiptNumber?: string | null
  notes?: string | null
  createdAt: string
}

export interface Receipt {
  id: string
  receiptNumber: string
  memberId?: string | null
  amount: number
  paymentMethod: string
  createdAt: string
  exportedFileKey?: string | null
}

export interface Competition {
  id: string
  slug: string
  titleBn: string
  titleEn?: string | null
  description?: string | null
  registrationOpensAt?: string | null
  registrationClosesAt?: string | null
  eventDate?: string | null
  resultPublishedAt?: string | null
  status: CompetitionStatus
}

export interface CompetitionRegistration {
  id: string
  competitionId: string
  participantName: string
  guardianName?: string | null
  phone: string
  email?: string | null
  category?: string | null
  submittedAt: string
}

export interface AuditEntry {
  id: string
  actorName: string
  actorRole: AppRole
  actionType: string
  entityType: string
  entityId: string
  summary: string
  createdAt: string
}
