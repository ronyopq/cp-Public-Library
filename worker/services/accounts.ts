import type {
  AccountingCollectionResult,
  AccountingDashboardPayload,
  AccountingExportResult,
  AccountingMemberLedgerPayload,
  AccountingPaymentRecord,
  AccountingReceiptDetail,
  AccountingReceiptItem,
  AccountingReportFilters,
  AccountingReportPayload,
  DueMonthOption,
  FeeTypeDefinition,
  LookupOption,
  Member,
  MemberDueLine,
  MemberDueStatus,
  MemberLedgerEntry,
  MemberLedgerSummary,
  PaymentTypeOption,
  SessionUser,
} from '@shared/index'
import { dhakaNow } from '@shared/utils'
import type { AppBindings } from '../types'
import { writeAudit } from '../lib/audit'
import { boolToInt, dbAll, dbFirst, dbRun, dbValue, intToBool, jsonObject } from '../lib/db'
import { getShellSettings } from '../lib/settings'
import { buildR2Key, putFile } from '../lib/storage'

interface FeeTypeRow {
  id: string
  feeCode: string
  baseCode: string | null
  nameBn: string
  nameEn: string
  descriptionBn: string | null
  descriptionEn: string | null
  collectionMode: FeeTypeDefinition['collectionMode']
  defaultAmount: number
  allowCustomAmount: number
  allowMultiMonth: number
  incomeAccountId: string | null
  incomeAccountCode: string | null
  incomeAccountNameBn: string | null
  active: number
  isSystem: number
  sortOrder: number
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

interface PaymentMethodRow {
  id: string
  code: string
  nameBn: string
  nameEn: string
  requiresReference: number
}

interface MemberRow {
  id: string
  memberCode: string
  fullNameBn: string
  fullNameEn: string | null
  guardianName: string | null
  email: string | null
  phone: string
  nationalId: string | null
  addressLine: string
  area: string | null
  district: string | null
  dateOfBirth: string | null
  joinedAt: string
  membershipExpiresAt: string | null
  memberStatus: Member['memberStatus']
  photoKey: string | null
  notes: string | null
}

interface DueRow {
  id: string
  memberId: string
  feeTypeId: string
  feeTypeCode: string
  feeTypeNameBn: string
  month: string
  dueDate: string | null
  expectedAmount: number
  paidAmount: number
  waivedAmount: number
  status: MemberDueStatus
  note: string | null
  updatedAt: string
}

interface PaymentRow {
  id: string
  memberId: string | null
  memberCode: string | null
  memberNameBn: string | null
  feeTypeCode: string | null
  feeTypeNameBn: string | null
  paymentMethodCode: string
  paymentMethodNameBn: string
  amount: number
  paidAt: string
  status: AccountingPaymentRecord['status']
  receiptId: string | null
  receiptNo: string | null
  referenceNo: string | null
  note: string | null
  voidedAt: string | null
  deletedAt: string | null
}

interface ReceiptRow {
  id: string
  receiptNo: string
  paymentId: string
  memberId: string | null
  memberCode: string | null
  memberNameBn: string | null
  paymentMethodCode: string
  paymentMethodNameBn: string
  feeTypeNameBn: string
  totalAmount: number
  paidAt: string
  note: string | null
  collectedByNameBn: string | null
  fileKey: string | null
  paymentSnapshotJson: string | null
  reprintCount: number
  lastReprintedAt: string | null
}

interface ReceiptSnapshot {
  memberId?: string | null
  memberCode?: string | null
  memberNameBn?: string | null
  paymentMethodCode: string
  paymentMethodNameBn: string
  feeTypeNameBn: string
  totalAmount: number
  paidAt: string
  note?: string | null
  collectedByNameBn?: string | null
  items: AccountingReceiptItem[]
}

interface AllocationPlanItem {
  dueEntryId?: string | null
  feeTypeId: string
  feeTypeCode: string
  feeTypeNameBn: string
  month?: string | null
  amount: number
  expectedAmount?: number
  isAdvance: boolean
  note?: string | null
}

interface LedgerRow {
  id: string
  entryDate: string
  accountCode: string
  accountNameBn: string
  direction: 'debit' | 'credit'
  amount: number
  referenceType: string | null
  narration: string | null
}

interface ReportPaymentRow {
  paymentId: string
  memberId: string | null
  memberCode: string | null
  memberNameBn: string | null
  feeTypeId: string | null
  feeTypeCode: string | null
  feeTypeNameBn: string | null
  paymentMethodCode: string
  paymentMethodNameBn: string
  amount: number
  paidAt: string
  status: AccountingPaymentRecord['status']
  receiptId: string | null
  receiptNo: string | null
  referenceNo: string | null
  note: string | null
  voidedAt: string | null
  allocationJson: string | null
}

interface AccountLedgerAggregateRow {
  accountCode: string
  accountNameBn: string
  debitTotal: number | null
  creditTotal: number | null
}

interface BalanceRow {
  memberId: string
  memberCode: string
  memberNameBn: string
  outstandingAmount: number | null
  advanceAmount: number | null
}

function sanitizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function optionalString(value: unknown): string | null {
  const normalized = sanitizeString(value)
  return normalized || null
}

function monthTokenFromValue(value?: string | null): string | null {
  const normalized = sanitizeString(value)
  if (!normalized) {
    return null
  }
  if (/^\d{4}-\d{2}$/.test(normalized)) {
    return normalized
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) {
    return normalized.slice(0, 7)
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return formatDhakaMonthToken(parsed)
}

function formatDhakaMonthToken(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  const year = parts.find((item) => item.type === 'year')?.value ?? '1970'
  const month = parts.find((item) => item.type === 'month')?.value ?? '01'
  return `${year}-${month}`
}

function formatDhakaDateToken(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  const year = parts.find((item) => item.type === 'year')?.value ?? '1970'
  const month = parts.find((item) => item.type === 'month')?.value ?? '01'
  const day = parts.find((item) => item.type === 'day')?.value ?? '01'
  return `${year}-${month}-${day}`
}

function monthLabelBn(month: string): string {
  return new Intl.DateTimeFormat('bn-BD', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: 'long',
  }).format(new Date(`${month}-01T00:00:00+06:00`))
}

function monthLabelEn(month: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: 'short',
  }).format(new Date(`${month}-01T00:00:00+06:00`))
}

function compareMonthTokens(left: string, right: string) {
  return left.localeCompare(right)
}

function addMonths(month: string, offset: number): string {
  const [yearText, monthText] = month.split('-')
  const baseYear = Number(yearText)
  const baseMonth = Number(monthText) - 1
  const serial = baseYear * 12 + baseMonth + offset
  const nextYear = Math.floor(serial / 12)
  const nextMonth = (serial % 12) + 1
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`
}

function buildMonthRange(startMonth: string, endMonth: string): string[] {
  const months: string[] = []
  let cursor = startMonth

  while (compareMonthTokens(cursor, endMonth) <= 0) {
    months.push(cursor)
    cursor = addMonths(cursor, 1)
  }

  return months
}

function currentMonthToken() {
  return formatDhakaMonthToken(new Date())
}

function currentDateToken() {
  return formatDhakaDateToken(new Date())
}

function startOfDhakaDayIso(dateToken: string) {
  return new Date(`${dateToken}T00:00:00+06:00`).toISOString()
}

function endOfDhakaDayIso(dateToken: string) {
  return new Date(`${dateToken}T23:59:59.999+06:00`).toISOString()
}

function monthStartDateToken(month: string) {
  return `${month}-01`
}

function monthEndDateToken(month: string) {
  const [yearText, monthText] = month.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText)
  const endDate = new Date(Date.UTC(year, monthIndex, 0))
  return `${month}-${String(endDate.getUTCDate()).padStart(2, '0')}`
}

function paymentAssetAccountId(paymentMethodCode: string) {
  if (paymentMethodCode === 'bkash' || paymentMethodCode === 'nagad') {
    return 'acct_wallet'
  }
  if (paymentMethodCode === 'bank_transfer' || paymentMethodCode === 'card') {
    return 'acct_bank'
  }
  return 'acct_cash'
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function mapMember(row: MemberRow): Member {
  return {
    id: row.id,
    memberCode: row.memberCode,
    fullNameBn: row.fullNameBn,
    fullNameEn: row.fullNameEn,
    guardianName: row.guardianName,
    email: row.email,
    phone: row.phone,
    nationalId: row.nationalId,
    addressLine: row.addressLine,
    area: row.area,
    district: row.district,
    dateOfBirth: row.dateOfBirth,
    joinedAt: row.joinedAt,
    membershipExpiresAt: row.membershipExpiresAt,
    memberStatus: row.memberStatus,
    photoKey: row.photoKey,
    notes: row.notes,
  }
}

function mapFeeType(row: FeeTypeRow): FeeTypeDefinition {
  return {
    id: row.id,
    feeCode: row.feeCode,
    baseCode: row.baseCode,
    nameBn: row.nameBn,
    nameEn: row.nameEn,
    descriptionBn: row.descriptionBn,
    descriptionEn: row.descriptionEn,
    collectionMode: row.collectionMode,
    defaultAmount: Number(row.defaultAmount ?? 0),
    allowCustomAmount: intToBool(row.allowCustomAmount),
    allowMultiMonth: intToBool(row.allowMultiMonth),
    incomeAccountId: row.incomeAccountId,
    incomeAccountCode: row.incomeAccountCode,
    incomeAccountNameBn: row.incomeAccountNameBn,
    active: intToBool(row.active),
    isSystem: intToBool(row.isSystem),
    sortOrder: Number(row.sortOrder ?? 50),
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapPaymentMethod(row: PaymentMethodRow): PaymentTypeOption {
  return {
    id: row.id,
    code: row.code,
    nameBn: row.nameBn,
    nameEn: row.nameEn,
  }
}

function mapPayment(row: PaymentRow): AccountingPaymentRecord {
  return {
    id: row.id,
    memberId: row.memberId,
    memberCode: row.memberCode,
    memberNameBn: row.memberNameBn,
    feeTypeCode: row.feeTypeCode,
    feeTypeNameBn: row.feeTypeNameBn ?? 'অন্যান্য',
    paymentMethodCode: row.paymentMethodCode,
    paymentMethodNameBn: row.paymentMethodNameBn,
    amount: Number(row.amount ?? 0),
    paidAt: row.paidAt,
    status: row.status,
    receiptId: row.receiptId,
    receiptNo: row.receiptNo,
    referenceNo: row.referenceNo,
    note: row.note,
    isVoided: Boolean(row.voidedAt || row.deletedAt || row.status === 'refunded'),
    voidedAt: row.voidedAt ?? row.deletedAt,
    canVoid: !row.voidedAt && !row.deletedAt && row.status === 'completed',
  }
}

function rowToDueLine(row: DueRow): MemberDueLine {
  const outstandingAmount = Math.max(
    0,
    Number(row.expectedAmount ?? 0) -
      Number(row.paidAmount ?? 0) -
      Number(row.waivedAmount ?? 0),
  )
  const currentMonth = currentMonthToken()

  return {
    id: row.id,
    memberId: row.memberId,
    feeTypeId: row.feeTypeId,
    feeTypeCode: row.feeTypeCode,
    feeTypeNameBn: row.feeTypeNameBn,
    month: row.month,
    dueDate: row.dueDate,
    expectedAmount: Number(row.expectedAmount ?? 0),
    paidAmount: Number(row.paidAmount ?? 0),
    waivedAmount: Number(row.waivedAmount ?? 0),
    outstandingAmount,
    isAdvance: compareMonthTokens(row.month, currentMonth) > 0,
    status: row.status,
    note: row.note,
    updatedAt: row.updatedAt,
  }
}

function receiptSnapshotToDetail(row: ReceiptRow): AccountingReceiptDetail {
  const snapshot = jsonObject<ReceiptSnapshot>(row.paymentSnapshotJson, {
    paymentMethodCode: row.paymentMethodCode,
    paymentMethodNameBn: row.paymentMethodNameBn,
    feeTypeNameBn: row.feeTypeNameBn,
    totalAmount: Number(row.totalAmount ?? 0),
    paidAt: row.paidAt,
    items: [],
  })

  return {
    id: row.id,
    receiptNo: row.receiptNo,
    paymentId: row.paymentId,
    memberId: row.memberId,
    memberCode: row.memberCode ?? snapshot.memberCode,
    memberNameBn: row.memberNameBn ?? snapshot.memberNameBn,
    paymentMethodCode: snapshot.paymentMethodCode,
    paymentMethodNameBn: snapshot.paymentMethodNameBn,
    feeTypeNameBn: snapshot.feeTypeNameBn,
    totalAmount: Number(snapshot.totalAmount ?? row.totalAmount ?? 0),
    paidAt: snapshot.paidAt ?? row.paidAt,
    note: snapshot.note ?? row.note,
    items: snapshot.items ?? [],
    collectedByNameBn: snapshot.collectedByNameBn ?? row.collectedByNameBn,
    fileKey: row.fileKey,
    fileUrl: row.fileKey ? `/files/${encodeURIComponent(row.fileKey)}` : null,
    reprintCount: Number(row.reprintCount ?? 0),
    lastReprintedAt: row.lastReprintedAt,
  }
}

async function loadFeeTypes(db: D1Database) {
  const rows = await dbAll<FeeTypeRow>(
    db,
    `
      SELECT
        fee_types.id AS id,
        fee_types.fee_code AS feeCode,
        fee_types.base_code AS baseCode,
        fee_types.name_bn AS nameBn,
        fee_types.name_en AS nameEn,
        fee_types.description_bn AS descriptionBn,
        fee_types.description_en AS descriptionEn,
        fee_types.collection_mode AS collectionMode,
        fee_types.default_amount AS defaultAmount,
        fee_types.allow_custom_amount AS allowCustomAmount,
        fee_types.allow_multi_month AS allowMultiMonth,
        fee_types.income_account_id AS incomeAccountId,
        accounts.account_code AS incomeAccountCode,
        accounts.account_name_bn AS incomeAccountNameBn,
        fee_types.active AS active,
        fee_types.is_system AS isSystem,
        fee_types.sort_order AS sortOrder,
        fee_types.deleted_at AS deletedAt,
        fee_types.created_at AS createdAt,
        fee_types.updated_at AS updatedAt
      FROM fee_types
      LEFT JOIN accounts ON accounts.id = fee_types.income_account_id
      WHERE fee_types.deleted_at IS NULL
      ORDER BY fee_types.sort_order ASC, fee_types.name_bn ASC
    `,
  )

  return rows.map(mapFeeType)
}

async function loadPaymentMethods(db: D1Database) {
  const rows = await dbAll<PaymentMethodRow>(
    db,
    `
      SELECT
        id,
        payment_type_code AS code,
        name_bn AS nameBn,
        name_en AS nameEn,
        requires_reference AS requiresReference
      FROM payment_types
      WHERE active = 1
      ORDER BY name_bn ASC
    `,
  )

  return rows.map(mapPaymentMethod)
}

async function resolveMember(db: D1Database, memberId: string): Promise<Member | null> {
  const row = await dbFirst<MemberRow>(
    db,
    `
      SELECT
        id,
        member_no AS memberCode,
        full_name_bn AS fullNameBn,
        full_name_en AS fullNameEn,
        guardian_name AS guardianName,
        email,
        phone,
        national_id AS nationalId,
        address_line AS addressLine,
        area,
        district,
        date_of_birth AS dateOfBirth,
        joined_at AS joinedAt,
        membership_expires_at AS membershipExpiresAt,
        status AS memberStatus,
        photo_r2_key AS photoKey,
        note AS notes
      FROM members
      WHERE id = ?
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [memberId],
  )

  return row ? mapMember(row) : null
}

async function resolveFeeType(
  db: D1Database,
  feeTypeId: string,
  includeDeleted = false,
): Promise<FeeTypeDefinition | null> {
  const row = await dbFirst<FeeTypeRow>(
    db,
    `
      SELECT
        fee_types.id AS id,
        fee_types.fee_code AS feeCode,
        fee_types.base_code AS baseCode,
        fee_types.name_bn AS nameBn,
        fee_types.name_en AS nameEn,
        fee_types.description_bn AS descriptionBn,
        fee_types.description_en AS descriptionEn,
        fee_types.collection_mode AS collectionMode,
        fee_types.default_amount AS defaultAmount,
        fee_types.allow_custom_amount AS allowCustomAmount,
        fee_types.allow_multi_month AS allowMultiMonth,
        fee_types.income_account_id AS incomeAccountId,
        accounts.account_code AS incomeAccountCode,
        accounts.account_name_bn AS incomeAccountNameBn,
        fee_types.active AS active,
        fee_types.is_system AS isSystem,
        fee_types.sort_order AS sortOrder,
        fee_types.deleted_at AS deletedAt,
        fee_types.created_at AS createdAt,
        fee_types.updated_at AS updatedAt
      FROM fee_types
      LEFT JOIN accounts ON accounts.id = fee_types.income_account_id
      WHERE fee_types.id = ?
        ${includeDeleted ? '' : 'AND fee_types.deleted_at IS NULL'}
      LIMIT 1
    `,
    [feeTypeId],
  )

  return row ? mapFeeType(row) : null
}

async function resolvePaymentMethod(
  db: D1Database,
  paymentMethodCode: string,
): Promise<PaymentTypeOption | null> {
  const row = await dbFirst<PaymentMethodRow>(
    db,
    `
      SELECT
        id,
        payment_type_code AS code,
        name_bn AS nameBn,
        name_en AS nameEn,
        requires_reference AS requiresReference
      FROM payment_types
      WHERE payment_type_code = ?
        AND active = 1
      LIMIT 1
    `,
    [paymentMethodCode],
  )

  return row ? mapPaymentMethod(row) : null
}

async function syncMemberMonthlyDuePeriods(
  db: D1Database,
  memberId: string,
  actor: SessionUser | null = null,
  requestId?: string | null,
) {
  const member = await resolveMember(db, memberId)
  if (!member) {
    throw new Error('সদস্য খুঁজে পাওয়া যায়নি।')
  }

  const monthlyFeeTypes = (await loadFeeTypes(db)).filter(
    (item) => item.active && item.collectionMode === 'monthly',
  )
  if (monthlyFeeTypes.length === 0) {
    return member
  }

  const startMonth = monthTokenFromValue(member.joinedAt) ?? currentMonthToken()
  const currentMonth = currentMonthToken()
  const expiryMonth = monthTokenFromValue(member.membershipExpiresAt)
  const endMonth =
    expiryMonth && compareMonthTokens(expiryMonth, currentMonth) < 0
      ? expiryMonth
      : currentMonth

  if (compareMonthTokens(startMonth, endMonth) > 0) {
    return member
  }

  const months = buildMonthRange(startMonth, endMonth)
  const existingRows = await dbAll<{ key: string }>(
    db,
    `
      SELECT fee_type_id || ':' || period_month AS key
      FROM member_fee_periods
      WHERE member_id = ?
        AND deleted_at IS NULL
    `,
    [memberId],
  )

  const existingKeys = new Set(existingRows.map((item) => item.key))
  const insertedMonths: string[] = []
  const now = dhakaNow()

  for (const feeType of monthlyFeeTypes) {
    for (const month of months) {
      const key = `${feeType.id}:${month}`
      if (existingKeys.has(key)) {
        continue
      }

      await dbRun(
        db,
        `
          INSERT INTO member_fee_periods (
            id,
            member_id,
            fee_type_id,
            period_month,
            due_date,
            expected_amount,
            paid_amount,
            waived_amount,
            status,
            note,
            source_module,
            created_by_user_id,
            updated_by_user_id,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'open', ?, 'accounts', ?, ?, ?, ?)
        `,
        [
          crypto.randomUUID(),
          memberId,
          feeType.id,
          month,
          monthStartDateToken(month),
          feeType.defaultAmount,
          'Monthly due materialized',
          actor?.id ?? null,
          actor?.id ?? null,
          now,
          now,
        ],
      )

      insertedMonths.push(`${feeType.nameBn} ${month}`)
    }
  }

  if (insertedMonths.length > 0 && actor) {
    await writeAudit(
      db,
      actor,
      'accounts.dues.sync',
      'member_fee_period',
      memberId,
      'Monthly dues were synchronized for the member.',
      {
        after: {
          memberId,
          insertedMonths,
        },
        requestId: requestId ?? null,
      },
    )
  }

  return member
}

async function syncAllMembersMonthlyDuePeriods(db: D1Database) {
  const rows = await dbAll<{ id: string }>(
    db,
    `SELECT id FROM members WHERE deleted_at IS NULL`,
  )

  for (const row of rows) {
    await syncMemberMonthlyDuePeriods(db, row.id, null)
  }
}

async function ensureDueRowsForMonths(
  db: D1Database,
  memberId: string,
  feeType: FeeTypeDefinition,
  months: string[],
  actor: SessionUser | null = null,
) {
  const monthList = Array.from(new Set(months)).sort(compareMonthTokens)
  if (monthList.length === 0) {
    return
  }

  const placeholders = monthList.map(() => '?').join(', ')
  const existingRows = await dbAll<{ month: string }>(
    db,
    `
      SELECT period_month AS month
      FROM member_fee_periods
      WHERE member_id = ?
        AND fee_type_id = ?
        AND period_month IN (${placeholders})
        AND deleted_at IS NULL
    `,
    [memberId, feeType.id, ...monthList],
  )
  const existingMonths = new Set(existingRows.map((item) => item.month))
  const now = dhakaNow()

  for (const month of monthList) {
    if (existingMonths.has(month)) {
      continue
    }

    await dbRun(
      db,
      `
        INSERT INTO member_fee_periods (
          id,
          member_id,
          fee_type_id,
          period_month,
          due_date,
          expected_amount,
          paid_amount,
          waived_amount,
          status,
          note,
          source_module,
          created_by_user_id,
          updated_by_user_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'open', ?, 'accounts', ?, ?, ?, ?)
      `,
      [
        crypto.randomUUID(),
        memberId,
        feeType.id,
        month,
        monthStartDateToken(month),
        feeType.defaultAmount,
        'Selected for collection',
        actor?.id ?? null,
        actor?.id ?? null,
        now,
        now,
      ],
    )
  }
}

async function listMemberDueLines(db: D1Database, memberId: string) {
  const rows = await dbAll<DueRow>(
    db,
    `
      SELECT
        member_fee_periods.id AS id,
        member_fee_periods.member_id AS memberId,
        member_fee_periods.fee_type_id AS feeTypeId,
        fee_types.fee_code AS feeTypeCode,
        fee_types.name_bn AS feeTypeNameBn,
        member_fee_periods.period_month AS month,
        member_fee_periods.due_date AS dueDate,
        member_fee_periods.expected_amount AS expectedAmount,
        member_fee_periods.paid_amount AS paidAmount,
        member_fee_periods.waived_amount AS waivedAmount,
        member_fee_periods.status AS status,
        member_fee_periods.note AS note,
        member_fee_periods.updated_at AS updatedAt
      FROM member_fee_periods
      INNER JOIN fee_types ON fee_types.id = member_fee_periods.fee_type_id
      WHERE member_fee_periods.member_id = ?
        AND member_fee_periods.deleted_at IS NULL
        AND fee_types.deleted_at IS NULL
      ORDER BY member_fee_periods.period_month DESC, fee_types.sort_order ASC
    `,
    [memberId],
  )

  return rows.map(rowToDueLine)
}

function buildDueMonthOptions(member: Member, feeTypes: FeeTypeDefinition[], dueLines: MemberDueLine[]) {
  const options: Record<string, DueMonthOption[]> = {}
  const startMonth = monthTokenFromValue(member.joinedAt) ?? currentMonthToken()
  const currentMonth = currentMonthToken()
  const expiryMonth = monthTokenFromValue(member.membershipExpiresAt)
  const maxFutureMonth = addMonths(currentMonth, 6)
  const endMonth =
    expiryMonth && compareMonthTokens(expiryMonth, maxFutureMonth) < 0
      ? expiryMonth
      : maxFutureMonth
  const allMonths =
    compareMonthTokens(startMonth, endMonth) <= 0
      ? buildMonthRange(startMonth, endMonth)
      : [currentMonth]

  for (const feeType of feeTypes.filter((item) => item.active && item.collectionMode === 'monthly')) {
    const feeLines = dueLines.filter((line) => line.feeTypeId === feeType.id)
    const lineMap = new Map(feeLines.map((line) => [line.month, line]))

    options[feeType.id] = allMonths.map((month) => {
      const line = lineMap.get(month)
      const expectedAmount = line?.expectedAmount ?? feeType.defaultAmount
      const paidAmount = line?.paidAmount ?? 0
      const waivedAmount = line?.waivedAmount ?? 0
      const outstandingAmount = Math.max(0, expectedAmount - paidAmount - waivedAmount)
      const isAdvance = compareMonthTokens(month, currentMonth) > 0

      return {
        month,
        labelBn: monthLabelBn(month),
        labelEn: monthLabelEn(month),
        expectedAmount,
        paidAmount,
        waivedAmount,
        outstandingAmount,
        isAdvance,
        status:
          line?.status ??
          (outstandingAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'open'),
      }
    })
  }

  return options
}

async function listPayments(
  db: D1Database,
  options: {
    limit?: number
    memberId?: string | null
    startIso?: string | null
    endIso?: string | null
    paymentMethodCode?: string | null
    feeTypeId?: string | null
    includeDeleted?: boolean
  } = {},
) {
  const conditions = ['1 = 1']
  const bindings: unknown[] = []

  if (!options.includeDeleted) {
    conditions.push(`payments.deleted_at IS NULL`)
  }
  if (options.memberId) {
    conditions.push(`payments.member_id = ?`)
    bindings.push(options.memberId)
  }
  if (options.startIso) {
    conditions.push(`payments.paid_at >= ?`)
    bindings.push(options.startIso)
  }
  if (options.endIso) {
    conditions.push(`payments.paid_at <= ?`)
    bindings.push(options.endIso)
  }
  if (options.paymentMethodCode) {
    conditions.push(`payment_types.payment_type_code = ?`)
    bindings.push(options.paymentMethodCode)
  }
  if (options.feeTypeId) {
    conditions.push(`payments.fee_type_id = ?`)
    bindings.push(options.feeTypeId)
  }

  const limitClause = options.limit ? `LIMIT ${Number(options.limit)}` : ''
  const rows = await dbAll<PaymentRow>(
    db,
    `
      SELECT
        payments.id AS id,
        payments.member_id AS memberId,
        members.member_no AS memberCode,
        members.full_name_bn AS memberNameBn,
        COALESCE(fee_types.fee_code, CASE WHEN payments.fine_id IS NOT NULL THEN 'fine' ELSE NULL END) AS feeTypeCode,
        COALESCE(fee_types.name_bn, CASE WHEN payments.fine_id IS NOT NULL THEN 'জরিমানা' ELSE 'অন্যান্য' END) AS feeTypeNameBn,
        payment_types.payment_type_code AS paymentMethodCode,
        payment_types.name_bn AS paymentMethodNameBn,
        payments.amount AS amount,
        payments.paid_at AS paidAt,
        payments.status AS status,
        receipts.id AS receiptId,
        receipts.receipt_no AS receiptNo,
        payments.reference_no AS referenceNo,
        payments.note AS note,
        payments.voided_at AS voidedAt,
        payments.deleted_at AS deletedAt
      FROM payments
      INNER JOIN payment_types ON payment_types.id = payments.payment_type_id
      LEFT JOIN fee_types ON fee_types.id = payments.fee_type_id
      LEFT JOIN members ON members.id = payments.member_id
      LEFT JOIN receipts ON receipts.payment_id = payments.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY payments.paid_at DESC, payments.created_at DESC
      ${limitClause}
    `,
    bindings,
  )

  return rows.map(mapPayment)
}

async function listReceiptRows(
  db: D1Database,
  options: { memberId?: string | null; paymentId?: string | null; limit?: number } = {},
) {
  const conditions = ['1 = 1']
  const bindings: unknown[] = []

  if (options.memberId) {
    conditions.push(`receipts.member_id = ?`)
    bindings.push(options.memberId)
  }
  if (options.paymentId) {
    conditions.push(`receipts.payment_id = ?`)
    bindings.push(options.paymentId)
  }

  const limitClause = options.limit ? `LIMIT ${Number(options.limit)}` : ''
  const rows = await dbAll<ReceiptRow>(
    db,
    `
      SELECT
        receipts.id AS id,
        receipts.receipt_no AS receiptNo,
        receipts.payment_id AS paymentId,
        receipts.member_id AS memberId,
        members.member_no AS memberCode,
        members.full_name_bn AS memberNameBn,
        payment_types.payment_type_code AS paymentMethodCode,
        payment_types.name_bn AS paymentMethodNameBn,
        COALESCE(fee_types.name_bn, CASE WHEN payments.fine_id IS NOT NULL THEN 'জরিমানা' ELSE 'অন্যান্য' END) AS feeTypeNameBn,
        payments.amount AS totalAmount,
        payments.paid_at AS paidAt,
        payments.note AS note,
        users.full_name_bn AS collectedByNameBn,
        receipts.file_r2_key AS fileKey,
        receipts.payment_snapshot_json AS paymentSnapshotJson,
        receipts.reprint_count AS reprintCount,
        receipts.last_reprinted_at AS lastReprintedAt
      FROM receipts
      INNER JOIN payments ON payments.id = receipts.payment_id
      INNER JOIN payment_types ON payment_types.id = payments.payment_type_id
      LEFT JOIN fee_types ON fee_types.id = payments.fee_type_id
      LEFT JOIN members ON members.id = receipts.member_id
      LEFT JOIN users ON users.id = receipts.issued_by_user_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY receipts.issued_at DESC, receipts.created_at DESC
      ${limitClause}
    `,
    bindings,
  )

  return rows.map(receiptSnapshotToDetail)
}

async function listMemberLedgerEntries(db: D1Database, memberId: string) {
  const rows = await dbAll<LedgerRow>(
    db,
    `
      SELECT
        ledgers.id AS id,
        ledgers.entry_date AS entryDate,
        accounts.account_code AS accountCode,
        accounts.account_name_bn AS accountNameBn,
        ledgers.direction AS direction,
        ledgers.amount AS amount,
        ledgers.reference_type AS referenceType,
        ledgers.narration AS narration
      FROM ledgers
      INNER JOIN accounts ON accounts.id = ledgers.account_id
      WHERE ledgers.member_id = ?
      ORDER BY ledgers.entry_date DESC, ledgers.created_at DESC
      LIMIT 50
    `,
    [memberId],
  )

  return rows.map<MemberLedgerEntry>((row) => ({
    id: row.id,
    entryDate: row.entryDate,
    accountCode: row.accountCode,
    accountNameBn: row.accountNameBn,
    direction: row.direction,
    amount: Number(row.amount ?? 0),
    referenceType: row.referenceType,
    narration: row.narration,
  }))
}

function summarizeDueLines(dueLines: MemberDueLine[], totalMemberPayments: number): MemberLedgerSummary {
  const currentMonth = currentMonthToken()
  let totalAssessed = 0
  let totalWaived = 0
  let outstanding = 0
  let advanceBalance = 0

  for (const line of dueLines) {
    totalAssessed += line.expectedAmount
    totalWaived += line.waivedAmount
    if (line.isAdvance) {
      advanceBalance += line.paidAmount
    }
    if (compareMonthTokens(line.month, currentMonth) <= 0) {
      outstanding += line.outstandingAmount
    }
  }

  return {
    totalAssessed,
    totalPaid: totalMemberPayments,
    totalWaived,
    outstanding,
    advanceBalance,
  }
}

function generateReceiptNo(libraryCode: string) {
  const year = currentDateToken().slice(0, 4)
  return `${libraryCode}-MR-${year}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
}

async function ensureUniqueReceiptNo(db: D1Database, libraryCode: string): Promise<string> {
  while (true) {
    const candidate = generateReceiptNo(libraryCode)
    const exists = await dbFirst<{ id: string }>(
      db,
      `SELECT id FROM receipts WHERE receipt_no = ? LIMIT 1`,
      [candidate],
    )
    if (!exists) {
      return candidate
    }
  }
}

function buildReceiptHtml(libraryName: string, receipt: AccountingReceiptDetail) {
  const itemRows = receipt.items
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>
            <strong>${escapeHtml(item.labelBn)}</strong>
            ${item.month ? `<div class="muted">${escapeHtml(monthLabelBn(item.month))}</div>` : ''}
            ${item.note ? `<div class="muted">${escapeHtml(item.note)}</div>` : ''}
          </td>
          <td>${item.quantity}</td>
          <td>${item.amount.toFixed(2)}</td>
          <td>${(item.amount * item.quantity).toFixed(2)}</td>
        </tr>
      `,
    )
    .join('')

  return `
    <!doctype html>
    <html lang="bn">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(receipt.receiptNo)}</title>
        <style>
          :root { --ink: #1a2330; --muted: #667085; --line: rgba(26, 35, 48, 0.14); --accent: #0d3b66; }
          * { box-sizing: border-box; }
          body { margin: 0; font-family: "Hind Siliguri", sans-serif; background: #f5f1e8; color: var(--ink); }
          .toolbar { position: sticky; top: 0; display: flex; justify-content: space-between; gap: 1rem; padding: 1rem 1.25rem; background: rgba(255,255,255,0.96); border-bottom: 1px solid var(--line); }
          .toolbar button { border: none; border-radius: 999px; padding: 0.75rem 1rem; background: var(--accent); color: #fff; cursor: pointer; font-weight: 700; }
          .sheet { width: min(100%, 210mm); margin: 1rem auto 2rem; padding: 14mm; background: #fff; border-radius: 1.4rem; box-shadow: 0 30px 60px rgba(13, 59, 102, 0.12); }
          .sheet-header { display: flex; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--line); padding-bottom: 1rem; }
          .sheet h1, .sheet h2, .sheet p { margin: 0; }
          .muted { color: var(--muted); font-size: 0.9rem; }
          .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; margin: 1rem 0 1.25rem; }
          .meta-card { padding: 0.9rem 1rem; border-radius: 1rem; border: 1px solid var(--line); background: #faf9f6; }
          .meta-card span { display: block; color: var(--muted); font-size: 0.84rem; margin-bottom: 0.2rem; }
          table { width: 100%; border-collapse: collapse; }
          th, td { text-align: left; padding: 0.85rem 0.7rem; border-bottom: 1px solid var(--line); vertical-align: top; }
          th { color: var(--muted); font-size: 0.88rem; }
          .total-row td { font-weight: 800; }
          .footer { display: flex; justify-content: space-between; gap: 1rem; margin-top: 1.25rem; }
          .footer-card { flex: 1; padding: 0.9rem 1rem; border: 1px solid var(--line); border-radius: 1rem; background: #faf9f6; }
          @media print {
            body { background: #fff; }
            .toolbar { display: none; }
            .sheet { box-shadow: none; margin: 0 auto; border-radius: 0; }
          }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <div>
            <strong>${escapeHtml(libraryName)}</strong>
            <p class="muted">মানি রিসিট প্রিন্ট প্রিভিউ</p>
          </div>
          <button type="button" onclick="window.print()">প্রিন্ট করুন</button>
        </div>
        <main class="sheet">
          <section class="sheet-header">
            <div>
              <p class="muted">মানি রিসিট</p>
              <h1>${escapeHtml(libraryName)}</h1>
              <p class="muted">রিসিট নং: ${escapeHtml(receipt.receiptNo)}</p>
            </div>
            <div style="text-align:right">
              <h2>${escapeHtml(receipt.feeTypeNameBn)}</h2>
              <p class="muted">${escapeHtml(receipt.paymentMethodNameBn)}</p>
              <p class="muted">${escapeHtml(receipt.paidAt.slice(0, 19).replace('T', ' '))}</p>
            </div>
          </section>
          <section class="meta-grid">
            <div class="meta-card">
              <span>সদস্য</span>
              <strong>${escapeHtml(receipt.memberNameBn ?? 'প্রযোজ্য নয়')}</strong>
              <div class="muted">${escapeHtml(receipt.memberCode ?? '')}</div>
            </div>
            <div class="meta-card">
              <span>সংগ্রহকারী</span>
              <strong>${escapeHtml(receipt.collectedByNameBn ?? 'System')}</strong>
              <div class="muted">${escapeHtml(receipt.note ?? 'কোনও অতিরিক্ত নোট নেই')}</div>
            </div>
          </section>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>ফি/বিবরণ</th>
                <th>সংখ্যা</th>
                <th>একক</th>
                <th>মোট</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows}
              <tr class="total-row">
                <td colspan="4">সর্বমোট</td>
                <td>${receipt.totalAmount.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <div class="footer">
            <div class="footer-card">
              <strong>নির্দেশনা</strong>
              <p class="muted">এই রিসিটটি সিস্টেম-জেনারেটেড। প্রয়োজনে অ্যাডমিন বা ম্যানেজার থেকে পুনর্মুদ্রণ করা যাবে।</p>
            </div>
            <div class="footer-card">
              <strong>রিপ্রিন্ট সংখ্যা</strong>
              <p class="muted">${receipt.reprintCount}</p>
            </div>
          </div>
        </main>
      </body>
    </html>
  `
}

async function persistReceiptHtml(
  env: AppBindings,
  receipt: AccountingReceiptDetail,
): Promise<string> {
  const shell = await getShellSettings(env.DB, env)
  const html = buildReceiptHtml(shell.profile.siteNameBn || env.APP_NAME_BN, receipt)
  const fileName = `${receipt.receiptNo}.html`
  const outputKey = buildR2Key('receipts', fileName)
  const outputFile = new File([html], fileName, {
    type: 'text/html; charset=utf-8',
  })
  await putFile(env.MEDIA_BUCKET, outputKey, outputFile, {
    receiptNo: receipt.receiptNo,
    paymentId: receipt.paymentId,
  })
  return outputKey
}

async function getReceiptDetail(db: D1Database, receiptId: string) {
  const row = await dbFirst<ReceiptRow>(
    db,
    `
      SELECT
        receipts.id AS id,
        receipts.receipt_no AS receiptNo,
        receipts.payment_id AS paymentId,
        receipts.member_id AS memberId,
        members.member_no AS memberCode,
        members.full_name_bn AS memberNameBn,
        payment_types.payment_type_code AS paymentMethodCode,
        payment_types.name_bn AS paymentMethodNameBn,
        COALESCE(fee_types.name_bn, CASE WHEN payments.fine_id IS NOT NULL THEN 'জরিমানা' ELSE 'অন্যান্য' END) AS feeTypeNameBn,
        payments.amount AS totalAmount,
        payments.paid_at AS paidAt,
        payments.note AS note,
        users.full_name_bn AS collectedByNameBn,
        receipts.file_r2_key AS fileKey,
        receipts.payment_snapshot_json AS paymentSnapshotJson,
        receipts.reprint_count AS reprintCount,
        receipts.last_reprinted_at AS lastReprintedAt
      FROM receipts
      INNER JOIN payments ON payments.id = receipts.payment_id
      INNER JOIN payment_types ON payment_types.id = payments.payment_type_id
      LEFT JOIN fee_types ON fee_types.id = payments.fee_type_id
      LEFT JOIN members ON members.id = receipts.member_id
      LEFT JOIN users ON users.id = receipts.issued_by_user_id
      WHERE receipts.id = ?
      LIMIT 1
    `,
    [receiptId],
  )

  return row ? receiptSnapshotToDetail(row) : null
}

async function createReceiptRecord(
  env: AppBindings,
  actor: SessionUser,
  paymentId: string,
  memberId: string | null,
  snapshot: ReceiptSnapshot,
) {
  const receiptId = crypto.randomUUID()
  const receiptNo = await ensureUniqueReceiptNo(env.DB, env.LIBRARY_CODE)
  const now = dhakaNow()

  await dbRun(
    env.DB,
    `
      INSERT INTO receipts (
        id,
        receipt_no,
        payment_id,
        issued_at,
        issued_by_user_id,
        member_id,
        payment_snapshot_json,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      receiptId,
      receiptNo,
      paymentId,
      now,
      actor.id,
      memberId,
      JSON.stringify(snapshot),
      now,
      now,
    ],
  )

  const detail = await getReceiptDetail(env.DB, receiptId)
  if (!detail) {
    throw new Error('রিসিট তৈরি করা যায়নি।')
  }

  const fileKey = await persistReceiptHtml(env, detail)
  await dbRun(
    env.DB,
    `
      UPDATE receipts
      SET file_r2_key = ?, updated_at = ?
      WHERE id = ?
    `,
    [fileKey, dhakaNow(), receiptId],
  )

  const refreshed = await getReceiptDetail(env.DB, receiptId)
  if (!refreshed) {
    throw new Error('রিসিট পুনরায় লোড করা যায়নি।')
  }

  return refreshed
}

async function createLedgerEntriesForPayment(
  db: D1Database,
  actor: SessionUser,
  paymentId: string,
  memberId: string | null,
  paymentMethodCode: string,
  allocations: AllocationPlanItem[],
  narrationPrefix: string,
) {
  const now = dhakaNow()
  const journalGroupId = crypto.randomUUID()
  const assetAccountId = paymentAssetAccountId(paymentMethodCode)
  const totalAmount = allocations.reduce((sum, item) => sum + item.amount, 0)

  await dbRun(
    db,
    `
      INSERT INTO ledgers (
        id,
        account_id,
        entry_date,
        direction,
        amount,
        reference_type,
        reference_id,
        narration,
        created_by_user_id,
        created_at,
        journal_group_id,
        member_id,
        payment_id,
        source_module
      )
      VALUES (?, ?, ?, 'debit', ?, 'payment', ?, ?, ?, ?, ?, ?, ?, 'accounts')
    `,
    [
      crypto.randomUUID(),
      assetAccountId,
      now,
      totalAmount,
      paymentId,
      `${narrationPrefix} গ্রহণ`,
      actor.id,
      now,
      journalGroupId,
      memberId,
      paymentId,
    ],
  )

  for (const item of allocations) {
    const feeType = await resolveFeeType(db, item.feeTypeId)
    const incomeAccountId = feeType?.incomeAccountId ?? 'acct_other_income'
    await dbRun(
      db,
      `
        INSERT INTO ledgers (
          id,
          account_id,
          entry_date,
          direction,
          amount,
          reference_type,
          reference_id,
          narration,
          created_by_user_id,
          created_at,
          journal_group_id,
          member_id,
          payment_id,
          fee_type_id,
          due_entry_id,
          source_module
        )
        VALUES (?, ?, ?, 'credit', ?, 'payment', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'accounts')
      `,
      [
        crypto.randomUUID(),
        incomeAccountId,
        now,
        item.amount,
        paymentId,
        `${item.feeTypeNameBn} আয়`,
        actor.id,
        now,
        journalGroupId,
        memberId,
        paymentId,
        item.feeTypeId,
        item.dueEntryId ?? null,
      ],
    )
  }
}

async function createAccountingPayment(
  env: AppBindings,
  actor: SessionUser,
  input: {
    memberId?: string | null
    feeType: FeeTypeDefinition
    paymentMethod: PaymentTypeOption
    referenceNo?: string | null
    note?: string | null
    allocations: AllocationPlanItem[]
  },
  requestId?: string | null,
) {
  const now = dhakaNow()
  const paymentId = crypto.randomUUID()
  const paymentMethodRow = await dbFirst<{ id: string }>(
    env.DB,
    `SELECT id FROM payment_types WHERE payment_type_code = ? LIMIT 1`,
    [input.paymentMethod.code],
  )
  if (!paymentMethodRow) {
    throw new Error('বৈধ পেমেন্ট মেথড পাওয়া যায়নি।')
  }

  const amount = input.allocations.reduce((sum, item) => sum + item.amount, 0)
  await dbRun(
    env.DB,
    `
      INSERT INTO payments (
        id,
        member_id,
        payment_type_id,
        fee_type_id,
        account_id,
        amount,
        paid_at,
        status,
        reference_no,
        note,
        received_by_user_id,
        created_at,
        updated_at,
        updated_by_user_id,
        metadata_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      paymentId,
      input.memberId ?? null,
      paymentMethodRow.id,
      input.feeType.id,
      paymentAssetAccountId(input.paymentMethod.code),
      amount,
      now,
      optionalString(input.referenceNo),
      optionalString(input.note),
      actor.id,
      now,
      now,
      actor.id,
      JSON.stringify({
        allocationCount: input.allocations.length,
        paymentMethodCode: input.paymentMethod.code,
      }),
    ],
  )

  for (const item of input.allocations) {
    await dbRun(
      env.DB,
      `
        INSERT INTO payment_allocations (
          id,
          payment_id,
          member_id,
          fee_type_id,
          due_entry_id,
          allocation_kind,
          period_month,
          amount,
          note,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        crypto.randomUUID(),
        paymentId,
        input.memberId ?? null,
        item.feeTypeId,
        item.dueEntryId ?? null,
        item.dueEntryId ? (item.isAdvance ? 'advance' : 'due') : 'direct',
        item.month ?? null,
        item.amount,
        item.note ?? null,
        now,
      ],
    )

    if (item.dueEntryId) {
      const dueBefore = await dbFirst<{
        expectedAmount: number
        paidAmount: number
        waivedAmount: number
      }>(
        env.DB,
        `
          SELECT
            expected_amount AS expectedAmount,
            paid_amount AS paidAmount,
            waived_amount AS waivedAmount
          FROM member_fee_periods
          WHERE id = ?
          LIMIT 1
        `,
        [item.dueEntryId],
      )
      const nextPaidAmount = Number(dueBefore?.paidAmount ?? 0) + item.amount
      const outstandingAmount = Math.max(
        0,
        Number(dueBefore?.expectedAmount ?? item.expectedAmount ?? item.amount) -
          nextPaidAmount -
          Number(dueBefore?.waivedAmount ?? 0),
      )
      const nextStatus: MemberDueStatus =
        outstandingAmount <= 0 ? 'paid' : nextPaidAmount > 0 ? 'partial' : 'open'

      await dbRun(
        env.DB,
        `
          UPDATE member_fee_periods
          SET
            paid_amount = ?,
            status = ?,
            updated_at = ?,
            updated_by_user_id = ?
          WHERE id = ?
        `,
        [nextPaidAmount, nextStatus, now, actor.id, item.dueEntryId],
      )
    }
  }

  await createLedgerEntriesForPayment(
    env.DB,
    actor,
    paymentId,
    input.memberId ?? null,
    input.paymentMethod.code,
    input.allocations,
    input.feeType.nameBn,
  )

  const member = input.memberId ? await resolveMember(env.DB, input.memberId) : null
  const receiptSnapshot: ReceiptSnapshot = {
    memberId: member?.id ?? null,
    memberCode: member?.memberCode ?? null,
    memberNameBn: member?.fullNameBn ?? null,
    paymentMethodCode: input.paymentMethod.code,
    paymentMethodNameBn: input.paymentMethod.nameBn,
    feeTypeNameBn: input.feeType.nameBn,
    totalAmount: amount,
    paidAt: now,
    note: optionalString(input.note),
    collectedByNameBn: actor.nameBn,
    items: input.allocations.map((item) => ({
      labelBn: item.feeTypeNameBn,
      labelEn: item.feeTypeCode,
      amount: item.amount,
      quantity: 1,
      month: item.month ?? null,
      note: item.note ?? null,
    })),
  }

  const receipt = await createReceiptRecord(
    env,
    actor,
    paymentId,
    member?.id ?? null,
    receiptSnapshot,
  )
  const payment = (await listPayments(env.DB, { memberId: input.memberId ?? null, limit: 25 })).find(
    (item) => item.id === paymentId,
  )
  if (!payment) {
    throw new Error('পেমেন্ট রেকর্ড লোড করা যায়নি।')
  }

  await writeAudit(
    env.DB,
    actor,
    'accounts.payment.collect',
    'payment',
    paymentId,
    'A payment collection has been recorded.',
    {
      after: {
        paymentId,
        memberId: input.memberId ?? null,
        feeTypeId: input.feeType.id,
        amount,
        receiptId: receipt.id,
      },
      requestId: requestId ?? null,
    },
  )

  return {
    payment,
    receipt,
    ledgerSummary: member?.id
      ? summarizeDueLines(
          await listMemberDueLines(env.DB, member.id),
          Number(
            (await dbValue<number>(
              env.DB,
              `
                SELECT COALESCE(SUM(amount), 0)
                FROM payments
                WHERE member_id = ?
                  AND deleted_at IS NULL
                  AND status = 'completed'
              `,
              [member.id],
            )) ?? 0,
          ),
        )
      : null,
  }
}

export async function getAccountingDashboard(
  db: D1Database,
): Promise<AccountingDashboardPayload> {
  await syncAllMembersMonthlyDuePeriods(db)
  const feeTypes = await loadFeeTypes(db)
  const paymentMethods = await loadPaymentMethods(db)
  const [todayCollections, monthCollections, yearCollections, outstandingDues, advanceBalances] =
    await Promise.all([
      dbValue<number>(
        db,
        `
          SELECT COALESCE(SUM(amount), 0)
          FROM payments
          WHERE deleted_at IS NULL
            AND status = 'completed'
            AND paid_at >= ?
            AND paid_at <= ?
        `,
        [startOfDhakaDayIso(currentDateToken()), endOfDhakaDayIso(currentDateToken())],
      ),
      dbValue<number>(
        db,
        `
          SELECT COALESCE(SUM(amount), 0)
          FROM payments
          WHERE deleted_at IS NULL
            AND status = 'completed'
            AND paid_at >= ?
            AND paid_at <= ?
        `,
        [
          startOfDhakaDayIso(`${currentMonthToken()}-01`),
          endOfDhakaDayIso(monthEndDateToken(currentMonthToken())),
        ],
      ),
      dbValue<number>(
        db,
        `
          SELECT COALESCE(SUM(amount), 0)
          FROM payments
          WHERE deleted_at IS NULL
            AND status = 'completed'
            AND paid_at >= ?
            AND paid_at <= ?
        `,
        [
          startOfDhakaDayIso(`${currentDateToken().slice(0, 4)}-01-01`),
          endOfDhakaDayIso(`${currentDateToken().slice(0, 4)}-12-31`),
        ],
      ),
      dbValue<number>(
        db,
        `
          SELECT COALESCE(SUM(expected_amount - paid_amount - waived_amount), 0)
          FROM member_fee_periods
          WHERE deleted_at IS NULL
            AND period_month <= ?
            AND status IN ('open', 'partial')
        `,
        [currentMonthToken()],
      ),
      dbValue<number>(
        db,
        `
          SELECT COALESCE(SUM(paid_amount), 0)
          FROM member_fee_periods
          WHERE deleted_at IS NULL
            AND period_month > ?
            AND paid_amount > 0
        `,
        [currentMonthToken()],
      ),
    ])

  const recentPayments = await listPayments(db, { limit: 12 })

  return {
    stats: {
      todayCollections: Number(todayCollections ?? 0),
      monthCollections: Number(monthCollections ?? 0),
      yearCollections: Number(yearCollections ?? 0),
      outstandingDues: Number(outstandingDues ?? 0),
      advanceBalances: Number(advanceBalances ?? 0),
      openReceipts: recentPayments.filter((item) => Boolean(item.receiptId)).length,
    },
    feeTypes,
    paymentMethods,
    recentPayments,
    memberLookupHints: [],
  }
}

export async function searchMembersForAccounts(
  db: D1Database,
  query: string,
): Promise<LookupOption[]> {
  const trimmed = sanitizeString(query)
  if (trimmed.length < 2) {
    return []
  }

  const likeValue = `%${trimmed}%`
  const rows = await dbAll<{
    id: string
    label: string
    sublabel: string
  }>(
    db,
    `
      SELECT
        id,
        full_name_bn AS label,
        member_no || ' • ' || phone AS sublabel
      FROM members
      WHERE deleted_at IS NULL
        AND (
          full_name_bn LIKE ?
          OR COALESCE(full_name_en, '') LIKE ?
          OR member_no LIKE ?
          OR phone LIKE ?
        )
      ORDER BY full_name_bn ASC
      LIMIT 10
    `,
    [likeValue, likeValue, likeValue, likeValue],
  )

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    sublabel: row.sublabel,
  }))
}

export async function getMemberLedger(
  db: D1Database,
  actor: SessionUser | null,
  memberId: string,
  requestId?: string | null,
): Promise<AccountingMemberLedgerPayload | null> {
  const member = await syncMemberMonthlyDuePeriods(db, memberId, actor, requestId)
  if (!member) {
    return null
  }

  const [feeTypes, dueLines, payments, receipts, ledgerEntries, totalPaid] = await Promise.all([
    loadFeeTypes(db),
    listMemberDueLines(db, member.id),
    listPayments(db, { memberId: member.id, limit: 50 }),
    listReceiptRows(db, { memberId: member.id, limit: 20 }),
    listMemberLedgerEntries(db, member.id),
    dbValue<number>(
      db,
      `
        SELECT COALESCE(SUM(amount), 0)
        FROM payments
        WHERE member_id = ?
          AND deleted_at IS NULL
          AND status = 'completed'
      `,
      [member.id],
    ),
  ])

  return {
    member,
    summary: summarizeDueLines(dueLines, Number(totalPaid ?? 0)),
    dueLines,
    dueMonthOptions: buildDueMonthOptions(member, feeTypes, dueLines),
    payments,
    receipts,
    ledgerEntries,
  }
}

export async function createFeeType(
  db: D1Database,
  actor: SessionUser,
  payload: {
    feeCode: string
    nameBn: string
    nameEn: string
    descriptionBn?: string
    descriptionEn?: string
    collectionMode: FeeTypeDefinition['collectionMode']
    defaultAmount: number
    allowCustomAmount: boolean
    allowMultiMonth: boolean
    incomeAccountId?: string
    active: boolean
    sortOrder: number
  },
  requestId?: string | null,
) {
  const id = crypto.randomUUID()
  const now = dhakaNow()
  await dbRun(
    db,
    `
      INSERT INTO fee_types (
        id,
        fee_code,
        name_bn,
        name_en,
        description_bn,
        description_en,
        collection_mode,
        default_amount,
        allow_custom_amount,
        allow_multi_month,
        income_account_id,
        active,
        is_system,
        sort_order,
        created_by_user_id,
        updated_by_user_id,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
    `,
    [
      id,
      payload.feeCode,
      payload.nameBn,
      payload.nameEn,
      optionalString(payload.descriptionBn),
      optionalString(payload.descriptionEn),
      payload.collectionMode,
      payload.defaultAmount,
      boolToInt(payload.allowCustomAmount),
      boolToInt(payload.allowMultiMonth),
      optionalString(payload.incomeAccountId),
      boolToInt(payload.active),
      payload.sortOrder,
      actor.id,
      actor.id,
      now,
      now,
    ],
  )

  const feeType = await resolveFeeType(db, id)
  if (!feeType) {
    throw new Error('ফি টাইপ তৈরি করা যায়নি।')
  }

  await writeAudit(
    db,
    actor,
    'accounts.fee_type.create',
    'fee_type',
    id,
    'A fee type has been created.',
    {
      after: feeType,
      requestId: requestId ?? null,
    },
  )

  return feeType
}

export async function updateFeeType(
  db: D1Database,
  actor: SessionUser,
  feeTypeId: string,
  payload: {
    feeCode: string
    nameBn: string
    nameEn: string
    descriptionBn?: string
    descriptionEn?: string
    collectionMode: FeeTypeDefinition['collectionMode']
    defaultAmount: number
    allowCustomAmount: boolean
    allowMultiMonth: boolean
    incomeAccountId?: string
    active: boolean
    sortOrder: number
  },
  requestId?: string | null,
) {
  const before = await resolveFeeType(db, feeTypeId)
  if (!before) {
    throw new Error('ফি টাইপ পাওয়া যায়নি।')
  }

  await dbRun(
    db,
    `
      UPDATE fee_types
      SET
        fee_code = ?,
        name_bn = ?,
        name_en = ?,
        description_bn = ?,
        description_en = ?,
        collection_mode = ?,
        default_amount = ?,
        allow_custom_amount = ?,
        allow_multi_month = ?,
        income_account_id = ?,
        active = ?,
        sort_order = ?,
        updated_by_user_id = ?,
        updated_at = ?
      WHERE id = ?
        AND deleted_at IS NULL
    `,
    [
      payload.feeCode,
      payload.nameBn,
      payload.nameEn,
      optionalString(payload.descriptionBn),
      optionalString(payload.descriptionEn),
      payload.collectionMode,
      payload.defaultAmount,
      boolToInt(payload.allowCustomAmount),
      boolToInt(payload.allowMultiMonth),
      optionalString(payload.incomeAccountId),
      boolToInt(payload.active),
      payload.sortOrder,
      actor.id,
      dhakaNow(),
      feeTypeId,
    ],
  )

  const after = await resolveFeeType(db, feeTypeId)
  if (!after) {
    throw new Error('ফি টাইপ আপডেট করা যায়নি।')
  }

  await writeAudit(
    db,
    actor,
    'accounts.fee_type.update',
    'fee_type',
    feeTypeId,
    'A fee type has been updated.',
    {
      before,
      after,
      requestId: requestId ?? null,
    },
  )

  return after
}

export async function archiveFeeType(
  db: D1Database,
  actor: SessionUser,
  feeTypeId: string,
  requestId?: string | null,
) {
  const before = await resolveFeeType(db, feeTypeId)
  if (!before) {
    throw new Error('ফি টাইপ পাওয়া যায়নি।')
  }
  if (before.isSystem) {
    throw new Error('সিস্টেম ফি টাইপ আর্কাইভ করা যাবে না।')
  }

  await dbRun(
    db,
    `
      UPDATE fee_types
      SET
        active = 0,
        deleted_at = ?,
        updated_by_user_id = ?,
        updated_at = ?
      WHERE id = ?
        AND deleted_at IS NULL
    `,
    [dhakaNow(), actor.id, dhakaNow(), feeTypeId],
  )

  await writeAudit(
    db,
    actor,
    'accounts.fee_type.archive',
    'fee_type',
    feeTypeId,
    'A fee type has been archived.',
    {
      before,
      after: { deletedAt: dhakaNow() },
      requestId: requestId ?? null,
    },
  )
}

export async function listArchivedFeeTypes(db: D1Database): Promise<FeeTypeDefinition[]> {
  const rows = await dbAll<FeeTypeRow>(
    db,
    `
      SELECT
        fee_types.id AS id,
        fee_types.fee_code AS feeCode,
        fee_types.base_code AS baseCode,
        fee_types.name_bn AS nameBn,
        fee_types.name_en AS nameEn,
        fee_types.description_bn AS descriptionBn,
        fee_types.description_en AS descriptionEn,
        fee_types.collection_mode AS collectionMode,
        fee_types.default_amount AS defaultAmount,
        fee_types.allow_custom_amount AS allowCustomAmount,
        fee_types.allow_multi_month AS allowMultiMonth,
        fee_types.income_account_id AS incomeAccountId,
        accounts.account_code AS incomeAccountCode,
        accounts.account_name_bn AS incomeAccountNameBn,
        fee_types.active AS active,
        fee_types.is_system AS isSystem,
        fee_types.sort_order AS sortOrder,
        fee_types.deleted_at AS deletedAt,
        fee_types.created_at AS createdAt,
        fee_types.updated_at AS updatedAt
      FROM fee_types
      LEFT JOIN accounts ON accounts.id = fee_types.income_account_id
      WHERE fee_types.deleted_at IS NOT NULL
      ORDER BY fee_types.deleted_at DESC, fee_types.name_bn ASC
    `,
  )

  return rows.map(mapFeeType)
}

export async function restoreFeeType(
  db: D1Database,
  actor: SessionUser,
  feeTypeId: string,
  requestId?: string | null,
): Promise<FeeTypeDefinition> {
  const before = await resolveFeeType(db, feeTypeId, true)
  if (!before || !before.deletedAt) {
    throw new Error('আর্কাইভ করা ফি টাইপ পাওয়া যায়নি।')
  }
  if (before.isSystem) {
    throw new Error('সিস্টেম ফি টাইপ পুনরুদ্ধারের প্রয়োজন নেই।')
  }

  await dbRun(
    db,
    `
      UPDATE fee_types
      SET
        active = 1,
        deleted_at = NULL,
        updated_by_user_id = ?,
        updated_at = ?
      WHERE id = ?
        AND deleted_at IS NOT NULL
    `,
    [actor.id, dhakaNow(), feeTypeId],
  )

  const after = await resolveFeeType(db, feeTypeId)
  if (!after) {
    throw new Error('ফি টাইপ পুনরুদ্ধার করা যায়নি।')
  }

  await writeAudit(
    db,
    actor,
    'accounts.fee_type.restore',
    'fee_type',
    feeTypeId,
    'An archived fee type has been restored.',
    {
      before,
      after,
      requestId: requestId ?? null,
    },
  )

  return after
}

export async function collectAccountingPayment(
  env: AppBindings,
  actor: SessionUser,
  payload: {
    memberId?: string
    feeTypeId: string
    months: string[]
    amount: number
    paymentMethodCode: string
    referenceNo?: string
    note?: string
  },
  requestId?: string | null,
): Promise<AccountingCollectionResult> {
  const feeType = await resolveFeeType(env.DB, payload.feeTypeId)
  if (!feeType || !feeType.active) {
    throw new Error('সক্রিয় ফি টাইপ পাওয়া যায়নি।')
  }
  const paymentMethod = await resolvePaymentMethod(env.DB, payload.paymentMethodCode)
  if (!paymentMethod) {
    throw new Error('পেমেন্ট মেথড পাওয়া যায়নি।')
  }

  if (feeType.collectionMode === 'monthly' && !payload.memberId) {
    throw new Error('মাসিক চাঁদা সংগ্রহের জন্য সদস্য নির্বাচন করুন।')
  }

  if (feeType.collectionMode === 'monthly' && payload.months.length === 0) {
    throw new Error('অন্তত একটি মাস নির্বাচন করুন।')
  }

  if (payload.months.length > 1 && !feeType.allowMultiMonth) {
    throw new Error('এই ফি টাইপে একাধিক মাস একসাথে নেওয়া যাবে না।')
  }

  if (!feeType.allowCustomAmount) {
    const expectedAmount =
      feeType.collectionMode === 'monthly'
        ? feeType.defaultAmount * payload.months.length
        : feeType.defaultAmount
    if (Math.abs(expectedAmount - payload.amount) > 0.01) {
      throw new Error('এই ফি টাইপে নির্ধারিত টাকার বাইরে সংগ্রহ করা যাবে না।')
    }
  }

  let allocations: AllocationPlanItem[] = []
  if (feeType.collectionMode === 'monthly') {
    const member = await syncMemberMonthlyDuePeriods(
      env.DB,
      payload.memberId!,
      actor,
      requestId,
    )
    await ensureDueRowsForMonths(env.DB, member.id, feeType, payload.months, actor)
    const monthPlaceholders = payload.months.map(() => '?').join(', ')
    const rows = await dbAll<DueRow>(
      env.DB,
      `
        SELECT
          member_fee_periods.id AS id,
          member_fee_periods.member_id AS memberId,
          member_fee_periods.fee_type_id AS feeTypeId,
          fee_types.fee_code AS feeTypeCode,
          fee_types.name_bn AS feeTypeNameBn,
          member_fee_periods.period_month AS month,
          member_fee_periods.due_date AS dueDate,
          member_fee_periods.expected_amount AS expectedAmount,
          member_fee_periods.paid_amount AS paidAmount,
          member_fee_periods.waived_amount AS waivedAmount,
          member_fee_periods.status AS status,
          member_fee_periods.note AS note,
          member_fee_periods.updated_at AS updatedAt
        FROM member_fee_periods
        INNER JOIN fee_types ON fee_types.id = member_fee_periods.fee_type_id
        WHERE member_fee_periods.member_id = ?
          AND member_fee_periods.fee_type_id = ?
          AND member_fee_periods.period_month IN (${monthPlaceholders})
          AND member_fee_periods.deleted_at IS NULL
        ORDER BY member_fee_periods.period_month ASC
      `,
      [member.id, feeType.id, ...payload.months.sort(compareMonthTokens)],
    )

    let remainingAmount = payload.amount
    const nowMonth = currentMonthToken()
    allocations = rows
      .map((row) => rowToDueLine(row))
      .filter((line) => line.outstandingAmount > 0)
      .map((line) => {
        const allocationAmount = Math.min(line.outstandingAmount, remainingAmount)
        remainingAmount -= allocationAmount
        return {
          dueEntryId: line.id,
          feeTypeId: line.feeTypeId,
          feeTypeCode: line.feeTypeCode,
          feeTypeNameBn: line.feeTypeNameBn,
          month: line.month,
          amount: allocationAmount,
          expectedAmount: line.expectedAmount,
          isAdvance: compareMonthTokens(line.month, nowMonth) > 0,
          note: `মাস: ${line.month}`,
        }
      })
      .filter((item) => item.amount > 0)

    if (remainingAmount > 0.01) {
      throw new Error('নির্বাচিত মাসগুলোর বকেয়ার চেয়ে বেশি টাকা দেওয়া হয়েছে।')
    }
    if (allocations.length === 0) {
      throw new Error('নির্বাচিত মাসগুলোর জন্য নতুন কোনও বকেয়া পাওয়া যায়নি।')
    }
  } else {
    allocations = [
      {
        feeTypeId: feeType.id,
        feeTypeCode: feeType.feeCode,
        feeTypeNameBn: feeType.nameBn,
        amount: payload.amount,
        isAdvance: false,
        note: optionalString(payload.note),
      },
    ]
  }

  return createAccountingPayment(
    env,
    actor,
    {
      memberId: payload.memberId ?? null,
      feeType,
      paymentMethod,
      referenceNo: payload.referenceNo,
      note: payload.note,
      allocations,
    },
    requestId,
  )
}

export async function reprintReceipt(
  env: AppBindings,
  actor: SessionUser,
  receiptId: string,
  requestId?: string | null,
) {
  const receipt = await getReceiptDetail(env.DB, receiptId)
  if (!receipt) {
    throw new Error('রিসিট পাওয়া যায়নি।')
  }

  let fileKey = receipt.fileKey
  if (!fileKey) {
    fileKey = await persistReceiptHtml(env, receipt)
    await dbRun(
      env.DB,
      `UPDATE receipts SET file_r2_key = ?, updated_at = ? WHERE id = ?`,
      [fileKey, dhakaNow(), receiptId],
    )
  }

  await dbRun(
    env.DB,
    `
      UPDATE receipts
      SET
        reprint_count = COALESCE(reprint_count, 0) + 1,
        last_reprinted_at = ?,
        last_reprinted_by_user_id = ?,
        updated_at = ?
      WHERE id = ?
    `,
    [dhakaNow(), actor.id, dhakaNow(), receiptId],
  )

  await writeAudit(
    env.DB,
    actor,
    'accounts.receipt.reprint',
    'receipt',
    receiptId,
    'A historical receipt has been reprinted.',
    {
      after: {
        receiptId,
        fileKey,
      },
      requestId: requestId ?? null,
    },
  )

  const refreshed = await getReceiptDetail(env.DB, receiptId)
  if (!refreshed) {
    throw new Error('রিসিট পুনরায় লোড করা যায়নি।')
  }

  return refreshed
}

export async function getAccountingReport(
  db: D1Database,
  filters: AccountingReportFilters,
): Promise<AccountingReportPayload> {
  await syncAllMembersMonthlyDuePeriods(db)
  const startIso = startOfDhakaDayIso(filters.startDate)
  const endIso = endOfDhakaDayIso(filters.endDate)
  const payments = await dbAll<ReportPaymentRow>(
    db,
    `
      SELECT
        payments.id AS paymentId,
        payments.member_id AS memberId,
        members.member_no AS memberCode,
        members.full_name_bn AS memberNameBn,
        payments.fee_type_id AS feeTypeId,
        COALESCE(fee_types.fee_code, CASE WHEN payments.fine_id IS NOT NULL THEN 'fine' ELSE NULL END) AS feeTypeCode,
        COALESCE(fee_types.name_bn, CASE WHEN payments.fine_id IS NOT NULL THEN 'জরিমানা' ELSE 'অন্যান্য' END) AS feeTypeNameBn,
        payment_types.payment_type_code AS paymentMethodCode,
        payment_types.name_bn AS paymentMethodNameBn,
        payments.amount AS amount,
        payments.paid_at AS paidAt,
        payments.status AS status,
        receipts.id AS receiptId,
        receipts.receipt_no AS receiptNo,
        payments.reference_no AS referenceNo,
        payments.note AS note,
        payments.voided_at AS voidedAt,
        (
          SELECT json_group_array(
            json_object(
              'feeTypeId', payment_allocations.fee_type_id,
              'dueEntryId', payment_allocations.due_entry_id,
              'kind', payment_allocations.allocation_kind,
              'periodMonth', payment_allocations.period_month,
              'amount', payment_allocations.amount
            )
          )
          FROM payment_allocations
          WHERE payment_allocations.payment_id = payments.id
        ) AS allocationJson
      FROM payments
      INNER JOIN payment_types ON payment_types.id = payments.payment_type_id
      LEFT JOIN fee_types ON fee_types.id = payments.fee_type_id
      LEFT JOIN members ON members.id = payments.member_id
      LEFT JOIN receipts ON receipts.payment_id = payments.id
      WHERE payments.deleted_at IS NULL
        AND payments.paid_at >= ?
        AND payments.paid_at <= ?
        AND (? = '' OR payments.member_id = ?)
        AND (? = '' OR payment_types.payment_type_code = ?)
        AND (? = '' OR payments.fee_type_id = ?)
      ORDER BY payments.paid_at DESC, payments.created_at DESC
    `,
    [
      startIso,
      endIso,
      filters.memberId ?? '',
      filters.memberId ?? '',
      filters.paymentMethodCode ?? '',
      filters.paymentMethodCode ?? '',
      filters.feeTypeId ?? '',
      filters.feeTypeId ?? '',
    ],
  )

  const mappedPayments = payments.map<AccountingPaymentRecord>((row) =>
    mapPayment({
      id: row.paymentId,
      memberId: row.memberId,
      memberCode: row.memberCode,
      memberNameBn: row.memberNameBn,
      feeTypeCode: row.feeTypeCode,
      feeTypeNameBn: row.feeTypeNameBn,
      paymentMethodCode: row.paymentMethodCode,
      paymentMethodNameBn: row.paymentMethodNameBn,
      amount: row.amount,
      paidAt: row.paidAt,
      status: row.status,
      receiptId: row.receiptId,
      receiptNo: row.receiptNo,
      referenceNo: row.referenceNo,
      note: row.note,
      voidedAt: row.voidedAt,
      deletedAt: null,
    }),
  )
  const completedPayments = mappedPayments.filter(
    (item) => !item.isVoided && item.status === 'completed',
  )

  const feeMap = new Map<string, { labelBn: string; totalAmount: number; transactionCount: number }>()
  const paymentMethodMap = new Map<string, { labelBn: string; totalAmount: number; transactionCount: number }>()
  const dayMap = new Map<string, number>()

  for (const payment of completedPayments) {
    const feeKey = payment.feeTypeCode ?? 'other'
    const existingFee = feeMap.get(feeKey) ?? {
      labelBn: payment.feeTypeNameBn,
      totalAmount: 0,
      transactionCount: 0,
    }
    existingFee.totalAmount += payment.amount
    existingFee.transactionCount += 1
    feeMap.set(feeKey, existingFee)

    const paymentMethod = paymentMethodMap.get(payment.paymentMethodCode) ?? {
      labelBn: payment.paymentMethodNameBn,
      totalAmount: 0,
      transactionCount: 0,
    }
    paymentMethod.totalAmount += payment.amount
    paymentMethod.transactionCount += 1
    paymentMethodMap.set(payment.paymentMethodCode, paymentMethod)

    const day = payment.paidAt.slice(0, 10)
    dayMap.set(day, Number(dayMap.get(day) ?? 0) + payment.amount)
  }

  const [memberBalances, cashLedger, incomeLedger, outstandingDues, advanceBalances] =
    await Promise.all([
      dbAll<BalanceRow>(
        db,
        `
          SELECT
            members.id AS memberId,
            members.member_no AS memberCode,
            members.full_name_bn AS memberNameBn,
            COALESCE(SUM(
              CASE
                WHEN member_fee_periods.period_month <= ? THEN member_fee_periods.expected_amount - member_fee_periods.paid_amount - member_fee_periods.waived_amount
                ELSE 0
              END
            ), 0) AS outstandingAmount,
            COALESCE(SUM(
              CASE
                WHEN member_fee_periods.period_month > ? THEN member_fee_periods.paid_amount
                ELSE 0
              END
            ), 0) AS advanceAmount
          FROM members
          LEFT JOIN member_fee_periods ON member_fee_periods.member_id = members.id AND member_fee_periods.deleted_at IS NULL
          WHERE members.deleted_at IS NULL
          GROUP BY members.id, members.member_no, members.full_name_bn
          HAVING outstandingAmount > 0 OR advanceAmount > 0
          ORDER BY outstandingAmount DESC, advanceAmount DESC
          LIMIT 20
        `,
        [currentMonthToken(), currentMonthToken()],
      ),
      dbAll<AccountLedgerAggregateRow>(
        db,
        `
          SELECT
            accounts.account_code AS accountCode,
            accounts.account_name_bn AS accountNameBn,
            SUM(CASE WHEN ledgers.direction = 'debit' THEN ledgers.amount ELSE 0 END) AS debitTotal,
            SUM(CASE WHEN ledgers.direction = 'credit' THEN ledgers.amount ELSE 0 END) AS creditTotal
          FROM ledgers
          INNER JOIN accounts ON accounts.id = ledgers.account_id
          WHERE ledgers.entry_date >= ?
            AND ledgers.entry_date <= ?
            AND accounts.account_type = 'asset'
          GROUP BY accounts.id, accounts.account_code, accounts.account_name_bn
          ORDER BY accounts.account_code ASC
        `,
        [startIso, endIso],
      ),
      dbAll<AccountLedgerAggregateRow>(
        db,
        `
          SELECT
            accounts.account_code AS accountCode,
            accounts.account_name_bn AS accountNameBn,
            SUM(CASE WHEN ledgers.direction = 'debit' THEN ledgers.amount ELSE 0 END) AS debitTotal,
            SUM(CASE WHEN ledgers.direction = 'credit' THEN ledgers.amount ELSE 0 END) AS creditTotal
          FROM ledgers
          INNER JOIN accounts ON accounts.id = ledgers.account_id
          WHERE ledgers.entry_date >= ?
            AND ledgers.entry_date <= ?
            AND accounts.account_type = 'income'
          GROUP BY accounts.id, accounts.account_code, accounts.account_name_bn
          ORDER BY accounts.account_code ASC
        `,
        [startIso, endIso],
      ),
      dbValue<number>(
        db,
        `
          SELECT COALESCE(SUM(expected_amount - paid_amount - waived_amount), 0)
          FROM member_fee_periods
          WHERE deleted_at IS NULL
            AND period_month <= ?
            AND status IN ('open', 'partial')
        `,
        [currentMonthToken()],
      ),
      dbValue<number>(
        db,
        `
          SELECT COALESCE(SUM(paid_amount), 0)
          FROM member_fee_periods
          WHERE deleted_at IS NULL
            AND period_month > ?
            AND paid_amount > 0
        `,
        [currentMonthToken()],
      ),
    ])

  return {
    filters,
    summary: {
      totalCollected: completedPayments.reduce((sum, payment) => sum + payment.amount, 0),
      transactionCount: completedPayments.length,
      outstandingDues: Number(outstandingDues ?? 0),
      advanceBalances: Number(advanceBalances ?? 0),
    },
    feeBreakdown: [...feeMap.entries()].map(([key, value]) => ({
      key,
      labelBn: value.labelBn,
      totalAmount: value.totalAmount,
      transactionCount: value.transactionCount,
    })),
    paymentMethodBreakdown: [...paymentMethodMap.entries()].map(([key, value]) => ({
      key,
      labelBn: value.labelBn,
      totalAmount: value.totalAmount,
      transactionCount: value.transactionCount,
    })),
    dailyBreakdown: [...dayMap.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([day, totalAmount]) => ({ day, totalAmount })),
    memberBalances: memberBalances.map((row) => ({
      memberId: row.memberId,
      memberCode: row.memberCode,
      memberNameBn: row.memberNameBn,
      outstandingAmount: Number(row.outstandingAmount ?? 0),
      advanceAmount: Number(row.advanceAmount ?? 0),
    })),
    cashLedger: cashLedger.map((row) => ({
      accountCode: row.accountCode,
      accountNameBn: row.accountNameBn,
      debitTotal: Number(row.debitTotal ?? 0),
      creditTotal: Number(row.creditTotal ?? 0),
    })),
    incomeLedger: incomeLedger.map((row) => ({
      accountCode: row.accountCode,
      accountNameBn: row.accountNameBn,
      debitTotal: Number(row.debitTotal ?? 0),
      creditTotal: Number(row.creditTotal ?? 0),
    })),
    payments: mappedPayments,
    generatedAt: dhakaNow(),
  }
}

function buildReportHtml(libraryName: string, report: AccountingReportPayload) {
  const paymentRows = report.payments
    .map(
      (payment) => `
        <tr>
          <td>${escapeHtml(payment.paidAt.slice(0, 10))}</td>
          <td>${escapeHtml(payment.memberNameBn ?? 'সাধারণ')}</td>
          <td>${escapeHtml(payment.feeTypeNameBn)}</td>
          <td>${escapeHtml(payment.paymentMethodNameBn)}</td>
          <td>${payment.amount.toFixed(2)}</td>
          <td>${escapeHtml(payment.receiptNo ?? '-')}</td>
        </tr>
      `,
    )
    .join('')

  return `
    <!doctype html>
    <html lang="bn">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>হিসাব রিপোর্ট</title>
        <style>
          :root { --ink: #18212f; --muted: #667085; --line: rgba(24,33,47,0.12); --accent: #0d3b66; }
          * { box-sizing: border-box; }
          body { margin: 0; font-family: "Hind Siliguri", sans-serif; background: #f6efe2; color: var(--ink); }
          .toolbar { position: sticky; top: 0; display: flex; justify-content: space-between; gap: 1rem; padding: 1rem 1.25rem; background: rgba(255,255,255,0.96); border-bottom: 1px solid var(--line); }
          .toolbar button { border: none; border-radius: 999px; padding: 0.75rem 1rem; background: var(--accent); color: #fff; cursor: pointer; font-weight: 700; }
          .sheet { width: min(100%, 210mm); margin: 1rem auto 2rem; padding: 14mm; background: #fff; border-radius: 1.4rem; box-shadow: 0 30px 60px rgba(13, 59, 102, 0.12); }
          .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.9rem; margin: 1rem 0 1.25rem; }
          .summary-card { padding: 0.9rem 1rem; border: 1px solid var(--line); border-radius: 1rem; background: #faf9f6; }
          .summary-card span { display: block; color: var(--muted); font-size: 0.84rem; margin-bottom: 0.2rem; }
          table { width: 100%; border-collapse: collapse; }
          th, td { text-align: left; padding: 0.8rem 0.7rem; border-bottom: 1px solid var(--line); vertical-align: top; }
          th { color: var(--muted); font-size: 0.88rem; }
          @media print {
            body { background: #fff; }
            .toolbar { display: none; }
            .sheet { box-shadow: none; margin: 0 auto; border-radius: 0; }
          }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <div>
            <strong>${escapeHtml(libraryName)}</strong>
            <p style="margin:0;color:#667085">হিসাব রিপোর্ট</p>
          </div>
          <button type="button" onclick="window.print()">প্রিন্ট করুন</button>
        </div>
        <main class="sheet">
          <h1>${escapeHtml(libraryName)} হিসাব রিপোর্ট</h1>
          <p>সময়সীমা: ${escapeHtml(report.filters.startDate)} থেকে ${escapeHtml(report.filters.endDate)}</p>
          <section class="summary-grid">
            <article class="summary-card"><span>মোট আদায়</span><strong>${report.summary.totalCollected.toFixed(2)}</strong></article>
            <article class="summary-card"><span>ট্রানজ্যাকশন</span><strong>${report.summary.transactionCount}</strong></article>
            <article class="summary-card"><span>বকেয়া</span><strong>${report.summary.outstandingDues.toFixed(2)}</strong></article>
            <article class="summary-card"><span>অ্যাডভান্স</span><strong>${report.summary.advanceBalances.toFixed(2)}</strong></article>
          </section>
          <h2>পেমেন্ট তালিকা</h2>
          <table>
            <thead>
              <tr>
                <th>তারিখ</th>
                <th>সদস্য</th>
                <th>ফি</th>
                <th>মেথড</th>
                <th>টাকা</th>
                <th>রিসিট</th>
              </tr>
            </thead>
            <tbody>${paymentRows}</tbody>
          </table>
        </main>
      </body>
    </html>
  `
}

function buildReportCsv(report: AccountingReportPayload) {
  const rows = [
    ['Report', 'Accounting Report'],
    ['Preset', report.filters.preset],
    ['Start Date', report.filters.startDate],
    ['End Date', report.filters.endDate],
    ['Total Collected', report.summary.totalCollected.toFixed(2)],
    ['Transactions', String(report.summary.transactionCount)],
    ['Outstanding Dues', report.summary.outstandingDues.toFixed(2)],
    ['Advance Balances', report.summary.advanceBalances.toFixed(2)],
    [],
    ['Paid Date', 'Member', 'Member Code', 'Fee Type', 'Method', 'Amount', 'Receipt', 'Reference'],
    ...report.payments.map((payment) => [
      payment.paidAt,
      payment.memberNameBn ?? '',
      payment.memberCode ?? '',
      payment.feeTypeNameBn,
      payment.paymentMethodNameBn,
      payment.amount.toFixed(2),
      payment.receiptNo ?? '',
      payment.referenceNo ?? '',
    ]),
  ]

  return rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n')
}

async function persistReportFile(
  env: AppBindings,
  actor: SessionUser,
  report: AccountingReportPayload,
  format: 'csv' | 'html',
  requestId?: string | null,
): Promise<AccountingExportResult> {
  const shell = await getShellSettings(env.DB, env)
  const exportId = crypto.randomUUID()
  const fileName =
    format === 'csv'
      ? `accounting-report-${report.filters.startDate}-${report.filters.endDate}.csv`
      : `accounting-report-${report.filters.startDate}-${report.filters.endDate}.html`
  const outputKey = buildR2Key('reports', fileName)
  const content =
    format === 'csv'
      ? buildReportCsv(report)
      : buildReportHtml(shell.profile.siteNameBn || env.APP_NAME_BN, report)
  const file = new File([content], fileName, {
    type:
      format === 'csv'
        ? 'text/csv; charset=utf-8'
        : 'text/html; charset=utf-8',
  })

  await putFile(env.MEDIA_BUCKET, outputKey, file, {
    reportType: 'accounting',
    format,
    requestedBy: actor.id,
  })

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
      VALUES (?, 'accounting_report', ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?)
    `,
    [
      exportId,
      format,
      JSON.stringify(['payments', 'member_fee_periods', 'ledgers']),
      actor.id,
      outputKey,
      'Accounting report export generated',
      dhakaNow(),
      dhakaNow(),
      JSON.stringify(report.filters),
      fileName,
    ],
  )

  await writeAudit(
    env.DB,
    actor,
    'accounts.report.export',
    'export',
    exportId,
    'An accounting report export has been generated.',
    {
      after: {
        format,
        outputKey,
        filters: report.filters,
      },
      requestId: requestId ?? null,
    },
  )

  return {
    exportId,
    fileName,
    outputKey,
    outputUrl: `/files/${encodeURIComponent(outputKey)}`,
    format,
  }
}

export async function exportAccountingReport(
  env: AppBindings,
  actor: SessionUser,
  filters: AccountingReportFilters,
  format: 'csv' | 'html',
  requestId?: string | null,
) {
  const report = await getAccountingReport(env.DB, filters)
  return persistReportFile(env, actor, report, format, requestId)
}

export async function voidAccountingPayment(
  env: AppBindings,
  actor: SessionUser,
  paymentId: string,
  reason: string,
  requestId?: string | null,
) {
  const before = await dbFirst<{
    id: string
    memberId: string | null
    amount: number
    status: AccountingPaymentRecord['status']
    voidedAt: string | null
    deletedAt: string | null
    paymentMethodCode: string
    feeTypeId: string | null
  }>(
    env.DB,
    `
      SELECT
        payments.id AS id,
        payments.member_id AS memberId,
        payments.amount AS amount,
        payments.status AS status,
        payments.voided_at AS voidedAt,
        payments.deleted_at AS deletedAt,
        payment_types.payment_type_code AS paymentMethodCode,
        payments.fee_type_id AS feeTypeId
      FROM payments
      INNER JOIN payment_types ON payment_types.id = payments.payment_type_id
      WHERE payments.id = ?
      LIMIT 1
    `,
    [paymentId],
  )
  if (!before) {
    throw new Error('পেমেন্ট পাওয়া যায়নি।')
  }
  if (before.voidedAt || before.deletedAt || before.status === 'refunded') {
    throw new Error('এই পেমেন্ট আগেই বাতিল করা হয়েছে।')
  }

  const allocations = await dbAll<{
    id: string
    dueEntryId: string | null
    feeTypeId: string | null
    amount: number
  }>(
    env.DB,
    `
      SELECT
        id,
        due_entry_id AS dueEntryId,
        fee_type_id AS feeTypeId,
        amount
      FROM payment_allocations
      WHERE payment_id = ?
    `,
    [paymentId],
  )

  for (const allocation of allocations) {
    if (!allocation.dueEntryId) {
      continue
    }

    const due = await dbFirst<{
      expectedAmount: number
      paidAmount: number
      waivedAmount: number
    }>(
      env.DB,
      `
        SELECT
          expected_amount AS expectedAmount,
          paid_amount AS paidAmount,
          waived_amount AS waivedAmount
        FROM member_fee_periods
        WHERE id = ?
        LIMIT 1
      `,
      [allocation.dueEntryId],
    )

    const nextPaidAmount = Math.max(
      0,
      Number(due?.paidAmount ?? 0) - Number(allocation.amount ?? 0),
    )
    const outstandingAmount = Math.max(
      0,
      Number(due?.expectedAmount ?? 0) -
        nextPaidAmount -
        Number(due?.waivedAmount ?? 0),
    )
    const nextStatus: MemberDueStatus =
      outstandingAmount <= 0 ? 'paid' : nextPaidAmount > 0 ? 'partial' : 'open'

    await dbRun(
      env.DB,
      `
        UPDATE member_fee_periods
        SET
          paid_amount = ?,
          status = ?,
          updated_at = ?,
          updated_by_user_id = ?
        WHERE id = ?
      `,
      [nextPaidAmount, nextStatus, dhakaNow(), actor.id, allocation.dueEntryId],
    )
  }

  const fineLink = await dbFirst<{ fineId: string | null }>(
    env.DB,
    `SELECT fine_id AS fineId FROM payments WHERE id = ? LIMIT 1`,
    [paymentId],
  )
  if (fineLink?.fineId) {
    const fine = await dbFirst<{
      assessedAmount: number
      paidAmount: number
      waivedAmount: number
    }>(
      env.DB,
      `
        SELECT
          assessed_amount AS assessedAmount,
          paid_amount AS paidAmount,
          waived_amount AS waivedAmount
        FROM fines
        WHERE id = ?
        LIMIT 1
      `,
      [fineLink.fineId],
    )
    if (fine) {
      const nextPaidAmount = Math.max(
        0,
        Number(fine.paidAmount ?? 0) - Number(before.amount ?? 0),
      )
      const outstandingAmount = Math.max(
        0,
        Number(fine.assessedAmount ?? 0) -
          nextPaidAmount -
          Number(fine.waivedAmount ?? 0),
      )
      await dbRun(
        env.DB,
        `
          UPDATE fines
          SET
            paid_amount = ?,
            status = ?,
            settled_at = CASE WHEN ? <= 0 THEN NULL ELSE settled_at END
          WHERE id = ?
        `,
        [
          nextPaidAmount,
          outstandingAmount <= 0 ? 'paid' : nextPaidAmount > 0 ? 'partial' : 'open',
          nextPaidAmount,
          fineLink.fineId,
        ],
      )
    }
  }

  await dbRun(
    env.DB,
    `
      UPDATE payments
      SET
        status = 'refunded',
        voided_at = ?,
        voided_by_user_id = ?,
        void_reason = ?,
        updated_at = ?,
        updated_by_user_id = ?
      WHERE id = ?
    `,
    [dhakaNow(), actor.id, reason, dhakaNow(), actor.id, paymentId],
  )

  const journalGroupId = crypto.randomUUID()
  const assetAccountId = paymentAssetAccountId(before.paymentMethodCode)
  await dbRun(
    env.DB,
    `
      INSERT INTO ledgers (
        id,
        account_id,
        entry_date,
        direction,
        amount,
        reference_type,
        reference_id,
        narration,
        created_by_user_id,
        created_at,
        journal_group_id,
        member_id,
        payment_id,
        fee_type_id,
        source_module
      )
      VALUES (?, ?, ?, 'credit', ?, 'payment_void', ?, ?, ?, ?, ?, ?, ?, ?, 'accounts')
    `,
    [
      crypto.randomUUID(),
      assetAccountId,
      dhakaNow(),
      before.amount,
      paymentId,
      'Payment void reversal',
      actor.id,
      dhakaNow(),
      journalGroupId,
      before.memberId,
      paymentId,
      before.feeTypeId,
    ],
  )

  const creditAllocations =
    allocations.length > 0
      ? allocations
      : [
          {
            dueEntryId: null,
            feeTypeId: before.feeTypeId,
            amount: before.amount,
          },
        ]

  for (const allocation of creditAllocations) {
    const feeType = allocation.feeTypeId
      ? await resolveFeeType(env.DB, allocation.feeTypeId)
      : null
    await dbRun(
      env.DB,
      `
        INSERT INTO ledgers (
          id,
          account_id,
          entry_date,
          direction,
          amount,
          reference_type,
          reference_id,
          narration,
          created_by_user_id,
          created_at,
          journal_group_id,
          member_id,
          payment_id,
          fee_type_id,
          due_entry_id,
          source_module
        )
        VALUES (?, ?, ?, 'debit', ?, 'payment_void', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'accounts')
      `,
      [
        crypto.randomUUID(),
        feeType?.incomeAccountId ?? 'acct_other_income',
        dhakaNow(),
        allocation.amount,
        paymentId,
        'Income reversal for void payment',
        actor.id,
        dhakaNow(),
        journalGroupId,
        before.memberId,
        paymentId,
        allocation.feeTypeId,
        allocation.dueEntryId,
      ],
    )
  }

  await writeAudit(
    env.DB,
    actor,
    'accounts.payment.void',
    'payment',
    paymentId,
    'A payment has been voided.',
    {
      before,
      after: {
        voidedAt: dhakaNow(),
        reason,
      },
      requestId: requestId ?? null,
    },
  )
}
