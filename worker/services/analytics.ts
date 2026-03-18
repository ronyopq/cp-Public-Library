import type {
  AnalyticsExportFormat,
  AnalyticsExportResult,
  AnalyticsFilters,
  DashboardRecentAddition,
  DashboardStats,
  PublicAnalyticsBookRow,
  PublicAnalyticsBreakdownRow,
  PublicAnalyticsPayload,
  PublicAnalyticsReaderRow,
  SessionUser,
  StaffDashboardPayload,
} from '@shared/index'
import { ROLE_RANK, buildPublicBookPath, dhakaNow, parseDhakaInputDate } from '@shared/index'
import type { AppBindings } from '../types'
import { writeAudit } from '../lib/audit'
import { dbAll, dbFirst, dbRun, dbValue, jsonArray } from '../lib/db'
import { getPublicSiteSettings, getShellSettings } from '../lib/settings'
import { buildR2Key, putFile } from '../lib/storage'

interface AnalyticsFilterInput {
  preset?: 'month' | 'year' | 'custom'
  month?: number
  year?: number
  startDate?: string
  endDate?: string
}

interface ResolvedAnalyticsFilters extends AnalyticsFilters {
  startIso: string
  endIso: string
}

interface CountRow {
  total: number | null
}

interface GroupedRow {
  key: string
  total: number | null
}

interface RecentAdditionRow {
  id: string
  title: string
  authorsJson: string | null
  publisherName: string | null
  copyCount: number | null
  availableCopies: number | null
  publicationYear: number | null
  createdAt: string
  publicVisibility: number
  metadataStatus: string
}

interface ActivityRow {
  id: string
  actorDisplayName: string
  actorRoleKey: string | null
  actionKey: string
  entityType: string
  entityId: string
  note: string | null
  createdAt: string
}

interface PublicBookRow {
  recordId: string
  title: string
  authorsJson: string | null
  totalLoans: number | null
}

interface PublicBreakdownRow {
  key: string
  labelBn: string
  labelEn: string | null
  totalLoans: number | null
}

function sanitizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function padMonth(value: number) {
  return String(value).padStart(2, '0')
}

function dhakaYearMonth(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  const year = Number(parts.find((part) => part.type === 'year')?.value ?? '1970')
  const month = Number(parts.find((part) => part.type === 'month')?.value ?? '01')
  return { year, month }
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function monthToken(year: number, month: number) {
  return `${year}-${padMonth(month)}`
}

function monthLabelBn(monthValue: string) {
  return new Intl.DateTimeFormat('bn-BD', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: 'long',
  }).format(new Date(`${monthValue}-01T00:00:00+06:00`))
}

function monthLabelEn(monthValue: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: 'short',
  }).format(new Date(`${monthValue}-01T00:00:00+06:00`))
}

function dateLabelBn(dateValue: string) {
  return new Intl.DateTimeFormat('bn-BD', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(`${dateValue}T00:00:00+06:00`))
}

function dateLabelEn(dateValue: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(`${dateValue}T00:00:00+06:00`))
}

function compareMonthToken(left: string, right: string) {
  return left.localeCompare(right)
}

function addMonthToken(monthValue: string, offset: number) {
  const [yearText, monthText] = monthValue.split('-')
  const baseYear = Number(yearText)
  const baseMonth = Number(monthText) - 1
  const serial = baseYear * 12 + baseMonth + offset
  const nextYear = Math.floor(serial / 12)
  const nextMonth = (serial % 12) + 1
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`
}

function buildMonthRange(startDate: string, endDate: string) {
  const startMonth = startDate.slice(0, 7)
  const endMonth = endDate.slice(0, 7)
  const months: string[] = []
  let cursor = startMonth

  while (compareMonthToken(cursor, endMonth) <= 0) {
    months.push(cursor)
    cursor = addMonthToken(cursor, 1)
  }

  return months
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function csvCell(value: string | number) {
  const text = String(value)
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

function mapRecentAddition(row: RecentAdditionRow): DashboardRecentAddition {
  return {
    id: row.id,
    title: row.title,
    authors: jsonArray(row.authorsJson),
    publisherName: row.publisherName,
    copyCount: Number(row.copyCount ?? 0),
    availableCopies: Number(row.availableCopies ?? 0),
    publicationYear: row.publicationYear,
    createdAt: row.createdAt,
    publicDetailPath:
      Number(row.publicVisibility ?? 0) === 1 && row.metadataStatus === 'active'
        ? buildPublicBookPath(row.id, row.title)
        : null,
  }
}

function publicCatalogWhereClause() {
  return `
    bibliographic_records.deleted_at IS NULL
    AND bibliographic_records.public_visibility = 1
    AND bibliographic_records.metadata_status = 'active'
  `
}

export function resolveAnalyticsFilters(input: AnalyticsFilterInput): ResolvedAnalyticsFilters {
  const current = dhakaYearMonth()
  const preset = input.preset ?? 'month'
  const year = input.year ?? current.year
  let month: number | null = input.month ?? current.month
  let startDate = sanitizeText(input.startDate)
  let endDate = sanitizeText(input.endDate)

  if (preset === 'custom') {
    month = null
  } else if (preset === 'year') {
    month = null
    startDate = `${year}-01-01`
    endDate = `${year}-12-31`
  } else {
    const resolvedMonth = month ?? current.month
    month = resolvedMonth
    startDate = `${year}-${padMonth(resolvedMonth)}-01`
    endDate = `${year}-${padMonth(resolvedMonth)}-${String(lastDayOfMonth(year, resolvedMonth)).padStart(2, '0')}`
  }

  const startIso = parseDhakaInputDate(startDate)
  const endIso = parseDhakaInputDate(endDate, { endOfDay: true })

  if (!startIso || !endIso) {
    throw new Error('অ্যানালিটিক্স সময়সীমা বৈধ নয়।')
  }

  const rangeLabelBn =
    preset === 'month' && month
      ? monthLabelBn(monthToken(year, month))
      : preset === 'year'
        ? new Intl.NumberFormat('bn-BD').format(year)
        : `${dateLabelBn(startDate)} - ${dateLabelBn(endDate)}`

  const rangeLabelEn =
    preset === 'month' && month
      ? monthLabelEn(monthToken(year, month))
      : preset === 'year'
        ? String(year)
        : `${dateLabelEn(startDate)} - ${dateLabelEn(endDate)}`

  return {
    preset,
    month,
    year,
    startDate,
    endDate,
    startIso,
    endIso,
    rangeLabelBn,
    rangeLabelEn,
  }
}

async function loadDashboardStats(db: D1Database, filters: ResolvedAnalyticsFilters): Promise<DashboardStats> {
  const [
    totalTitles,
    totalCopies,
    totalCategories,
    totalAuthors,
    totalPublishers,
    totalLanguages,
    issuedBooks,
    overdueBooks,
    activeMembers,
    acquisitionsInRange,
    collectionsInRange,
  ] = await Promise.all([
    dbValue<number>(db, `SELECT COUNT(*) AS total FROM bibliographic_records WHERE deleted_at IS NULL`),
    dbValue<number>(db, `SELECT COUNT(*) AS total FROM book_copies WHERE deleted_at IS NULL`),
    dbValue<number>(db, `SELECT COUNT(*) AS total FROM categories WHERE deleted_at IS NULL AND active = 1`),
    dbValue<number>(
      db,
      `
        SELECT COUNT(DISTINCT lower(trim(book_contributors.contributor_name_en))) AS total
        FROM book_contributors
        INNER JOIN bibliographic_records
          ON bibliographic_records.id = book_contributors.bibliographic_record_id
        WHERE bibliographic_records.deleted_at IS NULL
          AND book_contributors.contributor_role = 'author'
      `,
    ),
    dbValue<number>(db, `SELECT COUNT(*) AS total FROM publishers WHERE deleted_at IS NULL AND active = 1`),
    dbValue<number>(db, `SELECT COUNT(*) AS total FROM languages WHERE active = 1`),
    dbValue<number>(db, `SELECT COUNT(*) AS total FROM loans WHERE status IN ('issued', 'overdue')`),
    dbValue<number>(db, `SELECT COUNT(*) AS total FROM loans WHERE status = 'overdue'`),
    dbValue<number>(db, `SELECT COUNT(*) AS total FROM members WHERE deleted_at IS NULL AND status = 'active'`),
    dbValue<number>(
      db,
      `
        SELECT COUNT(book_copies.id) AS total
        FROM book_copies
        INNER JOIN acquisition_records
          ON acquisition_records.id = book_copies.acquisition_record_id
        WHERE book_copies.deleted_at IS NULL
          AND acquisition_records.acquired_on >= ?
          AND acquisition_records.acquired_on <= ?
      `,
      [filters.startDate, filters.endDate],
    ),
    dbValue<number>(
      db,
      `
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM payments
        WHERE deleted_at IS NULL
          AND voided_at IS NULL
          AND status = 'completed'
          AND paid_at >= ?
          AND paid_at <= ?
      `,
      [filters.startIso, filters.endIso],
    ),
  ])

  return {
    totalTitles: Number(totalTitles ?? 0),
    totalCopies: Number(totalCopies ?? 0),
    totalCategories: Number(totalCategories ?? 0),
    totalAuthors: Number(totalAuthors ?? 0),
    totalPublishers: Number(totalPublishers ?? 0),
    totalLanguages: Number(totalLanguages ?? 0),
    issuedBooks: Number(issuedBooks ?? 0),
    overdueBooks: Number(overdueBooks ?? 0),
    activeMembers: Number(activeMembers ?? 0),
    acquisitionsInRange: Number(acquisitionsInRange ?? 0),
    collectionsInRange: Number(collectionsInRange ?? 0),
  }
}

async function loadRecentAdditions(db: D1Database, filters: ResolvedAnalyticsFilters) {
  const rows = await dbAll<RecentAdditionRow>(
    db,
    `
      SELECT
        bibliographic_records.id AS id,
        COALESCE(bibliographic_records.title_bn, bibliographic_records.title_en) AS title,
        (
          SELECT COALESCE(json_group_array(item.contributor_name_en), '[]')
          FROM (
            SELECT contributor_name_en
            FROM book_contributors
            WHERE bibliographic_record_id = bibliographic_records.id
              AND contributor_role = 'author'
            ORDER BY sort_order ASC
            LIMIT 5
          ) AS item
        ) AS authorsJson,
        COALESCE(publishers.name_bn, publishers.name_en) AS publisherName,
        (
          SELECT COUNT(*)
          FROM book_copies
          WHERE book_copies.bibliographic_record_id = bibliographic_records.id
            AND book_copies.deleted_at IS NULL
        ) AS copyCount,
        (
          SELECT COUNT(*)
          FROM book_copies
          WHERE book_copies.bibliographic_record_id = bibliographic_records.id
            AND book_copies.deleted_at IS NULL
            AND book_copies.availability_status = 'available'
        ) AS availableCopies,
        bibliographic_records.publication_year AS publicationYear,
        bibliographic_records.created_at AS createdAt,
        bibliographic_records.public_visibility AS publicVisibility,
        bibliographic_records.metadata_status AS metadataStatus
      FROM bibliographic_records
      LEFT JOIN publishers ON publishers.id = bibliographic_records.publisher_id
      WHERE bibliographic_records.deleted_at IS NULL
        AND bibliographic_records.created_at >= ?
        AND bibliographic_records.created_at <= ?
      ORDER BY bibliographic_records.created_at DESC
      LIMIT 8
    `,
    [filters.startIso, filters.endIso],
  )

  return rows.map(mapRecentAddition)
}

async function loadRecentActivities(
  db: D1Database,
  filters: ResolvedAnalyticsFilters,
  actor: SessionUser,
) {
  if (ROLE_RANK[actor.role] < ROLE_RANK.manager) {
    return []
  }

  const rows = await dbAll<ActivityRow>(
    db,
    `
      SELECT
        id,
        actor_display_name AS actorDisplayName,
        actor_role_key AS actorRoleKey,
        action_key AS actionKey,
        entity_type AS entityType,
        entity_id AS entityId,
        note,
        created_at AS createdAt
      FROM audit_logs
      WHERE created_at >= ?
        AND created_at <= ?
      ORDER BY created_at DESC
      LIMIT 8
    `,
    [filters.startIso, filters.endIso],
  )

  return rows
}

async function loadMonthlySeries(
  db: D1Database,
  query: string,
  bindings: unknown[],
  filters: ResolvedAnalyticsFilters,
) {
  const rows = await dbAll<GroupedRow>(db, query, bindings)
  const totals = new Map(rows.map((row) => [row.key, Number(row.total ?? 0)]))
  return buildMonthRange(filters.startDate, filters.endDate).map((monthValue) => ({
    key: monthValue,
    labelBn: monthLabelBn(monthValue),
    labelEn: monthLabelEn(monthValue),
    value: totals.get(monthValue) ?? 0,
  }))
}

async function loadStaffCharts(db: D1Database, filters: ResolvedAnalyticsFilters) {
  const [acquisitionsByMonth, loanVolumeByMonth, circulationRows] = await Promise.all([
    loadMonthlySeries(
      db,
      `
        SELECT substr(acquisition_records.acquired_on, 1, 7) AS key, COUNT(book_copies.id) AS total
        FROM book_copies
        INNER JOIN acquisition_records
          ON acquisition_records.id = book_copies.acquisition_record_id
        WHERE book_copies.deleted_at IS NULL
          AND acquisition_records.acquired_on >= ?
          AND acquisition_records.acquired_on <= ?
        GROUP BY substr(acquisition_records.acquired_on, 1, 7)
        ORDER BY key ASC
      `,
      [filters.startDate, filters.endDate],
      filters,
    ),
    loadMonthlySeries(
      db,
      `
        SELECT substr(loans.issued_at, 1, 7) AS key, COUNT(loans.id) AS total
        FROM loans
        WHERE loans.issued_at >= ?
          AND loans.issued_at <= ?
        GROUP BY substr(loans.issued_at, 1, 7)
        ORDER BY key ASC
      `,
      [filters.startIso, filters.endIso],
      filters,
    ),
    dbAll<GroupedRow>(
      db,
      `
        SELECT status AS key, COUNT(*) AS total
        FROM loans
        GROUP BY status
        ORDER BY COUNT(*) DESC, status ASC
      `,
    ),
  ])

  const circulationLabels: Record<string, { bn: string; en: string }> = {
    issued: { bn: 'ইস্যুকৃত', en: 'Issued' },
    overdue: { bn: 'ওভারডিউ', en: 'Overdue' },
    returned: { bn: 'ফেরত', en: 'Returned' },
    lost: { bn: 'হারানো', en: 'Lost' },
    closed: { bn: 'বন্ধ', en: 'Closed' },
  }

  return {
    acquisitionsByMonth,
    loanVolumeByMonth,
    circulationStatus: circulationRows.map((row) => ({
      key: row.key,
      labelBn: circulationLabels[row.key]?.bn ?? row.key,
      labelEn: circulationLabels[row.key]?.en ?? row.key,
      value: Number(row.total ?? 0),
    })),
  }
}

export async function getStaffDashboard(
  env: AppBindings,
  actor: SessionUser,
  input: AnalyticsFilterInput,
): Promise<StaffDashboardPayload> {
  if (ROLE_RANK[actor.role] < ROLE_RANK.librarian) {
    throw new Error('এই ড্যাশবোর্ড কেবল স্টাফদের জন্য প্রযোজ্য।')
  }

  const filters = resolveAnalyticsFilters(input)
  const [stats, charts, recentAdditions, recentActivities, shellSettings] = await Promise.all([
    loadDashboardStats(env.DB, filters),
    loadStaffCharts(env.DB, filters),
    loadRecentAdditions(env.DB, filters),
    loadRecentActivities(env.DB, filters, actor),
    getShellSettings(env.DB, env),
  ])

  return {
    filters,
    stats,
    charts,
    recentAdditions,
    recentActivities,
    dashboardWidgets: shellSettings.dashboardWidgets,
    exportHooks: [
      {
        format: 'csv',
        labelBn: 'CSV এক্সপোর্ট',
        allowed: actor.permissions.includes('reports.view'),
      },
      {
        format: 'html',
        labelBn: 'প্রিন্ট/HTML রিপোর্ট',
        allowed: actor.permissions.includes('reports.view'),
      },
    ],
    generatedAt: dhakaNow(),
  }
}

async function loadPublicSummary(db: D1Database, filters: ResolvedAnalyticsFilters) {
  const [totalPublicTitles, totalPublicCopies, loanStats] = await Promise.all([
    dbValue<number>(
      db,
      `
        SELECT COUNT(*) AS total
        FROM bibliographic_records
        WHERE ${publicCatalogWhereClause()}
      `,
    ),
    dbValue<number>(
      db,
      `
        SELECT COUNT(book_copies.id) AS total
        FROM book_copies
        INNER JOIN bibliographic_records
          ON bibliographic_records.id = book_copies.bibliographic_record_id
        WHERE book_copies.deleted_at IS NULL
          AND ${publicCatalogWhereClause()}
      `,
    ),
    dbFirst<{ totalLoans: number | null; distinctReaders: number | null }>(
      db,
      `
        SELECT
          COUNT(loans.id) AS totalLoans,
          COUNT(DISTINCT loans.member_id) AS distinctReaders
        FROM loans
        INNER JOIN book_copies
          ON book_copies.id = loans.book_copy_id
        INNER JOIN bibliographic_records
          ON bibliographic_records.id = book_copies.bibliographic_record_id
        INNER JOIN members
          ON members.id = loans.member_id
        WHERE ${publicCatalogWhereClause()}
          AND members.deleted_at IS NULL
          AND loans.issued_at >= ?
          AND loans.issued_at <= ?
      `,
      [filters.startIso, filters.endIso],
    ),
  ])

  return {
    totalPublicTitles: Number(totalPublicTitles ?? 0),
    totalPublicCopies: Number(totalPublicCopies ?? 0),
    totalLoans: Number(loanStats?.totalLoans ?? 0),
    distinctReaders: Number(loanStats?.distinctReaders ?? 0),
  }
}

async function loadTopReaders(db: D1Database, filters: ResolvedAnalyticsFilters) {
  const distinctReaders = Number(
    (await dbValue<number>(
      db,
      `
        SELECT COUNT(DISTINCT loans.member_id) AS total
        FROM loans
        INNER JOIN book_copies
          ON book_copies.id = loans.book_copy_id
        INNER JOIN bibliographic_records
          ON bibliographic_records.id = book_copies.bibliographic_record_id
        INNER JOIN members
          ON members.id = loans.member_id
        WHERE ${publicCatalogWhereClause()}
          AND members.deleted_at IS NULL
          AND loans.issued_at >= ?
          AND loans.issued_at <= ?
      `,
      [filters.startIso, filters.endIso],
    )) ?? 0,
  )

  if (distinctReaders < 3) {
    return [] as PublicAnalyticsReaderRow[]
  }

  const rows = await dbAll<CountRow>(
    db,
    `
      SELECT COUNT(loans.id) AS total
      FROM loans
      INNER JOIN book_copies
        ON book_copies.id = loans.book_copy_id
      INNER JOIN bibliographic_records
        ON bibliographic_records.id = book_copies.bibliographic_record_id
      INNER JOIN members
        ON members.id = loans.member_id
      WHERE ${publicCatalogWhereClause()}
        AND members.deleted_at IS NULL
        AND loans.issued_at >= ?
        AND loans.issued_at <= ?
      GROUP BY loans.member_id
      ORDER BY COUNT(loans.id) DESC, loans.member_id ASC
      LIMIT 5
    `,
    [filters.startIso, filters.endIso],
  )

  return rows.map((row, index) => ({
    rank: index + 1,
    labelBn: `পাঠক #${index + 1}`,
    totalLoans: Number(row.total ?? 0),
  }))
}

async function loadMostReadBooks(db: D1Database, filters: ResolvedAnalyticsFilters) {
  const rows = await dbAll<PublicBookRow>(
    db,
    `
      SELECT
        bibliographic_records.id AS recordId,
        COALESCE(bibliographic_records.title_bn, bibliographic_records.title_en) AS title,
        (
          SELECT COALESCE(json_group_array(item.contributor_name_en), '[]')
          FROM (
            SELECT contributor_name_en
            FROM book_contributors
            WHERE bibliographic_record_id = bibliographic_records.id
              AND contributor_role = 'author'
            ORDER BY sort_order ASC
            LIMIT 5
          ) AS item
        ) AS authorsJson,
        COUNT(loans.id) AS totalLoans
      FROM loans
      INNER JOIN book_copies
        ON book_copies.id = loans.book_copy_id
      INNER JOIN bibliographic_records
        ON bibliographic_records.id = book_copies.bibliographic_record_id
      WHERE ${publicCatalogWhereClause()}
        AND loans.issued_at >= ?
        AND loans.issued_at <= ?
      GROUP BY bibliographic_records.id, title
      ORDER BY COUNT(loans.id) DESC, title ASC
      LIMIT 8
    `,
    [filters.startIso, filters.endIso],
  )

  return rows.map<PublicAnalyticsBookRow>((row) => ({
    recordId: row.recordId,
    title: row.title,
    authors: jsonArray(row.authorsJson),
    totalLoans: Number(row.totalLoans ?? 0),
    detailPath: buildPublicBookPath(row.recordId, row.title),
  }))
}

async function loadPublicBreakdown(
  db: D1Database,
  query: string,
  bindings: unknown[],
): Promise<PublicAnalyticsBreakdownRow[]> {
  const rows = await dbAll<PublicBreakdownRow>(db, query, bindings)
  return rows.map((row) => ({
    key: row.key,
    labelBn: row.labelBn,
    labelEn: row.labelEn,
    totalLoans: Number(row.totalLoans ?? 0),
  }))
}

async function loadPublicCharts(db: D1Database, filters: ResolvedAnalyticsFilters) {
  const [loansByMonth, categoryShare] = await Promise.all([
    loadMonthlySeries(
      db,
      `
        SELECT substr(loans.issued_at, 1, 7) AS key, COUNT(loans.id) AS total
        FROM loans
        INNER JOIN book_copies
          ON book_copies.id = loans.book_copy_id
        INNER JOIN bibliographic_records
          ON bibliographic_records.id = book_copies.bibliographic_record_id
        WHERE ${publicCatalogWhereClause()}
          AND loans.issued_at >= ?
          AND loans.issued_at <= ?
        GROUP BY substr(loans.issued_at, 1, 7)
        ORDER BY key ASC
      `,
      [filters.startIso, filters.endIso],
      filters,
    ),
    loadPublicBreakdown(
      db,
      `
        SELECT
          categories.id AS key,
          COALESCE(categories.name_bn, categories.name_en) AS labelBn,
          categories.name_en AS labelEn,
          COUNT(loans.id) AS totalLoans
        FROM loans
        INNER JOIN book_copies
          ON book_copies.id = loans.book_copy_id
        INNER JOIN bibliographic_records
          ON bibliographic_records.id = book_copies.bibliographic_record_id
        INNER JOIN categories
          ON categories.id = bibliographic_records.primary_category_id
        WHERE ${publicCatalogWhereClause()}
          AND loans.issued_at >= ?
          AND loans.issued_at <= ?
        GROUP BY categories.id, labelBn, categories.name_en
        ORDER BY COUNT(loans.id) DESC, labelBn ASC
        LIMIT 6
      `,
      [filters.startIso, filters.endIso],
    ),
  ])

  return {
    loansByMonth,
    categoryShare: categoryShare.map((row) => ({
      key: row.key,
      labelBn: row.labelBn,
      labelEn: row.labelEn,
      value: row.totalLoans,
    })),
  }
}

export async function getPublicAnalytics(
  env: AppBindings,
  input: AnalyticsFilterInput,
): Promise<PublicAnalyticsPayload> {
  const filters = resolveAnalyticsFilters(input)

  const [summary, topReaders, mostReadBooks, popularAuthors, popularCategories, popularPublishers, charts] =
    await Promise.all([
      loadPublicSummary(env.DB, filters),
      loadTopReaders(env.DB, filters),
      loadMostReadBooks(env.DB, filters),
      loadPublicBreakdown(
        env.DB,
        `
          SELECT
            lower(trim(book_contributors.contributor_name_en)) AS key,
            COALESCE(NULLIF(book_contributors.contributor_name_bn, ''), book_contributors.contributor_name_en) AS labelBn,
            book_contributors.contributor_name_en AS labelEn,
            COUNT(loans.id) AS totalLoans
          FROM loans
          INNER JOIN book_copies
            ON book_copies.id = loans.book_copy_id
          INNER JOIN bibliographic_records
            ON bibliographic_records.id = book_copies.bibliographic_record_id
          INNER JOIN book_contributors
            ON book_contributors.bibliographic_record_id = bibliographic_records.id
          WHERE ${publicCatalogWhereClause()}
            AND book_contributors.contributor_role = 'author'
            AND loans.issued_at >= ?
            AND loans.issued_at <= ?
          GROUP BY key, labelBn, labelEn
          ORDER BY COUNT(loans.id) DESC, labelBn ASC
          LIMIT 8
        `,
        [filters.startIso, filters.endIso],
      ),
      loadPublicBreakdown(
        env.DB,
        `
          SELECT
            categories.id AS key,
            COALESCE(categories.name_bn, categories.name_en) AS labelBn,
            categories.name_en AS labelEn,
            COUNT(loans.id) AS totalLoans
          FROM loans
          INNER JOIN book_copies
            ON book_copies.id = loans.book_copy_id
          INNER JOIN bibliographic_records
            ON bibliographic_records.id = book_copies.bibliographic_record_id
          INNER JOIN categories
            ON categories.id = bibliographic_records.primary_category_id
          WHERE ${publicCatalogWhereClause()}
            AND loans.issued_at >= ?
            AND loans.issued_at <= ?
          GROUP BY categories.id, labelBn, categories.name_en
          ORDER BY COUNT(loans.id) DESC, labelBn ASC
          LIMIT 8
        `,
        [filters.startIso, filters.endIso],
      ),
      loadPublicBreakdown(
        env.DB,
        `
          SELECT
            publishers.id AS key,
            COALESCE(publishers.name_bn, publishers.name_en) AS labelBn,
            publishers.name_en AS labelEn,
            COUNT(loans.id) AS totalLoans
          FROM loans
          INNER JOIN book_copies
            ON book_copies.id = loans.book_copy_id
          INNER JOIN bibliographic_records
            ON bibliographic_records.id = book_copies.bibliographic_record_id
          INNER JOIN publishers
            ON publishers.id = bibliographic_records.publisher_id
          WHERE ${publicCatalogWhereClause()}
            AND loans.issued_at >= ?
            AND loans.issued_at <= ?
          GROUP BY publishers.id, labelBn, publishers.name_en
          ORDER BY COUNT(loans.id) DESC, labelBn ASC
          LIMIT 8
        `,
        [filters.startIso, filters.endIso],
      ),
      loadPublicCharts(env.DB, filters),
    ])

  return {
    filters,
    summary,
    topReaders,
    mostReadBooks,
    popularAuthors,
    popularCategories,
    popularPublishers,
    charts,
    generatedAt: dhakaNow(),
  }
}

function buildDashboardCsv(payload: StaffDashboardPayload) {
  const lines: Array<Array<string | number>> = [
    ['Range', payload.filters.rangeLabelEn],
    ['Generated At', payload.generatedAt],
    [],
    ['Metric', 'Value'],
    ['Total titles', payload.stats.totalTitles],
    ['Total copies', payload.stats.totalCopies],
    ['Total categories', payload.stats.totalCategories],
    ['Total authors', payload.stats.totalAuthors],
    ['Total publishers', payload.stats.totalPublishers],
    ['Total languages', payload.stats.totalLanguages],
    ['Issued books', payload.stats.issuedBooks],
    ['Overdue books', payload.stats.overdueBooks],
    ['Active members', payload.stats.activeMembers],
    ['Acquisitions in range', payload.stats.acquisitionsInRange],
    ['Collections in range', payload.stats.collectionsInRange],
    [],
    ['Recent additions'],
    ['Title', 'Authors', 'Publisher', 'Copy count', 'Available copies', 'Created at'],
    ...payload.recentAdditions.map((item) => [
      item.title,
      item.authors.join(', '),
      item.publisherName ?? '',
      item.copyCount,
      item.availableCopies,
      item.createdAt,
    ]),
    [],
    ['Acquisitions by month'],
    ['Month', 'Value'],
    ...payload.charts.acquisitionsByMonth.map((item) => [item.labelEn ?? item.key, item.value]),
  ]

  return lines.map((line) => line.map(csvCell).join(',')).join('\n')
}

function buildDashboardHtml(libraryName: string, payload: StaffDashboardPayload) {
  const cards: Array<[string, number]> = [
    ['মোট টাইটেল', payload.stats.totalTitles],
    ['মোট কপি', payload.stats.totalCopies],
    ['মোট বিভাগ', payload.stats.totalCategories],
    ['মোট লেখক', payload.stats.totalAuthors],
    ['মোট প্রকাশক', payload.stats.totalPublishers],
    ['মোট ভাষা', payload.stats.totalLanguages],
    ['ইস্যুকৃত বই', payload.stats.issuedBooks],
    ['ওভারডিউ বই', payload.stats.overdueBooks],
    ['সক্রিয় সদস্য', payload.stats.activeMembers],
    ['সময়ভিত্তিক অধিগ্রহণ', payload.stats.acquisitionsInRange],
  ]

  return `<!doctype html>
<html lang="bn">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(libraryName)} - Dashboard Analytics</title>
    <style>
      body { font-family: 'Hind Siliguri', sans-serif; margin: 32px; color: #18212f; }
      h1, h2 { margin-bottom: 8px; }
      .muted { color: #5c6475; }
      .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 24px 0; }
      .card { border: 1px solid #d7dfeb; border-radius: 16px; padding: 16px; background: #fff; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #e6ecf3; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(libraryName)} ড্যাশবোর্ড অ্যানালিটিক্স</h1>
    <p class="muted">সময়সীমা: ${escapeHtml(payload.filters.rangeLabelBn)} | তৈরি হয়েছে: ${escapeHtml(payload.generatedAt)}</p>
    <section class="grid">
      ${cards
        .map(
          ([label, value]) =>
            `<article class="card"><div class="muted">${escapeHtml(label)}</div><strong>${value}</strong></article>`,
        )
        .join('')}
    </section>
    <section>
      <h2>সাম্প্রতিক সংযোজন</h2>
      <table>
        <thead>
          <tr><th>শিরোনাম</th><th>লেখক</th><th>প্রকাশক</th><th>কপি</th><th>উপলভ্য</th></tr>
        </thead>
        <tbody>
          ${payload.recentAdditions
            .map(
              (item) =>
                `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.authors.join(', '))}</td><td>${escapeHtml(item.publisherName ?? '-')}</td><td>${item.copyCount}</td><td>${item.availableCopies}</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </section>
  </body>
</html>`
}

export async function exportStaffDashboard(
  env: AppBindings,
  actor: SessionUser,
  input: AnalyticsFilterInput & { format: AnalyticsExportFormat },
  requestId?: string | null,
): Promise<AnalyticsExportResult> {
  const payload = await getStaffDashboard(env, actor, input)
  const shell = await getShellSettings(env.DB, env)
  const fileName = `dashboard-analytics-${payload.filters.startDate}-${payload.filters.endDate}.${input.format === 'csv' ? 'csv' : 'html'}`
  const outputKey = buildR2Key(input.format === 'csv' ? 'exports' : 'reports', fileName)
  const body =
    input.format === 'csv'
      ? buildDashboardCsv(payload)
      : buildDashboardHtml(shell.profile.siteNameBn || env.APP_NAME_BN, payload)
  const file = new File([body], fileName, {
    type: input.format === 'csv' ? 'text/csv;charset=utf-8' : 'text/html;charset=utf-8',
  })

  await putFile(env.MEDIA_BUCKET, outputKey, file, {
    module: 'dashboard_analytics',
    format: input.format,
  })

  const exportId = crypto.randomUUID()
  await dbRun(
    env.DB,
    `
      INSERT INTO exports (
        id,
        export_type,
        export_format,
        requested_tables_json,
        requested_by_user_id,
        status,
        output_r2_key,
        note,
        created_at,
        completed_at,
        filter_json,
        file_name
      )
      VALUES (?, 'dashboard_analytics', ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?)
    `,
    [
      exportId,
      input.format,
      JSON.stringify(['bibliographic_records', 'book_copies', 'loans', 'members', 'audit_logs']),
      actor.id,
      outputKey,
      `Dashboard analytics export for ${payload.filters.rangeLabelEn}`,
      dhakaNow(),
      dhakaNow(),
      JSON.stringify(payload.filters),
      fileName,
    ],
  )

  await writeAudit(
    env.DB,
    actor,
    'analytics.dashboard.export',
    'export',
    exportId,
    'Dashboard analytics export was generated.',
    {
      after: {
        exportId,
        format: input.format,
        outputKey,
        filters: payload.filters,
      },
      requestId,
    },
  )

  return {
    exportId,
    fileName,
    outputKey,
    outputUrl: `/files/${encodeURIComponent(outputKey)}`,
    format: input.format,
  }
}

export async function publicAnalyticsEnabled(db: D1Database) {
  const publicSettings = await getPublicSiteSettings(db)
  return publicSettings.menu.analytics
}
