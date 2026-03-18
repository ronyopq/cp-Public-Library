import type { AuditLogRecord, DashboardWidgetConfigItem } from './domain'

export type AnalyticsPreset = 'month' | 'year' | 'custom'
export type AnalyticsExportFormat = 'csv' | 'html'

export interface AnalyticsFilters {
  preset: AnalyticsPreset
  month: number | null
  year: number
  startDate: string
  endDate: string
  rangeLabelBn: string
  rangeLabelEn: string
}

export interface AnalyticsChartPoint {
  key: string
  labelBn: string
  labelEn?: string | null
  value: number
}

export interface DashboardStats {
  totalTitles: number
  totalCopies: number
  totalCategories: number
  totalAuthors: number
  totalPublishers: number
  totalLanguages: number
  issuedBooks: number
  overdueBooks: number
  activeMembers: number
  acquisitionsInRange: number
  collectionsInRange: number
}

export interface DashboardRecentAddition {
  id: string
  title: string
  authors: string[]
  publisherName?: string | null
  copyCount: number
  availableCopies: number
  publicationYear?: number | null
  createdAt: string
  publicDetailPath?: string | null
}

export interface AnalyticsExportHook {
  format: AnalyticsExportFormat
  labelBn: string
  allowed: boolean
}

export interface StaffDashboardPayload {
  filters: AnalyticsFilters
  stats: DashboardStats
  charts: {
    acquisitionsByMonth: AnalyticsChartPoint[]
    loanVolumeByMonth: AnalyticsChartPoint[]
    circulationStatus: AnalyticsChartPoint[]
  }
  recentAdditions: DashboardRecentAddition[]
  recentActivities: AuditLogRecord[]
  dashboardWidgets: DashboardWidgetConfigItem[]
  exportHooks: AnalyticsExportHook[]
  generatedAt: string
}

export interface PublicAnalyticsReaderRow {
  rank: number
  labelBn: string
  totalLoans: number
}

export interface PublicAnalyticsBookRow {
  recordId: string
  title: string
  authors: string[]
  totalLoans: number
  detailPath: string
}

export interface PublicAnalyticsBreakdownRow {
  key: string
  labelBn: string
  labelEn?: string | null
  totalLoans: number
}

export interface PublicAnalyticsPayload {
  filters: AnalyticsFilters
  summary: {
    totalPublicTitles: number
    totalPublicCopies: number
    totalLoans: number
    distinctReaders: number
  }
  topReaders: PublicAnalyticsReaderRow[]
  mostReadBooks: PublicAnalyticsBookRow[]
  popularAuthors: PublicAnalyticsBreakdownRow[]
  popularCategories: PublicAnalyticsBreakdownRow[]
  popularPublishers: PublicAnalyticsBreakdownRow[]
  charts: {
    loansByMonth: AnalyticsChartPoint[]
    categoryShare: AnalyticsChartPoint[]
  }
  generatedAt: string
}

export interface AnalyticsExportResult {
  exportId: string
  fileName: string
  outputKey: string
  outputUrl: string
  format: AnalyticsExportFormat
}
