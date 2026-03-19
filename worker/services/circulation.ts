import type {
  CirculationCopyLookup,
  CirculationDashboardPayload,
  CirculationIssueResult,
  CirculationLoanListPayload,
  CirculationRenewResult,
  CirculationReturnResult,
  CirculationSettings,
  CirculationStats,
  LoanListItem,
  LoanResolutionCode,
  LookupOption,
  PaymentTypeOption,
  ReminderChannel,
  ReminderLogRecord,
  ReminderRuleDefinition,
  ReminderTemplateDefinition,
  ReservationRecord,
  ReservationStatus,
  SessionUser,
} from '@shared/index'
import {
  addDhakaDays,
  dhakaNow,
  diffDhakaCalendarDays,
  normalizeText,
  parseDhakaInputDate,
} from '@shared/index'
import type { AppBindings } from '../types'
import { writeAudit } from '../lib/audit'
import {
  dbAll,
  dbFirst,
  dbRun,
  dbValue,
  jsonObject,
  paginated,
} from '../lib/db'
import { getAppSettings, saveAppSetting } from '../lib/settings'

type LoanReminderType = 'due_soon' | 'overdue' | 'reservation_ready'

interface MemberRow {
  id: string
  memberCode: string
  memberNameBn: string
  phone: string
  email: string | null
  status: string
}

interface LoanRow {
  id: string
  memberId: string
  memberCode: string
  memberNameBn: string
  copyItemId: string
  bibliographicRecordId: string
  accessionCode: string
  barcodeValue: string | null
  title: string
  authorsText: string | null
  issueDate: string
  dueDate: string
  expectedReturnDate: string | null
  actualReturnDate: string | null
  overdueDays: number | null
  renewalCount: number
  fineAmount: number | null
  status: LoanListItem['status']
  remarks: string | null
  resolutionCode: LoanResolutionCode | null
  copyAvailability: LoanListItem['copyAvailability']
  copyCondition: LoanListItem['copyCondition']
}

interface ReservationRow {
  id: string
  memberId: string
  memberCode: string
  memberNameBn: string
  bibliographicRecordId: string
  title: string
  status: ReservationStatus
  queuePosition: number
  note: string | null
  requestedAt: string
  readyAt: string | null
  expiresAt: string | null
}

interface ReminderRow {
  id: string
  loanId: string | null
  reservationId: string | null
  memberId: string
  memberCode: string
  memberNameBn: string
  title: string | null
  reminderType: string
  channel: ReminderChannel
  providerKey: string
  scheduledFor: string
  sentAt: string | null
  deliveryStatus: ReminderLogRecord['status']
  retryCount: number
  lastError: string | null
  templateKey: string | null
  recipientAddress: string | null
}

interface CopyLookupRow {
  copyItemId: string
  bibliographicRecordId: string
  accessionCode: string
  barcodeValue: string | null
  title: string
  authorsText: string | null
  availability: CirculationCopyLookup['availability']
  condition: CirculationCopyLookup['condition']
  shelfLabel: string | null
  rackLabel: string | null
  roomLabel: string | null
}

interface ActiveLoanSummaryRow {
  loanId: string
  memberId: string
  memberNameBn: string
  memberCode: string
  dueAt: string
  status: LoanListItem['status']
}

interface FineRow {
  id: string
  assessedAmount: number
  waivedAmount: number
  paidAmount: number
}

interface PaymentTypeRow {
  id: string
  code: string
  nameBn: string
  nameEn: string
}

interface CatalogLookupRow {
  id: string
  title: string
  authorsText: string | null
  availableCopies: number
  activeReservations: number
}

interface ReminderPayload {
  subject?: string | null
  body: string
  maxRetries: number
  retryDelayMinutes: number
}

function splitAuthors(value?: string | null): string[] {
  return value
    ? value
        .split('||')
        .map((item) => item.trim())
        .filter(Boolean)
    : []
}

function mapLoanRow(row: LoanRow): LoanListItem {
  return {
    id: row.id,
    memberId: row.memberId,
    memberNameBn: row.memberNameBn,
    memberCode: row.memberCode,
    copyItemId: row.copyItemId,
    bibliographicRecordId: row.bibliographicRecordId,
    accessionCode: row.accessionCode,
    barcodeValue: row.barcodeValue ?? row.accessionCode,
    title: row.title,
    authors: splitAuthors(row.authorsText),
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    expectedReturnDate: row.expectedReturnDate ?? row.dueDate,
    actualReturnDate: row.actualReturnDate,
    overdueDays: Number(row.overdueDays ?? 0),
    renewalCount: row.renewalCount,
    fineAmount: Number(row.fineAmount ?? 0),
    status: row.status,
    remarks: row.remarks,
    resolutionCode: row.resolutionCode,
    copyAvailability: row.copyAvailability,
    copyCondition: row.copyCondition,
  }
}

function mapReservationRow(row: ReservationRow): ReservationRecord {
  return {
    id: row.id,
    memberId: row.memberId,
    memberCode: row.memberCode,
    memberNameBn: row.memberNameBn,
    bibliographicRecordId: row.bibliographicRecordId,
    title: row.title,
    status: row.status,
    queuePosition: row.queuePosition,
    note: row.note,
    requestedAt: row.requestedAt,
    readyAt: row.readyAt,
    expiresAt: row.expiresAt,
  }
}

function mapReminderRow(row: ReminderRow): ReminderLogRecord {
  return {
    id: row.id,
    loanId: row.loanId,
    reservationId: row.reservationId,
    memberId: row.memberId,
    memberNameBn: row.memberNameBn,
    memberCode: row.memberCode,
    title: row.title,
    reminderType: row.reminderType,
    channel: row.channel,
    providerKey: row.providerKey,
    scheduledFor: row.scheduledFor,
    sentAt: row.sentAt,
    status: row.deliveryStatus,
    retryCount: row.retryCount,
    lastError: row.lastError,
    templateKey: row.templateKey,
    recipientAddress: row.recipientAddress,
  }
}

function defaultCirculationSettings(env: AppBindings): CirculationSettings {
  const finePerDay = Number(env.DEFAULT_FINE_PER_DAY || '5')

  return {
    policy: {
      defaultLoanDays: 14,
      defaultRenewDays: 7,
      maxRenewals: 2,
      graceDays: 0,
      overdueFinePerDay: Number.isFinite(finePerDay) ? finePerDay : 5,
      maxFineAmount: 500,
      allowRenewWhenOverdue: false,
      allowReservations: true,
      autoReserveReturnedCopy: true,
      reminderCronEnabled: true,
    },
    reminderProviders: {
      whatsapp: 'whatsapp_stub',
      sms: 'sms_stub',
      email: 'email_stub',
    },
    reminderTemplates: [
      {
        key: 'due_soon_whatsapp_bn',
        nameBn: 'Due soon WhatsApp',
        nameEn: 'Due soon WhatsApp',
        channel: 'whatsapp',
        subjectTemplate: '',
        bodyTemplateBn:
          '{{memberName}}, "{{bookTitle}}" বইটি {{dueDate}} তারিখে ফেরত দেওয়ার অনুরোধ করা হচ্ছে। {{libraryName}}',
        bodyTemplateEn:
          '{{memberName}}, please return "{{bookTitle}}" by {{dueDate}}. {{libraryName}}',
        enabled: true,
      },
      {
        key: 'overdue_whatsapp_bn',
        nameBn: 'Overdue WhatsApp',
        nameEn: 'Overdue WhatsApp',
        channel: 'whatsapp',
        subjectTemplate: '',
        bodyTemplateBn:
          '{{memberName}}, "{{bookTitle}}" বইটি {{dueDate}} তারিখে জমা দেওয়ার কথা ছিল। {{overdueDays}} দিন ওভারডিউ হয়েছে এবং বর্তমান জরিমানা {{fineAmount}}।',
        bodyTemplateEn:
          '{{memberName}}, "{{bookTitle}}" is overdue by {{overdueDays}} day(s). Current fine: {{fineAmount}}.',
        enabled: true,
      },
      {
        key: 'reservation_ready_whatsapp_bn',
        nameBn: 'Reservation ready WhatsApp',
        nameEn: 'Reservation ready WhatsApp',
        channel: 'whatsapp',
        subjectTemplate: '',
        bodyTemplateBn:
          '{{memberName}}, "{{bookTitle}}" এখন আপনার জন্য সংরক্ষিত আছে। অনুগ্রহ করে {{expiryDate}} এর মধ্যে সংগ্রহ করুন।',
        bodyTemplateEn:
          '{{memberName}}, "{{bookTitle}}" is ready for pickup. Please collect it by {{expiryDate}}.',
        enabled: true,
      },
    ],
    reminderRules: [
      {
        key: 'due_soon_1_day',
        nameBn: 'Due soon (1 day before)',
        nameEn: 'Due soon (1 day before)',
        reminderType: 'due_soon',
        timing: 'before_due',
        offsetDays: 1,
        channel: 'whatsapp',
        templateKey: 'due_soon_whatsapp_bn',
        enabled: true,
        maxRetries: 2,
        retryDelayMinutes: 180,
      },
      {
        key: 'overdue_1_day',
        nameBn: 'Overdue (1 day after)',
        nameEn: 'Overdue (1 day after)',
        reminderType: 'overdue',
        timing: 'after_due',
        offsetDays: 1,
        channel: 'whatsapp',
        templateKey: 'overdue_whatsapp_bn',
        enabled: true,
        maxRetries: 3,
        retryDelayMinutes: 180,
      },
      {
        key: 'reservation_ready_now',
        nameBn: 'Reservation ready',
        nameEn: 'Reservation ready',
        reminderType: 'reservation_ready',
        timing: 'reservation_ready',
        offsetDays: 0,
        channel: 'whatsapp',
        templateKey: 'reservation_ready_whatsapp_bn',
        enabled: true,
        maxRetries: 2,
        retryDelayMinutes: 120,
      },
    ],
  }
}

export async function getCirculationSettings(
  db: D1Database,
  env: AppBindings,
): Promise<CirculationSettings> {
  const defaults = defaultCirculationSettings(env)
  const settings = await getAppSettings(db)
  const saved = settings.circulation_settings as Partial<CirculationSettings> | undefined

  return {
    policy: {
      ...defaults.policy,
      ...(saved?.policy ?? {}),
    },
    reminderProviders: {
      ...defaults.reminderProviders,
      ...(saved?.reminderProviders ?? {}),
    },
    reminderTemplates:
      saved?.reminderTemplates && saved.reminderTemplates.length > 0
        ? saved.reminderTemplates
        : defaults.reminderTemplates,
    reminderRules:
      saved?.reminderRules && saved.reminderRules.length > 0
        ? saved.reminderRules
        : defaults.reminderRules,
  }
}

export async function saveCirculationSettings(
  db: D1Database,
  actor: SessionUser,
  settings: CirculationSettings,
  requestId?: string | null,
) {
  const previous = await getAppSettings(db)
  await saveAppSetting(db, 'circulation_settings', settings, actor.id)
  await writeAudit(
    db,
    actor,
    'circulation.settings.updated',
    'circulation_settings',
    'circulation_settings',
    'Circulation policy and reminder settings updated.',
    {
      before: previous.circulation_settings ?? null,
      after: settings,
      requestId: requestId ?? null,
    },
  )
}

export function calculateLoanAging(
  dueAt: string,
  effectiveAt: string,
  settings: CirculationSettings,
): { overdueDays: number; fineAmount: number } {
  const rawDays = diffDhakaCalendarDays(dueAt, effectiveAt)
  const overdueDays = Math.max(0, rawDays - settings.policy.graceDays)
  const fineAmount = Math.min(
    overdueDays * settings.policy.overdueFinePerDay,
    settings.policy.maxFineAmount,
  )

  return {
    overdueDays,
    fineAmount,
  }
}

async function loadLoanRows(
  db: D1Database,
  whereClause = `WHERE loans.status IN ('issued', 'overdue')`,
  bindings: unknown[] = [],
  limitClause = '',
): Promise<LoanRow[]> {
  return dbAll<LoanRow>(
    db,
    `
      SELECT
        loans.id AS id,
        loans.member_id AS memberId,
        members.member_no AS memberCode,
        members.full_name_bn AS memberNameBn,
        loans.book_copy_id AS copyItemId,
        book_copies.bibliographic_record_id AS bibliographicRecordId,
        book_copies.accession_code AS accessionCode,
        (
          SELECT barcode_value
          FROM barcodes
          WHERE entity_type = 'book_copy'
            AND entity_id = book_copies.id
            AND is_active = 1
          ORDER BY created_at ASC
          LIMIT 1
        ) AS barcodeValue,
        COALESCE(bibliographic_records.title_bn, bibliographic_records.title_en) AS title,
        (
          SELECT GROUP_CONCAT(COALESCE(contributor_name_bn, contributor_name_en), '||')
          FROM book_contributors
          WHERE bibliographic_record_id = bibliographic_records.id
            AND contributor_role = 'author'
        ) AS authorsText,
        loans.issued_at AS issueDate,
        loans.due_at AS dueDate,
        COALESCE(loans.expected_return_at, loans.due_at) AS expectedReturnDate,
        loans.returned_at AS actualReturnDate,
        loans.overdue_days AS overdueDays,
        loans.renewed_count AS renewalCount,
        loans.fine_amount AS fineAmount,
        loans.status AS status,
        COALESCE(loans.remarks, loans.return_note, loans.issue_note) AS remarks,
        loans.resolution_code AS resolutionCode,
        book_copies.availability_status AS copyAvailability,
        book_copies.condition_status AS copyCondition
      FROM loans
      INNER JOIN members ON members.id = loans.member_id
      INNER JOIN book_copies ON book_copies.id = loans.book_copy_id
      INNER JOIN bibliographic_records ON bibliographic_records.id = book_copies.bibliographic_record_id
      ${whereClause}
      ORDER BY loans.due_at ASC, loans.created_at DESC
      ${limitClause}
    `,
    bindings,
  )
}

async function refreshLoanSnapshots(
  db: D1Database,
  settings: CirculationSettings,
): Promise<void> {
  const now = dhakaNow()
  const activeLoans = await dbAll<{
    id: string
    dueAt: string
    status: string
    fineAmount: number | null
    overdueDays: number | null
  }>(
    db,
    `
      SELECT
        id,
        due_at AS dueAt,
        status,
        fine_amount AS fineAmount,
        overdue_days AS overdueDays
      FROM loans
      WHERE status IN ('issued', 'overdue')
    `,
  )

  for (const loan of activeLoans) {
    const aging = calculateLoanAging(loan.dueAt, now, settings)
    const nextStatus = aging.overdueDays > 0 ? 'overdue' : 'issued'
    const fineChanged = Number(loan.fineAmount ?? 0) !== aging.fineAmount
    const overdueChanged = Number(loan.overdueDays ?? 0) !== aging.overdueDays

    if (loan.status !== nextStatus || fineChanged || overdueChanged) {
      await dbRun(
        db,
        `
          UPDATE loans
          SET
            status = ?,
            overdue_days = ?,
            fine_amount = ?,
            fine_updated_at = ?,
            updated_at = ?
          WHERE id = ?
        `,
        [nextStatus, aging.overdueDays, aging.fineAmount, now, now, loan.id],
      )
    }
  }
}

async function loadCirculationStats(db: D1Database): Promise<CirculationStats> {
  const now = dhakaNow()
  const todayStart = parseDhakaInputDate(now, { endOfDay: false }) ?? now
  const todayEnd = addDhakaDays(now, 0, { endOfDay: true })
  const dueSoonEnd = addDhakaDays(now, 3, { endOfDay: true })

  const [
    activeLoans,
    dueToday,
    dueSoon,
    overdueLoans,
    openFines,
    activeReservations,
    queuedReminders,
  ] = await Promise.all([
    dbValue<number>(
      db,
      `SELECT COUNT(*) AS total FROM loans WHERE status IN ('issued', 'overdue')`,
    ),
    dbValue<number>(
      db,
      `
        SELECT COUNT(*) AS total
        FROM loans
        WHERE status IN ('issued', 'overdue')
          AND due_at >= ?
          AND due_at <= ?
      `,
      [todayStart, todayEnd],
    ),
    dbValue<number>(
      db,
      `
        SELECT COUNT(*) AS total
        FROM loans
        WHERE status = 'issued'
          AND due_at <= ?
      `,
      [dueSoonEnd],
    ),
    dbValue<number>(
      db,
      `SELECT COUNT(*) AS total FROM loans WHERE status = 'overdue'`,
    ),
    dbValue<number>(
      db,
      `SELECT COUNT(*) AS total FROM fines WHERE status IN ('open', 'partial')`,
    ),
    dbValue<number>(
      db,
      `SELECT COUNT(*) AS total FROM reservations WHERE status IN ('active', 'ready') AND deleted_at IS NULL`,
    ),
    dbValue<number>(
      db,
      `SELECT COUNT(*) AS total FROM reminders WHERE delivery_status IN ('queued', 'retried')`,
    ),
  ])

  return {
    activeLoans: Number(activeLoans ?? 0),
    dueToday: Number(dueToday ?? 0),
    dueSoon: Number(dueSoon ?? 0),
    overdueLoans: Number(overdueLoans ?? 0),
    openFines: Number(openFines ?? 0),
    activeReservations: Number(activeReservations ?? 0),
    queuedReminders: Number(queuedReminders ?? 0),
  }
}

async function listReservationsInternal(
  db: D1Database,
  limit = 20,
): Promise<ReservationRecord[]> {
  const rows = await dbAll<ReservationRow>(
    db,
    `
      SELECT
        reservations.id AS id,
        reservations.member_id AS memberId,
        members.member_no AS memberCode,
        members.full_name_bn AS memberNameBn,
        reservations.bibliographic_record_id AS bibliographicRecordId,
        COALESCE(bibliographic_records.title_bn, bibliographic_records.title_en) AS title,
        reservations.status AS status,
        reservations.queue_position AS queuePosition,
        reservations.note AS note,
        reservations.created_at AS requestedAt,
        reservations.ready_at AS readyAt,
        reservations.expires_at AS expiresAt
      FROM reservations
      INNER JOIN members ON members.id = reservations.member_id
      INNER JOIN bibliographic_records ON bibliographic_records.id = reservations.bibliographic_record_id
      WHERE reservations.deleted_at IS NULL
      ORDER BY
        CASE reservations.status WHEN 'ready' THEN 0 ELSE 1 END,
        reservations.queue_position ASC,
        reservations.created_at ASC
      LIMIT ?
    `,
    [limit],
  )

  return rows.map(mapReservationRow)
}

export async function listReminderLogs(
  db: D1Database,
  limit = 20,
): Promise<ReminderLogRecord[]> {
  const rows = await dbAll<ReminderRow>(
    db,
    `
      SELECT
        reminders.id AS id,
        reminders.loan_id AS loanId,
        reminders.reservation_id AS reservationId,
        reminders.member_id AS memberId,
        members.member_no AS memberCode,
        members.full_name_bn AS memberNameBn,
        COALESCE(bibliographic_records.title_bn, bibliographic_records.title_en) AS title,
        reminders.reminder_type AS reminderType,
        reminders.channel AS channel,
        reminders.provider_key AS providerKey,
        reminders.scheduled_for AS scheduledFor,
        reminders.sent_at AS sentAt,
        reminders.delivery_status AS deliveryStatus,
        reminders.retry_count AS retryCount,
        reminders.last_error AS lastError,
        reminders.template_key AS templateKey,
        reminders.recipient_address AS recipientAddress
      FROM reminders
      INNER JOIN members ON members.id = reminders.member_id
      LEFT JOIN loans ON loans.id = reminders.loan_id
      LEFT JOIN reservations ON reservations.id = reminders.reservation_id
      LEFT JOIN book_copies ON book_copies.id = COALESCE(loans.book_copy_id, reservations.ready_copy_id, reservations.requested_copy_id)
      LEFT JOIN bibliographic_records ON bibliographic_records.id = COALESCE(book_copies.bibliographic_record_id, reservations.bibliographic_record_id)
      ORDER BY reminders.created_at DESC
      LIMIT ?
    `,
    [limit],
  )

  return rows.map(mapReminderRow)
}

async function listPaymentTypes(db: D1Database): Promise<PaymentTypeOption[]> {
  const rows = await dbAll<PaymentTypeRow>(
    db,
    `
      SELECT
        id,
        payment_type_code AS code,
        name_bn AS nameBn,
        name_en AS nameEn
      FROM payment_types
      WHERE active = 1
      ORDER BY name_bn ASC
    `,
  )

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    nameBn: row.nameBn,
    nameEn: row.nameEn,
  }))
}

export async function getCirculationDashboard(
  db: D1Database,
  env: AppBindings,
): Promise<CirculationDashboardPayload> {
  const settings = await getCirculationSettings(db, env)
  await refreshLoanSnapshots(db, settings)

  const [stats, dueSoonLoans, overdueLoans, activeLoans, reservations, reminderLogs, paymentTypes] =
    await Promise.all([
      loadCirculationStats(db),
      loadLoanRows(
        db,
        `WHERE loans.status = 'issued' AND loans.due_at <= ?`,
        [addDhakaDays(dhakaNow(), 3, { endOfDay: true })],
        'LIMIT 8',
      ),
      loadLoanRows(db, `WHERE loans.status = 'overdue'`, [], 'LIMIT 8'),
      loadLoanRows(db, `WHERE loans.status IN ('issued', 'overdue')`, [], 'LIMIT 8'),
      listReservationsInternal(db, 8),
      listReminderLogs(db, 10),
      listPaymentTypes(db),
    ])

  return {
    stats,
    dueSoonLoans: dueSoonLoans.map(mapLoanRow),
    overdueLoans: overdueLoans.map(mapLoanRow),
    activeLoans: activeLoans.map(mapLoanRow),
    reservations,
    reminderLogs,
    settings,
    paymentTypes,
  }
}

export async function listLoans(
  db: D1Database,
  env: AppBindings,
  options: {
    search?: string
    status?: string
    bucket?: string
    page: number
    pageSize: number
  },
): Promise<CirculationLoanListPayload> {
  const settings = await getCirculationSettings(db, env)
  await refreshLoanSnapshots(db, settings)

  const filters: string[] = []
  const bindings: unknown[] = []
  const search = options.search?.trim()
  const bucket = options.bucket?.trim() ?? 'active'

  if (bucket === 'due') {
    filters.push(`loans.status = 'issued' AND loans.due_at <= ?`)
    bindings.push(addDhakaDays(dhakaNow(), 3, { endOfDay: true }))
  } else if (bucket === 'overdue') {
    filters.push(`loans.status = 'overdue'`)
  } else if (bucket === 'returned') {
    filters.push(`loans.status IN ('returned', 'lost')`)
  } else {
    filters.push(`loans.status IN ('issued', 'overdue')`)
  }

  if (options.status) {
    filters.push(`loans.status = ?`)
    bindings.push(options.status)
  }

  if (search) {
    const searchLike = `%${search.toLowerCase()}%`
    filters.push(`
      (
        LOWER(IFNULL(members.member_no, '')) LIKE ?
        OR LOWER(IFNULL(members.full_name_bn, '')) LIKE ?
        OR LOWER(IFNULL(members.phone, '')) LIKE ?
        OR LOWER(IFNULL(book_copies.accession_code, '')) LIKE ?
        OR LOWER(IFNULL(COALESCE(bibliographic_records.title_bn, bibliographic_records.title_en), '')) LIKE ?
        OR LOWER(IFNULL((
          SELECT barcode_value
          FROM barcodes
          WHERE entity_type = 'book_copy'
            AND entity_id = book_copies.id
            AND is_active = 1
          LIMIT 1
        ), '')) LIKE ?
      )
    `)
    bindings.push(searchLike, searchLike, searchLike, searchLike, searchLike, searchLike)
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : ''
  const total = Number(
    (await dbValue<number>(
      db,
      `
        SELECT COUNT(*) AS total
        FROM loans
        INNER JOIN members ON members.id = loans.member_id
        INNER JOIN book_copies ON book_copies.id = loans.book_copy_id
        INNER JOIN bibliographic_records ON bibliographic_records.id = book_copies.bibliographic_record_id
        ${whereClause}
      `,
      bindings,
    )) ?? 0,
  )

  const rows = await loadLoanRows(
    db,
    whereClause,
    [...bindings, options.pageSize, (options.page - 1) * options.pageSize],
    `LIMIT ? OFFSET ?`,
  )
  const stats = await loadCirculationStats(db)

  return {
    ...paginated(rows.map(mapLoanRow), options.page, options.pageSize, total),
    stats,
  }
}

export async function searchMembers(
  db: D1Database,
  query: string,
): Promise<LookupOption[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) {
    return []
  }

  const searchLike = `%${trimmed.toLowerCase()}%`
  const rows = await dbAll<MemberRow>(
    db,
    `
      SELECT
        id,
        member_no AS memberCode,
        full_name_bn AS memberNameBn,
        phone,
        email,
        status
      FROM members
      WHERE deleted_at IS NULL
        AND (
          LOWER(member_no) LIKE ?
          OR LOWER(full_name_bn) LIKE ?
          OR LOWER(IFNULL(full_name_en, '')) LIKE ?
          OR LOWER(phone) LIKE ?
        )
      ORDER BY updated_at DESC
      LIMIT 10
    `,
    [searchLike, searchLike, searchLike, searchLike],
  )

  return rows.map((row) => ({
    id: row.id,
    label: `${row.memberNameBn} (${row.memberCode})`,
    sublabel: `${row.phone} • ${row.status}`,
  }))
}

export async function searchCatalogRecords(
  db: D1Database,
  query: string,
): Promise<LookupOption[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) {
    return []
  }

  const searchLike = `%${normalizeText(trimmed)}%`
  const rows = await dbAll<CatalogLookupRow>(
    db,
    `
      SELECT
        bibliographic_records.id AS id,
        COALESCE(bibliographic_records.title_bn, bibliographic_records.title_en) AS title,
        (
          SELECT GROUP_CONCAT(COALESCE(contributor_name_bn, contributor_name_en), '||')
          FROM book_contributors
          WHERE bibliographic_record_id = bibliographic_records.id
            AND contributor_role = 'author'
        ) AS authorsText,
        (
          SELECT COUNT(*)
          FROM book_copies
          WHERE bibliographic_record_id = bibliographic_records.id
            AND deleted_at IS NULL
            AND availability_status = 'available'
        ) AS availableCopies,
        (
          SELECT COUNT(*)
          FROM reservations
          WHERE bibliographic_record_id = bibliographic_records.id
            AND status IN ('active', 'ready')
            AND deleted_at IS NULL
        ) AS activeReservations
      FROM bibliographic_records
      WHERE deleted_at IS NULL
        AND (
          LOWER(IFNULL(title_bn, '')) LIKE ?
          OR LOWER(title_en) LIKE ?
          OR LOWER(IFNULL(isbn_13, '')) LIKE ?
          OR LOWER(IFNULL(isbn_10, '')) LIKE ?
        )
      ORDER BY updated_at DESC
      LIMIT 10
    `,
    [searchLike, searchLike, searchLike, searchLike],
  )

  return rows.map((row) => ({
    id: row.id,
    label: row.title,
    sublabel: `${splitAuthors(row.authorsText).join(', ') || 'Unknown author'} • Available ${row.availableCopies} • Queue ${row.activeReservations}`,
  }))
}

async function listReservationsForRecord(
  db: D1Database,
  bibliographicRecordId: string,
): Promise<ReservationRecord[]> {
  const rows = await dbAll<ReservationRow>(
    db,
    `
      SELECT
        reservations.id AS id,
        reservations.member_id AS memberId,
        members.member_no AS memberCode,
        members.full_name_bn AS memberNameBn,
        reservations.bibliographic_record_id AS bibliographicRecordId,
        COALESCE(bibliographic_records.title_bn, bibliographic_records.title_en) AS title,
        reservations.status AS status,
        reservations.queue_position AS queuePosition,
        reservations.note AS note,
        reservations.created_at AS requestedAt,
        reservations.ready_at AS readyAt,
        reservations.expires_at AS expiresAt
      FROM reservations
      INNER JOIN members ON members.id = reservations.member_id
      INNER JOIN bibliographic_records ON bibliographic_records.id = reservations.bibliographic_record_id
      WHERE reservations.bibliographic_record_id = ?
        AND reservations.status IN ('active', 'ready')
        AND reservations.deleted_at IS NULL
      ORDER BY reservations.queue_position ASC, reservations.created_at ASC
    `,
    [bibliographicRecordId],
  )

  return rows.map(mapReservationRow)
}

export async function lookupCopyByBarcode(
  db: D1Database,
  barcode: string,
): Promise<CirculationCopyLookup | null> {
  const trimmed = barcode.trim()
  if (!trimmed) {
    return null
  }

  const row = await dbFirst<CopyLookupRow>(
    db,
    `
      SELECT
        book_copies.id AS copyItemId,
        book_copies.bibliographic_record_id AS bibliographicRecordId,
        book_copies.accession_code AS accessionCode,
        (
          SELECT barcode_value
          FROM barcodes
          WHERE entity_type = 'book_copy'
            AND entity_id = book_copies.id
            AND is_active = 1
          ORDER BY created_at ASC
          LIMIT 1
        ) AS barcodeValue,
        COALESCE(bibliographic_records.title_bn, bibliographic_records.title_en) AS title,
        (
          SELECT GROUP_CONCAT(COALESCE(contributor_name_bn, contributor_name_en), '||')
          FROM book_contributors
          WHERE bibliographic_record_id = bibliographic_records.id
            AND contributor_role = 'author'
        ) AS authorsText,
        book_copies.availability_status AS availability,
        book_copies.condition_status AS condition,
        book_copies.shelf_label AS shelfLabel,
        book_copies.rack_label AS rackLabel,
        book_copies.room_label AS roomLabel
      FROM book_copies
      INNER JOIN bibliographic_records ON bibliographic_records.id = book_copies.bibliographic_record_id
      WHERE book_copies.deleted_at IS NULL
        AND (
          book_copies.id = ?
          OR LOWER(book_copies.accession_code) = LOWER(?)
          OR EXISTS (
            SELECT 1
            FROM barcodes
            WHERE entity_type = 'book_copy'
              AND entity_id = book_copies.id
              AND is_active = 1
              AND LOWER(barcode_value) = LOWER(?)
          )
        )
      LIMIT 1
    `,
    [trimmed, trimmed, trimmed],
  )

  if (!row) {
    return null
  }

  const activeLoan = await dbFirst<ActiveLoanSummaryRow>(
    db,
    `
      SELECT
        loans.id AS loanId,
        loans.member_id AS memberId,
        members.full_name_bn AS memberNameBn,
        members.member_no AS memberCode,
        loans.due_at AS dueAt,
        loans.status AS status
      FROM loans
      INNER JOIN members ON members.id = loans.member_id
      WHERE loans.book_copy_id = ?
        AND loans.status IN ('issued', 'overdue')
      LIMIT 1
    `,
    [row.copyItemId],
  )
  const reservations = await listReservationsForRecord(db, row.bibliographicRecordId)

  return {
    copyItemId: row.copyItemId,
    bibliographicRecordId: row.bibliographicRecordId,
    accessionCode: row.accessionCode,
    barcodeValue: row.barcodeValue ?? row.accessionCode,
    title: row.title,
    authors: splitAuthors(row.authorsText),
    availability: row.availability,
    condition: row.condition,
    shelfLabel: row.shelfLabel,
    rackLabel: row.rackLabel,
    roomLabel: row.roomLabel,
    activeLoan: activeLoan
      ? {
          loanId: activeLoan.loanId,
          memberId: activeLoan.memberId,
          memberNameBn: activeLoan.memberNameBn,
          memberCode: activeLoan.memberCode,
          dueAt: activeLoan.dueAt,
          status: activeLoan.status,
        }
      : null,
    reservations,
  }
}

async function resolveMember(
  db: D1Database,
  memberId: string,
): Promise<MemberRow> {
  const member = await dbFirst<MemberRow>(
    db,
    `
      SELECT
        id,
        member_no AS memberCode,
        full_name_bn AS memberNameBn,
        phone,
        email,
        status
      FROM members
      WHERE id = ?
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [memberId],
  )

  if (!member) {
    throw new Error('Selected member was not found.')
  }

  if (member.status !== 'active') {
    throw new Error('Only active members can issue or reserve books.')
  }

  return member
}

async function resolveLoanById(
  db: D1Database,
  loanId: string,
): Promise<LoanListItem> {
  const rows = await loadLoanRows(db, `WHERE loans.id = ?`, [loanId], 'LIMIT 1')
  const row = rows[0]
  if (!row) {
    throw new Error('Loan record not found.')
  }

  return mapLoanRow(row)
}

async function resolveActiveLoan(
  db: D1Database,
  payload: { loanId?: string; copyBarcode?: string },
): Promise<LoanListItem> {
  if (payload.loanId) {
    const loan = await resolveLoanById(db, payload.loanId)
    if (!['issued', 'overdue'].includes(loan.status)) {
      throw new Error('The selected loan is no longer active.')
    }
    return loan
  }

  if (!payload.copyBarcode) {
    throw new Error('Provide a loan or a copy barcode.')
  }

  const copy = await lookupCopyByBarcode(db, payload.copyBarcode)
  if (!copy?.activeLoan) {
    throw new Error('No active loan found for this barcode.')
  }

  return resolveLoanById(db, copy.activeLoan.loanId)
}

async function resolvePaymentTypeId(
  db: D1Database,
  paymentTypeCode?: string | null,
): Promise<string | null> {
  const code = paymentTypeCode?.trim() || 'cash'
  return (
    await dbValue<string>(
      db,
      `SELECT id AS value FROM payment_types WHERE payment_type_code = ? AND active = 1 LIMIT 1`,
      [code],
    )
  ) ?? null
}

async function createPaymentForFine(
  db: D1Database,
  actor: SessionUser,
  fineId: string,
  memberId: string,
  amount: number,
  paymentTypeCode?: string | null,
): Promise<void> {
  if (amount <= 0) {
    return
  }

  const paymentTypeId = await resolvePaymentTypeId(db, paymentTypeCode)
  if (!paymentTypeId) {
    throw new Error('A valid payment type is required to record fine payment.')
  }

  const now = dhakaNow()
  const accountId =
    paymentTypeCode === 'bkash' || paymentTypeCode === 'nagad'
      ? 'acct_wallet'
      : 'acct_cash'

  const paymentId = crypto.randomUUID()
  await dbRun(
    db,
    `
      INSERT INTO payments (
        id,
        member_id,
        fine_id,
        payment_type_id,
        account_id,
        amount,
        paid_at,
        status,
        received_by_user_id,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)
    `,
    [paymentId, memberId, fineId, paymentTypeId, accountId, amount, now, actor.id, now],
  )

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
        created_at
      )
      VALUES (?, ?, ?, 'debit', ?, 'payment', ?, 'Fine collection receipt', ?, ?)
    `,
    [crypto.randomUUID(), accountId, now, amount, paymentId, actor.id, now],
  )

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
        created_at
      )
      VALUES (?, 'acct_fine_income', ?, 'credit', ?, 'payment', ?, 'Fine income recognized', ?, ?)
    `,
    [crypto.randomUUID(), now, amount, paymentId, actor.id, now],
  )
}

async function upsertFine(
  db: D1Database,
  actor: SessionUser,
  options: {
    loanId: string
    memberId: string
    assessedAmount: number
    waiveRemaining: boolean
    additionalPaidAmount: number
    paymentTypeCode?: string | null
  },
): Promise<{ fineId: string | null; paidAmount: number; outstandingAmount: number }> {
  const existing = await dbFirst<FineRow>(
    db,
    `
      SELECT
        id,
        assessed_amount AS assessedAmount,
        waived_amount AS waivedAmount,
        paid_amount AS paidAmount
      FROM fines
      WHERE loan_id = ?
        AND member_id = ?
        AND reason_code = 'overdue'
      ORDER BY assessed_at DESC
      LIMIT 1
    `,
    [options.loanId, options.memberId],
  )

  if (!existing && options.assessedAmount <= 0 && options.additionalPaidAmount <= 0) {
    return { fineId: null, paidAmount: 0, outstandingAmount: 0 }
  }

  const fineId = existing?.id ?? crypto.randomUUID()
  const paidAmount = Math.min(
    options.assessedAmount,
    Number(existing?.paidAmount ?? 0) + options.additionalPaidAmount,
  )
  const waivedAmount = options.waiveRemaining
    ? Math.max(0, options.assessedAmount - paidAmount)
    : Math.min(Number(existing?.waivedAmount ?? 0), options.assessedAmount)
  const outstandingAmount = Math.max(0, options.assessedAmount - paidAmount - waivedAmount)
  const status =
    outstandingAmount <= 0
      ? waivedAmount > 0 && paidAmount < options.assessedAmount
        ? 'waived'
        : 'paid'
      : paidAmount > 0
        ? 'partial'
        : 'open'

  if (existing) {
    await dbRun(
      db,
      `
        UPDATE fines
        SET
          assessed_amount = ?,
          waived_amount = ?,
          paid_amount = ?,
          status = ?,
          settled_at = CASE WHEN ? IN ('paid', 'waived') THEN ? ELSE NULL END,
          note = ?
        WHERE id = ?
      `,
      [
        options.assessedAmount,
        waivedAmount,
        paidAmount,
        status,
        status,
        dhakaNow(),
        'Circulation overdue fine updated',
        fineId,
      ],
    )
  } else {
    await dbRun(
      db,
      `
        INSERT INTO fines (
          id,
          loan_id,
          member_id,
          assessed_amount,
          waived_amount,
          paid_amount,
          status,
          reason_code,
          note,
          assessed_at,
          settled_at,
          created_by_user_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'overdue', ?, ?, ?, ?)
      `,
      [
        fineId,
        options.loanId,
        options.memberId,
        options.assessedAmount,
        waivedAmount,
        paidAmount,
        status,
        'Circulation overdue fine assessed',
        dhakaNow(),
        status === 'paid' || status === 'waived' ? dhakaNow() : null,
        actor.id,
      ],
    )
  }

  if (options.additionalPaidAmount > 0) {
    await createPaymentForFine(
      db,
      actor,
      fineId,
      options.memberId,
      options.additionalPaidAmount,
      options.paymentTypeCode,
    )
  }

  return {
    fineId,
    paidAmount,
    outstandingAmount,
  }
}

async function resequenceReservations(
  db: D1Database,
  bibliographicRecordId: string,
): Promise<void> {
  const rows = await dbAll<{ id: string }>(
    db,
    `
      SELECT id
      FROM reservations
      WHERE bibliographic_record_id = ?
        AND status IN ('active', 'ready')
        AND deleted_at IS NULL
      ORDER BY
        CASE status WHEN 'ready' THEN 0 ELSE 1 END,
        created_at ASC
    `,
    [bibliographicRecordId],
  )

  for (const [index, row] of rows.entries()) {
    await dbRun(
      db,
      `UPDATE reservations SET queue_position = ?, updated_at = ? WHERE id = ?`,
      [index + 1, dhakaNow(), row.id],
    )
  }
}

function interpolateTemplate(
  template: string,
  replacements: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, token: string) => {
    return replacements[token] ?? ''
  })
}

async function createReminderIfMissing(
  env: AppBindings,
  settings: CirculationSettings,
  input: {
    loanId?: string | null
    reservationId?: string | null
    memberId: string
    reminderType: LoanReminderType
    channel: ReminderChannel
    rule: ReminderRuleDefinition
    template: ReminderTemplateDefinition
    scheduledFor: string
    recipientAddress: string
    dedupeKey: string
    replacements: Record<string, string>
  },
): Promise<void> {
  if (!input.recipientAddress.trim()) {
    return
  }

  const providerKey =
    input.channel === 'whatsapp'
      ? settings.reminderProviders.whatsapp
      : input.channel === 'sms'
        ? settings.reminderProviders.sms
        : settings.reminderProviders.email

  const body = interpolateTemplate(input.template.bodyTemplateBn, input.replacements)
  const subject = input.template.subjectTemplate
    ? interpolateTemplate(input.template.subjectTemplate, input.replacements)
    : null
  const reminderId = crypto.randomUUID()

  await dbRun(
    env.DB,
    `
      INSERT OR IGNORE INTO reminders (
        id,
        loan_id,
        member_id,
        reservation_id,
        reminder_type,
        channel,
        scheduled_for,
        status,
        dedupe_key,
        content_snapshot,
        provider_reference,
        created_at,
        template_key,
        rule_key,
        provider_key,
        delivery_status,
        retry_count,
        payload_json,
        recipient_address
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, NULL, ?, ?, ?, ?, 'queued', 0, ?, ?)
    `,
    [
      reminderId,
      input.loanId ?? null,
      input.memberId,
      input.reservationId ?? null,
      input.reminderType,
      input.channel,
      input.scheduledFor,
      input.dedupeKey,
      body,
      dhakaNow(),
      input.template.key,
      input.rule.key,
      providerKey,
      JSON.stringify({
        subject,
        body,
        maxRetries: input.rule.maxRetries,
        retryDelayMinutes: input.rule.retryDelayMinutes,
      } satisfies ReminderPayload),
      input.recipientAddress,
    ],
  )
}

async function dispatchPendingReminders(env: AppBindings): Promise<void> {
  const rows = await dbAll<{ id: string }>(
    env.DB,
    `
      SELECT id
      FROM reminders
      WHERE delivery_status IN ('queued', 'retried')
        AND (next_retry_at IS NULL OR next_retry_at <= ?)
      ORDER BY created_at ASC
      LIMIT 100
    `,
    [dhakaNow()],
  )

  for (const row of rows) {
    await env.TASK_QUEUE.send({
      type: 'circulation-reminder',
      reminderId: row.id,
    })
  }
}

async function maybePromoteReservation(
  env: AppBindings,
  bibliographicRecordId: string,
  copyItemId: string,
): Promise<void> {
  const settings = await getCirculationSettings(env.DB, env)
  if (!settings.policy.allowReservations || !settings.policy.autoReserveReturnedCopy) {
    return
  }

  const nextReservation = await dbFirst<ReservationRow>(
    env.DB,
    `
      SELECT
        reservations.id AS id,
        reservations.member_id AS memberId,
        members.member_no AS memberCode,
        members.full_name_bn AS memberNameBn,
        reservations.bibliographic_record_id AS bibliographicRecordId,
        COALESCE(bibliographic_records.title_bn, bibliographic_records.title_en) AS title,
        reservations.status AS status,
        reservations.queue_position AS queuePosition,
        reservations.note AS note,
        reservations.created_at AS requestedAt,
        reservations.ready_at AS readyAt,
        reservations.expires_at AS expiresAt
      FROM reservations
      INNER JOIN members ON members.id = reservations.member_id
      INNER JOIN bibliographic_records ON bibliographic_records.id = reservations.bibliographic_record_id
      WHERE reservations.bibliographic_record_id = ?
        AND reservations.status = 'active'
        AND reservations.deleted_at IS NULL
      ORDER BY reservations.queue_position ASC, reservations.created_at ASC
      LIMIT 1
    `,
    [bibliographicRecordId],
  )

  if (!nextReservation) {
    return
  }

  const now = dhakaNow()
  const expiresAt = addDhakaDays(now, 3, { endOfDay: true })
  await dbRun(
    env.DB,
    `
      UPDATE reservations
      SET
        status = 'ready',
        ready_copy_id = ?,
        ready_at = ?,
        expires_at = ?,
        updated_at = ?
      WHERE id = ?
    `,
    [copyItemId, now, expiresAt, now, nextReservation.id],
  )
  await dbRun(
    env.DB,
    `
      UPDATE book_copies
      SET availability_status = 'reserved', updated_at = ?
      WHERE id = ?
    `,
    [now, copyItemId],
  )
  await resequenceReservations(env.DB, bibliographicRecordId)

  const member = await resolveMember(env.DB, nextReservation.memberId)
  const template = settings.reminderTemplates.find(
    (item) => item.key === 'reservation_ready_whatsapp_bn' && item.enabled,
  )
  const rule = settings.reminderRules.find(
    (item) => item.reminderType === 'reservation_ready' && item.enabled,
  )
  if (!template || !rule) {
    return
  }

  await createReminderIfMissing(env, settings, {
    reservationId: nextReservation.id,
    memberId: nextReservation.memberId,
    reminderType: 'reservation_ready',
    channel: rule.channel,
    rule,
    template,
    scheduledFor: now,
    recipientAddress: rule.channel === 'email' ? member.email ?? '' : member.phone,
    dedupeKey: `${rule.key}:${nextReservation.id}:${now.slice(0, 10)}`,
    replacements: {
      memberName: nextReservation.memberNameBn,
      bookTitle: nextReservation.title,
      expiryDate: expiresAt.slice(0, 10),
      libraryName: env.APP_NAME_BN,
    },
  })
  await dispatchPendingReminders(env)
}

export async function createReservation(
  env: AppBindings,
  actor: SessionUser,
  payload: {
    memberId: string
    bibliographicRecordId: string
    note?: string
  },
  requestId?: string | null,
): Promise<ReservationRecord> {
  const settings = await getCirculationSettings(env.DB, env)
  if (!settings.policy.allowReservations) {
    throw new Error('Reservations are currently disabled.')
  }

  const member = await resolveMember(env.DB, payload.memberId)
  const book = await dbFirst<{ title: string }>(
    env.DB,
    `
      SELECT COALESCE(title_bn, title_en) AS title
      FROM bibliographic_records
      WHERE id = ?
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [payload.bibliographicRecordId],
  )
  if (!book) {
    throw new Error('Selected title was not found.')
  }

  const existing = await dbFirst<{ id: string }>(
    env.DB,
    `
      SELECT id
      FROM reservations
      WHERE member_id = ?
        AND bibliographic_record_id = ?
        AND status IN ('active', 'ready')
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [payload.memberId, payload.bibliographicRecordId],
  )
  if (existing) {
    throw new Error('This member already has an active reservation for the selected title.')
  }

  const availableCopyId = await dbValue<string>(
    env.DB,
    `
      SELECT id AS value
      FROM book_copies
      WHERE bibliographic_record_id = ?
        AND availability_status = 'available'
        AND deleted_at IS NULL
      ORDER BY updated_at ASC
      LIMIT 1
    `,
    [payload.bibliographicRecordId],
  )

  const queuePosition =
    Number(
      (await dbValue<number>(
        env.DB,
        `
          SELECT COALESCE(MAX(queue_position), 0) AS total
          FROM reservations
          WHERE bibliographic_record_id = ?
            AND status IN ('active', 'ready')
            AND deleted_at IS NULL
        `,
        [payload.bibliographicRecordId],
      )) ?? 0,
    ) + 1

  const reservationId = crypto.randomUUID()
  const now = dhakaNow()
  const readyAt = availableCopyId ? now : null
  const expiresAt = availableCopyId ? addDhakaDays(now, 3, { endOfDay: true }) : null
  const status: ReservationStatus = availableCopyId ? 'ready' : 'active'

  await dbRun(
    env.DB,
    `
      INSERT INTO reservations (
        id,
        bibliographic_record_id,
        member_id,
        ready_copy_id,
        status,
        queue_position,
        note,
        ready_at,
        expires_at,
        created_by_user_id,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      reservationId,
      payload.bibliographicRecordId,
      payload.memberId,
      availableCopyId ?? null,
      status,
      queuePosition,
      payload.note?.trim() || null,
      readyAt,
      expiresAt,
      actor.id,
      now,
      now,
    ],
  )

  if (availableCopyId) {
    await dbRun(
      env.DB,
      `UPDATE book_copies SET availability_status = 'reserved', updated_at = ? WHERE id = ?`,
      [now, availableCopyId],
    )
  }

  await resequenceReservations(env.DB, payload.bibliographicRecordId)

  const reservation = (
    await listReservationsForRecord(env.DB, payload.bibliographicRecordId)
  ).find((item) => item.id === reservationId)
  if (!reservation) {
    throw new Error('Reservation could not be created.')
  }

  await writeAudit(
    env.DB,
    actor,
    'circulation.reservation.created',
    'reservation',
    reservationId,
    `Reservation created for ${member.memberNameBn}.`,
    {
      after: reservation,
      requestId: requestId ?? null,
    },
  )

  if (status === 'ready') {
    const template = settings.reminderTemplates.find(
      (item) => item.key === 'reservation_ready_whatsapp_bn' && item.enabled,
    )
    const rule = settings.reminderRules.find(
      (item) => item.reminderType === 'reservation_ready' && item.enabled,
    )
    if (template && rule) {
      await createReminderIfMissing(env, settings, {
        reservationId,
        memberId: payload.memberId,
        reminderType: 'reservation_ready',
        channel: rule.channel,
        rule,
        template,
        scheduledFor: now,
        recipientAddress: rule.channel === 'email' ? member.email ?? '' : member.phone,
        dedupeKey: `${rule.key}:${reservationId}:${now.slice(0, 10)}`,
        replacements: {
          memberName: member.memberNameBn,
          bookTitle: book.title,
          expiryDate: expiresAt?.slice(0, 10) ?? '',
          libraryName: env.APP_NAME_BN,
        },
      })
      await dispatchPendingReminders(env)
    }
  }

  return reservation
}

export async function updateReservationStatus(
  env: AppBindings,
  actor: SessionUser,
  reservationId: string,
  payload: {
    status: 'cancelled' | 'expired' | 'fulfilled'
    note?: string
  },
  requestId?: string | null,
): Promise<ReservationRecord> {
  const reservation = await dbFirst<ReservationRow & { readyCopyId: string | null }>(
    env.DB,
    `
      SELECT
        reservations.id AS id,
        reservations.member_id AS memberId,
        members.member_no AS memberCode,
        members.full_name_bn AS memberNameBn,
        reservations.bibliographic_record_id AS bibliographicRecordId,
        COALESCE(bibliographic_records.title_bn, bibliographic_records.title_en) AS title,
        reservations.status AS status,
        reservations.queue_position AS queuePosition,
        reservations.note AS note,
        reservations.created_at AS requestedAt,
        reservations.ready_at AS readyAt,
        reservations.expires_at AS expiresAt,
        reservations.ready_copy_id AS readyCopyId
      FROM reservations
      INNER JOIN members ON members.id = reservations.member_id
      INNER JOIN bibliographic_records ON bibliographic_records.id = reservations.bibliographic_record_id
      WHERE reservations.id = ?
        AND reservations.deleted_at IS NULL
      LIMIT 1
    `,
    [reservationId],
  )
  if (!reservation) {
    throw new Error('Reservation not found.')
  }

  const now = dhakaNow()
  await dbRun(
    env.DB,
    `
      UPDATE reservations
      SET
        status = ?,
        note = COALESCE(?, note),
        updated_at = ?
      WHERE id = ?
    `,
    [payload.status, payload.note?.trim() || null, now, reservationId],
  )

  if (reservation.readyCopyId && payload.status !== 'fulfilled') {
    await dbRun(
      env.DB,
      `
        UPDATE book_copies
        SET availability_status = 'available', updated_at = ?
        WHERE id = ?
          AND availability_status = 'reserved'
      `,
      [now, reservation.readyCopyId],
    )
    await maybePromoteReservation(env, reservation.bibliographicRecordId, reservation.readyCopyId)
  }

  await resequenceReservations(env.DB, reservation.bibliographicRecordId)
  const updated = (await listReservationsForRecord(env.DB, reservation.bibliographicRecordId)).find(
    (item) => item.id === reservationId,
  )

  await writeAudit(
    env.DB,
    actor,
    'circulation.reservation.updated',
    'reservation',
    reservationId,
    `Reservation marked as ${payload.status}.`,
    {
      before: mapReservationRow(reservation),
      after: updated ?? { ...mapReservationRow(reservation), status: payload.status },
      requestId: requestId ?? null,
    },
  )

  return updated ?? { ...mapReservationRow(reservation), status: payload.status }
}

export async function issueLoan(
  env: AppBindings,
  actor: SessionUser,
  payload: {
    memberId: string
    copyItemId?: string
    copyBarcode?: string
    dueAt?: string
    expectedReturnAt?: string
    remarks?: string
  },
  requestId?: string | null,
): Promise<CirculationIssueResult> {
  const settings = await getCirculationSettings(env.DB, env)
  await refreshLoanSnapshots(env.DB, settings)

  const member = await resolveMember(env.DB, payload.memberId)
  const lookupValue = payload.copyBarcode ?? payload.copyItemId ?? ''
  const copy = await lookupCopyByBarcode(env.DB, lookupValue)
  if (!copy) {
    throw new Error('The selected copy could not be found.')
  }
  if (copy.activeLoan) {
    throw new Error('This copy is already issued to another member.')
  }

  const firstReservation = copy.reservations[0]
  if (
    copy.availability === 'reserved' &&
    (!firstReservation || firstReservation.memberId !== member.id)
  ) {
    throw new Error('This copy is reserved for another member.')
  }
  if (!['available', 'reserved'].includes(copy.availability)) {
    throw new Error('This copy is not available for issue.')
  }

  const dueAt =
    parseDhakaInputDate(payload.dueAt, { endOfDay: true }) ??
    addDhakaDays(dhakaNow(), settings.policy.defaultLoanDays, { endOfDay: true })
  const expectedReturnAt =
    parseDhakaInputDate(payload.expectedReturnAt, { endOfDay: true }) ?? dueAt
  const now = dhakaNow()
  const loanId = crypto.randomUUID()

  await dbRun(
    env.DB,
    `
      INSERT INTO loans (
        id,
        book_copy_id,
        member_id,
        issued_by_user_id,
        issued_at,
        due_at,
        expected_return_at,
        renewed_count,
        status,
        issue_note,
        remarks,
        overdue_days,
        fine_amount,
        fine_updated_at,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'issued', ?, ?, 0, 0, ?, ?, ?)
    `,
    [
      loanId,
      copy.copyItemId,
      member.id,
      actor.id,
      now,
      dueAt,
      expectedReturnAt,
      payload.remarks?.trim() || null,
      payload.remarks?.trim() || null,
      now,
      now,
      now,
    ],
  )
  await dbRun(
    env.DB,
    `UPDATE book_copies SET availability_status = 'on_loan', updated_at = ? WHERE id = ?`,
    [now, copy.copyItemId],
  )

  if (firstReservation && firstReservation.memberId === member.id) {
    await dbRun(
      env.DB,
      `
        UPDATE reservations
        SET
          status = 'fulfilled',
          fulfilled_loan_id = ?,
          updated_at = ?
        WHERE id = ?
      `,
      [loanId, now, firstReservation.id],
    )
    await resequenceReservations(env.DB, copy.bibliographicRecordId)
  }

  await dbRun(
    env.DB,
    `
      INSERT INTO loan_history (
        id,
        loan_id,
        event_type,
        previous_status,
        next_status,
        event_at,
        actor_user_id,
        note,
        metadata_json
      )
      VALUES (?, ?, 'issued', NULL, 'issued', ?, ?, ?, ?)
    `,
    [
      crypto.randomUUID(),
      loanId,
      now,
      actor.id,
      payload.remarks?.trim() || 'Loan issued',
      JSON.stringify({ dueAt, expectedReturnAt }),
    ],
  )

  const loan = await resolveLoanById(env.DB, loanId)
  const nextCopy = await lookupCopyByBarcode(env.DB, copy.barcodeValue)
  if (!nextCopy) {
    throw new Error('Issued copy could not be reloaded.')
  }

  await writeAudit(
    env.DB,
    actor,
    'circulation.loan.issued',
    'loan',
    loanId,
    `Issued ${copy.title} to ${member.memberNameBn}.`,
    {
      after: loan,
      requestId: requestId ?? null,
    },
  )

  return { loan, copy: nextCopy }
}

export async function renewLoan(
  env: AppBindings,
  actor: SessionUser,
  payload: {
    loanId: string
    dueAt?: string
    remarks?: string
  },
  requestId?: string | null,
): Promise<CirculationRenewResult> {
  const settings = await getCirculationSettings(env.DB, env)
  await refreshLoanSnapshots(env.DB, settings)

  const loan = await resolveLoanById(env.DB, payload.loanId)
  if (!['issued', 'overdue'].includes(loan.status)) {
    throw new Error('Only active loans can be renewed.')
  }
  if (loan.renewalCount >= settings.policy.maxRenewals) {
    throw new Error('Maximum renewal limit has been reached for this loan.')
  }
  if (loan.status === 'overdue' && !settings.policy.allowRenewWhenOverdue) {
    throw new Error('Overdue loans cannot be renewed under the current policy.')
  }

  const reservation = await dbFirst<{ memberId: string }>(
    env.DB,
    `
      SELECT member_id AS memberId
      FROM reservations
      WHERE bibliographic_record_id = ?
        AND status IN ('active', 'ready')
        AND deleted_at IS NULL
      ORDER BY queue_position ASC
      LIMIT 1
    `,
    [loan.bibliographicRecordId],
  )
  if (reservation && reservation.memberId !== loan.memberId) {
    throw new Error('This title has a waiting reservation and cannot be renewed.')
  }

  const now = dhakaNow()
  const aging = calculateLoanAging(loan.dueDate, now, settings)
  await upsertFine(env.DB, actor, {
    loanId: loan.id,
    memberId: loan.memberId,
    assessedAmount: aging.fineAmount,
    waiveRemaining: false,
    additionalPaidAmount: 0,
  })

  const baseDate = loan.status === 'overdue' ? now : loan.dueDate
  const nextDueAt =
    parseDhakaInputDate(payload.dueAt, { endOfDay: true }) ??
    addDhakaDays(baseDate, settings.policy.defaultRenewDays, { endOfDay: true })

  await dbRun(
    env.DB,
    `
      UPDATE loans
      SET
        due_at = ?,
        expected_return_at = ?,
        renewed_count = renewed_count + 1,
        status = 'issued',
        overdue_days = 0,
        fine_amount = ?,
        fine_updated_at = ?,
        remarks = COALESCE(?, remarks),
        updated_at = ?
      WHERE id = ?
    `,
    [
      nextDueAt,
      nextDueAt,
      aging.fineAmount,
      now,
      payload.remarks?.trim() || null,
      now,
      loan.id,
    ],
  )

  await dbRun(
    env.DB,
    `
      INSERT INTO loan_history (
        id,
        loan_id,
        event_type,
        previous_status,
        next_status,
        event_at,
        actor_user_id,
        note,
        metadata_json
      )
      VALUES (?, ?, 'renewed', ?, 'issued', ?, ?, ?, ?)
    `,
    [
      crypto.randomUUID(),
      loan.id,
      loan.status,
      now,
      actor.id,
      payload.remarks?.trim() || 'Loan renewed',
      JSON.stringify({ previousDueAt: loan.dueDate, dueAt: nextDueAt }),
    ],
  )

  const updated = await resolveLoanById(env.DB, loan.id)
  await writeAudit(
    env.DB,
    actor,
    'circulation.loan.renewed',
    'loan',
    loan.id,
    `Loan renewed for ${loan.memberNameBn}.`,
    {
      before: loan,
      after: updated,
      requestId: requestId ?? null,
    },
  )

  return { loan: updated }
}

export async function returnLoan(
  env: AppBindings,
  actor: SessionUser,
  payload: {
    loanId?: string
    copyBarcode?: string
    outcome: LoanResolutionCode
    condition?: LoanListItem['copyCondition']
    waiveFine: boolean
    finePaid: number
    paymentTypeCode?: string
    remarks?: string
  },
  requestId?: string | null,
): Promise<CirculationReturnResult> {
  const settings = await getCirculationSettings(env.DB, env)
  await refreshLoanSnapshots(env.DB, settings)

  const loan = await resolveActiveLoan(env.DB, {
    loanId: payload.loanId,
    copyBarcode: payload.copyBarcode,
  })
  const now = dhakaNow()
  const aging = calculateLoanAging(loan.dueDate, now, settings)
  const fineResult = await upsertFine(env.DB, actor, {
    loanId: loan.id,
    memberId: loan.memberId,
    assessedAmount: aging.fineAmount,
    waiveRemaining: payload.waiveFine,
    additionalPaidAmount: payload.finePaid,
    paymentTypeCode: payload.paymentTypeCode,
  })

  const nextLoanStatus = payload.outcome === 'lost' ? 'lost' : 'returned'
  const nextCondition =
    payload.condition ??
    (payload.outcome === 'repair'
      ? 'repair'
      : payload.outcome === 'withdrawn'
        ? 'withdrawn'
        : payload.outcome === 'lost'
          ? 'lost'
          : payload.outcome === 'damaged'
            ? 'damaged'
            : loan.copyCondition)
  const nextAvailability =
    payload.outcome === 'repair'
      ? 'repair'
      : payload.outcome === 'withdrawn'
        ? 'withdrawn'
        : payload.outcome === 'lost'
          ? 'lost'
          : 'available'

  await dbRun(
    env.DB,
    `
      UPDATE loans
      SET
        returned_at = ?,
        returned_by_user_id = ?,
        overdue_days = ?,
        fine_amount = ?,
        status = ?,
        resolution_code = ?,
        return_note = ?,
        remarks = COALESCE(?, remarks),
        fine_updated_at = ?,
        updated_at = ?
      WHERE id = ?
    `,
    [
      now,
      actor.id,
      aging.overdueDays,
      aging.fineAmount,
      nextLoanStatus,
      payload.outcome,
      payload.remarks?.trim() || null,
      payload.remarks?.trim() || null,
      now,
      now,
      loan.id,
    ],
  )

  await dbRun(
    env.DB,
    `
      UPDATE book_copies
      SET
        availability_status = ?,
        condition_status = ?,
        updated_at = ?
      WHERE id = ?
    `,
    [nextAvailability, nextCondition, now, loan.copyItemId],
  )

  if (nextAvailability === 'available') {
    await maybePromoteReservation(env, loan.bibliographicRecordId, loan.copyItemId)
  }

  await dbRun(
    env.DB,
    `
      INSERT INTO loan_history (
        id,
        loan_id,
        event_type,
        previous_status,
        next_status,
        event_at,
        actor_user_id,
        note,
        metadata_json
      )
      VALUES (?, ?, 'returned', ?, ?, ?, ?, ?, ?)
    `,
    [
      crypto.randomUUID(),
      loan.id,
      loan.status,
      nextLoanStatus,
      now,
      actor.id,
      payload.remarks?.trim() || 'Loan returned',
      JSON.stringify({
        outcome: payload.outcome,
        fineAmount: aging.fineAmount,
        finePaid: payload.finePaid,
      }),
    ],
  )

  const updated = await resolveLoanById(env.DB, loan.id)
  await writeAudit(
    env.DB,
    actor,
    'circulation.loan.returned',
    'loan',
    loan.id,
    `Loan returned for ${loan.memberNameBn}.`,
    {
      before: loan,
      after: updated,
      requestId: requestId ?? null,
    },
  )

  return {
    loan: updated,
    fineAmount: aging.fineAmount,
    finePaid: fineResult.paidAmount,
    outstandingFine: fineResult.outstandingAmount,
  }
}

export async function listReservations(
  db: D1Database,
  limit = 30,
): Promise<ReservationRecord[]> {
  return listReservationsInternal(db, limit)
}

export async function scheduleCirculationReminders(
  env: AppBindings,
): Promise<void> {
  const settings = await getCirculationSettings(env.DB, env)
  if (!settings.policy.reminderCronEnabled) {
    return
  }

  await refreshLoanSnapshots(env.DB, settings)
  const now = dhakaNow()
  const todayKey = now.slice(0, 10)
  const memberContacts = new Map<string, MemberRow>()

  async function getMemberContact(memberId: string) {
    if (!memberContacts.has(memberId)) {
      memberContacts.set(memberId, await resolveMember(env.DB, memberId))
    }
    return memberContacts.get(memberId)!
  }

  for (const rule of settings.reminderRules.filter((item) => item.enabled)) {
    const template = settings.reminderTemplates.find(
      (item) => item.key === rule.templateKey && item.enabled,
    )
    if (!template) {
      continue
    }

    if (rule.timing === 'before_due') {
      const targetStart = addDhakaDays(now, rule.offsetDays, { endOfDay: false })
      const targetEnd = addDhakaDays(now, rule.offsetDays, { endOfDay: true })
      const rows = await loadLoanRows(
        env.DB,
        `WHERE loans.status = 'issued' AND loans.due_at >= ? AND loans.due_at <= ?`,
        [targetStart, targetEnd],
      )
      for (const row of rows) {
        const loan = mapLoanRow(row)
        const member = await getMemberContact(loan.memberId)
        await createReminderIfMissing(env, settings, {
          loanId: loan.id,
          memberId: loan.memberId,
          reminderType: 'due_soon',
          channel: rule.channel,
          rule,
          template,
          scheduledFor: now,
          recipientAddress: rule.channel === 'email' ? member.email ?? '' : member.phone,
          dedupeKey: `${rule.key}:${loan.id}:${todayKey}`,
          replacements: {
            memberName: loan.memberNameBn,
            bookTitle: loan.title,
            dueDate: loan.dueDate.slice(0, 10),
            overdueDays: `${loan.overdueDays}`,
            fineAmount: `${loan.fineAmount}`,
            libraryName: env.APP_NAME_BN,
          },
        })
      }
    }

    if (rule.timing === 'after_due') {
      const targetStart = addDhakaDays(now, -rule.offsetDays, { endOfDay: false })
      const targetEnd = addDhakaDays(now, -rule.offsetDays, { endOfDay: true })
      const rows = await loadLoanRows(
        env.DB,
        `WHERE loans.status = 'overdue' AND loans.due_at >= ? AND loans.due_at <= ?`,
        [targetStart, targetEnd],
      )
      for (const row of rows) {
        const loan = mapLoanRow(row)
        const member = await getMemberContact(loan.memberId)
        await createReminderIfMissing(env, settings, {
          loanId: loan.id,
          memberId: loan.memberId,
          reminderType: 'overdue',
          channel: rule.channel,
          rule,
          template,
          scheduledFor: now,
          recipientAddress: rule.channel === 'email' ? member.email ?? '' : member.phone,
          dedupeKey: `${rule.key}:${loan.id}:${todayKey}`,
          replacements: {
            memberName: loan.memberNameBn,
            bookTitle: loan.title,
            dueDate: loan.dueDate.slice(0, 10),
            overdueDays: `${loan.overdueDays}`,
            fineAmount: `${loan.fineAmount}`,
            libraryName: env.APP_NAME_BN,
          },
        })
      }
    }
  }

  await dispatchPendingReminders(env)
}

export async function getReminderForDispatch(
  db: D1Database,
  reminderId: string,
): Promise<{
  id: string
  channel: ReminderChannel
  providerKey: string
  recipientAddress: string | null
  contentSnapshot: string | null
  payload: ReminderPayload
  retryCount: number
  deliveryStatus: ReminderLogRecord['status']
}> {
  const row = await dbFirst<{
    id: string
    channel: ReminderChannel
    providerKey: string
    recipientAddress: string | null
    contentSnapshot: string | null
    payloadJson: string | null
    retryCount: number
    deliveryStatus: ReminderLogRecord['status']
  }>(
    db,
    `
      SELECT
        id,
        channel,
        provider_key AS providerKey,
        recipient_address AS recipientAddress,
        content_snapshot AS contentSnapshot,
        payload_json AS payloadJson,
        retry_count AS retryCount,
        delivery_status AS deliveryStatus
      FROM reminders
      WHERE id = ?
      LIMIT 1
    `,
    [reminderId],
  )

  if (!row) {
    throw new Error('Reminder message not found.')
  }

  return {
    id: row.id,
    channel: row.channel,
    providerKey: row.providerKey,
    recipientAddress: row.recipientAddress,
    contentSnapshot: row.contentSnapshot,
    payload: jsonObject<ReminderPayload>(row.payloadJson, {
      body: row.contentSnapshot ?? '',
      subject: null,
      maxRetries: 0,
      retryDelayMinutes: 60,
    }),
    retryCount: row.retryCount,
    deliveryStatus: row.deliveryStatus,
  }
}

export async function markReminderSent(
  db: D1Database,
  reminderId: string,
  providerReference: string,
): Promise<void> {
  const now = dhakaNow()
  await dbRun(
    db,
    `
      UPDATE reminders
      SET
        sent_at = ?,
        status = 'sent',
        delivery_status = 'sent',
        provider_reference = ?,
        last_attempt_at = ?,
        next_retry_at = NULL,
        last_error = NULL
      WHERE id = ?
    `,
    [now, providerReference, now, reminderId],
  )
}

export async function markReminderFailed(
  db: D1Database,
  reminderId: string,
  errorMessage: string,
  payload: ReminderPayload,
  retryCount: number,
): Promise<void> {
  const now = dhakaNow()
  const nextRetryCount = retryCount + 1
  const canRetry = nextRetryCount <= payload.maxRetries
  const nextRetryAt = canRetry
    ? new Date(Date.now() + payload.retryDelayMinutes * 60 * 1000).toISOString()
    : null

  await dbRun(
    db,
    `
      UPDATE reminders
      SET
        status = ?,
        delivery_status = ?,
        retry_count = ?,
        last_attempt_at = ?,
        last_error = ?,
        next_retry_at = ?
      WHERE id = ?
    `,
    [
      canRetry ? 'queued' : 'failed',
      canRetry ? 'retried' : 'failed',
      nextRetryCount,
      now,
      errorMessage,
      nextRetryAt,
      reminderId,
    ],
  )
}
