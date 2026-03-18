import type { CompetitionStatus } from './domain'

export type PublicCatalogAvailabilityFilter = 'all' | 'available' | 'unavailable'
export type PublicCatalogSort = 'newest' | 'popular'

export interface PublicMenuVisibility {
  catalog: boolean
  competitions: boolean
  results: boolean
}

export interface PublicCatalogFieldVisibility {
  subtitle: boolean
  authors: boolean
  publisher: boolean
  language: boolean
  publicationYear: boolean
  edition: boolean
  pageCount: boolean
  category: boolean
  summary: boolean
  tags: boolean
  availability: boolean
  cover: boolean
}

export interface PublicCompetitionVisibility {
  resultsVisible: boolean
  printableAcknowledgement: boolean
  showFeeNotice: boolean
}

export interface PublicSiteSettings {
  menu: PublicMenuVisibility
  catalogFields: PublicCatalogFieldVisibility
  competition: PublicCompetitionVisibility
}

export interface PublicCatalogQuery {
  search: string
  categoryId?: string
  author?: string
  publisherId?: string
  languageCode?: string
  availability: PublicCatalogAvailabilityFilter
  sort: PublicCatalogSort
  page: number
  pageSize: number
}

export interface PublicCatalogFilterOption {
  value: string
  labelBn: string
  labelEn?: string | null
  total: number
}

export interface PublicCatalogFilters {
  categories: PublicCatalogFilterOption[]
  authors: PublicCatalogFilterOption[]
  publishers: PublicCatalogFilterOption[]
  languages: PublicCatalogFilterOption[]
}

export interface PublicCatalogListItem {
  id: string
  title: string
  subtitle?: string | null
  authors: string[]
  publisherId?: string | null
  publisherName?: string | null
  languageCode?: string | null
  languageName?: string | null
  categoryId?: string | null
  categoryName?: string | null
  publicationYear?: number | null
  edition?: string | null
  pageCount?: number | null
  summary?: string | null
  tags: string[]
  coverImageUrl?: string | null
  coverThumbnailUrl?: string | null
  totalCopies?: number
  availableCopies?: number
  popularityScore: number
  createdAt: string
  detailPath: string
}

export interface PublicCatalogPayload {
  items: PublicCatalogListItem[]
  filters: PublicCatalogFilters
  query: PublicCatalogQuery
  page: number
  pageSize: number
  total: number
}

export interface PublicBookDetail {
  book: PublicCatalogListItem & {
    subcategoryName?: string | null
    availabilityLabelBn: string
    qrPath?: string | null
  }
  relatedBooks: PublicCatalogListItem[]
}

export interface PublicQrResolution {
  shortCode: string
  entityType: string
  entityId: string
  destinationPath: string
  destinationLabelBn: string
}

export interface CompetitionAdminRecord {
  id: string
  slug: string
  titleBn: string
  titleEn?: string | null
  description?: string | null
  registrationFeeAmount: number
  registrationOpensAt?: string | null
  registrationClosesAt?: string | null
  eventDate?: string | null
  resultPublishedAt?: string | null
  status: CompetitionStatus
  visibleToPublic: boolean
  registrationCount: number
  confirmedRegistrationCount: number
  resultCount: number
  createdAt: string
  updatedAt: string
}

export interface CompetitionAdminRegistration {
  id: string
  competitionId: string
  memberId?: string | null
  paymentId?: string | null
  participantName: string
  guardianName?: string | null
  phone: string
  email?: string | null
  categoryLabel?: string | null
  status: 'pending' | 'confirmed' | 'cancelled' | 'rejected'
  note?: string | null
  submittedAt: string
}

export interface CompetitionAdminResult {
  id?: string
  registrationId?: string | null
  participantName?: string | null
  phone?: string | null
  categoryLabel?: string | null
  positionRank?: number | null
  positionLabel: string
  score?: number | null
  publishedNote?: string | null
  publishedAt?: string | null
}

export interface CompetitionAdminDetail {
  competition: CompetitionAdminRecord
  registrations: CompetitionAdminRegistration[]
  results: CompetitionAdminResult[]
}

export interface CompetitionAdminDashboardPayload {
  competitions: CompetitionAdminRecord[]
  publicSettings: PublicSiteSettings
}

export interface PublicCompetitionListItem {
  id: string
  slug: string
  titleBn: string
  titleEn?: string | null
  description?: string | null
  registrationFeeAmount: number
  registrationOpensAt?: string | null
  registrationClosesAt?: string | null
  eventDate?: string | null
  resultPublishedAt?: string | null
  status: CompetitionStatus
  registrationOpen: boolean
  resultsPublished: boolean
  detailPath: string
  resultsPath: string
}

export interface PublicCompetitionDetail {
  competition: PublicCompetitionListItem
  results: CompetitionAdminResult[]
  registrationEnabled: boolean
  resultVisibilityEnabled: boolean
}

export interface CompetitionRegistrationAcknowledgement {
  registrationId: string
  competitionId: string
  competitionSlug: string
  competitionTitleBn: string
  participantName: string
  guardianName?: string | null
  phone: string
  email?: string | null
  categoryLabel?: string | null
  submittedAt: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'rejected'
  feeAmount: number
  paymentRequired: boolean
  paymentIntegration: {
    enabled: boolean
    status: 'manual_pending' | 'not_required'
    feeTypeCode: 'competition_fee'
    amount: number
  }
  acknowledgementPath: string
  printable: boolean
}
