import type { FeeTypeDefinition } from './accounting'
import type { AuditLogRecord, PaginatedResult } from './domain'

export type ImportMode = 'create_only' | 'upsert'
export type ImportKind = 'members' | 'catalog'

export interface AuditLogFilters {
  page: number
  pageSize: number
  search: string
  actionKey?: string
  entityType?: string
  actorRoleKey?: string
  startDate?: string
  endDate?: string
}

export interface AuditLogListPayload extends PaginatedResult<AuditLogRecord> {
  filters: AuditLogFilters
}

export interface ArchivedMemberRecord {
  id: string
  memberCode: string
  fullNameBn: string
  phone: string
  memberStatus: string
  deletedAt: string
}

export interface ArchivedMembersPayload extends PaginatedResult<ArchivedMemberRecord> {
  search: string
}

export interface ArchivedFeeTypesPayload {
  items: FeeTypeDefinition[]
}

export interface ExportSummaryRecord {
  id: string
  exportType: string
  exportFormat: string
  status: string
  fileName?: string | null
  outputKey?: string | null
  outputUrl?: string | null
  note?: string | null
  requestedByNameBn?: string | null
  createdAt: string
  completedAt?: string | null
}

export interface ExportSummaryPayload {
  items: ExportSummaryRecord[]
}

export interface ImportErrorRecord {
  row: number
  message: string
}

export interface ImportSummaryPayload {
  kind: ImportKind
  mode: ImportMode
  totalRows: number
  created: number
  updated: number
  skipped: number
  errors: ImportErrorRecord[]
}

export interface BackupRequestPayload {
  tables: string[]
  note?: string
}
