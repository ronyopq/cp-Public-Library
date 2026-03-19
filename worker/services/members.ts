import QRCode from 'qrcode'
import type {
  Member,
  MemberCardPrintJobResult,
  MemberCardTemplate,
  MemberDuesSummary,
  MemberListingPayload,
  MemberLoanSnapshot,
  MemberPaymentSnapshot,
  MemberPaymentSummary,
  MemberProfileDetail,
  MemberStatus,
  SessionUser,
} from '@shared/index'
import { dhakaNow } from '@shared/utils'
import type { AppBindings } from '../types'
import { writeAudit } from '../lib/audit'
import { dbAll, dbFirst, dbRun } from '../lib/db'
import { buildR2Key, putFile } from '../lib/storage'

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
  memberStatus: MemberStatus
  photoKey: string | null
  notes: string | null
  updatedAt?: string
  deletedAt?: string | null
}

interface TemplateRow {
  id: string
  templateKey: string
  nameBn: string
  nameEn: string
  pageSize: string
  isDefault: number
  configJson: string
}

interface LoanRow {
  loanId: string
  copyItemId: string
  bibliographicRecordId: string
  accessionCode: string
  copyNumber: number
  title: string
  authorsJson: string | null
  issuedAt: string
  dueAt: string
  returnedAt: string | null
  renewedCount: number
  fineAccrued: number | null
  finePaid: number | null
  status: MemberLoanSnapshot['status']
}

interface PaymentRow {
  paymentId: string
  amount: number
  paymentTypeCode: string
  paymentTypeName: string
  paidAt: string
  referenceNo: string | null
  note: string | null
  status: string
}

function sanitizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function optionalString(value: unknown): string | null {
  const normalized = sanitizeString(value)
  return normalized || null
}

function jsonArray(value?: string | null): string[] {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map((item) => sanitizeString(item)).filter(Boolean) : []
  } catch {
    return []
  }
}

function derivedMemberStatusSql(alias = 'members') {
  return `
    CASE
      WHEN ${alias}.status = 'active'
        AND ${alias}.membership_expires_at IS NOT NULL
        AND ${alias}.membership_expires_at <> ''
        AND date(${alias}.membership_expires_at) < date('now')
      THEN 'expired'
      ELSE ${alias}.status
    END
  `
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
    deletedAt: row.deletedAt,
  }
}

function mapPaymentRow(row: PaymentRow): MemberPaymentSnapshot {
  return {
    paymentId: row.paymentId,
    amount: Number(row.amount ?? 0),
    paymentTypeCode: row.paymentTypeCode,
    paymentTypeName: row.paymentTypeName,
    paidAt: row.paidAt,
    referenceNo: row.referenceNo,
    note: row.note,
    status: row.status,
  }
}

function mapLoanRow(row: LoanRow): MemberLoanSnapshot {
  return {
    loanId: row.loanId,
    copyItemId: row.copyItemId,
    bibliographicRecordId: row.bibliographicRecordId,
    accessionCode: row.accessionCode,
    copyNumber: Number(row.copyNumber ?? 0),
    title: row.title,
    authors: jsonArray(row.authorsJson),
    issuedAt: row.issuedAt,
    dueAt: row.dueAt,
    returnedAt: row.returnedAt,
    renewedCount: Number(row.renewedCount ?? 0),
    fineAccrued: Number(row.fineAccrued ?? 0),
    finePaid: Number(row.finePaid ?? 0),
    status: row.status,
  }
}

function parseTemplate(row: TemplateRow): MemberCardTemplate {
  let config: MemberCardTemplate['config'] = {}
  try {
    config = JSON.parse(row.configJson) as MemberCardTemplate['config']
  } catch {
    config = {}
  }

  return {
    id: row.id,
    templateKey: row.templateKey,
    nameBn: row.nameBn,
    nameEn: row.nameEn,
    pageSize: row.pageSize,
    isDefault: Number(row.isDefault ?? 0) === 1,
    config,
  }
}

function generateMemberCode(libraryCode: string) {
  const year = new Date().getFullYear()
  return `${libraryCode}-MEM-${year}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
}

async function ensureUniqueMemberCode(
  db: D1Database,
  libraryCode: string,
  requestedCode?: string,
) {
  const preferredCode = sanitizeString(requestedCode)
  if (preferredCode) {
    const existing = await dbFirst<{ id: string }>(
      db,
      `SELECT id FROM members WHERE member_no = ? AND deleted_at IS NULL LIMIT 1`,
      [preferredCode],
    )
    if (existing) {
      throw new Error('এই membership ID ইতোমধ্যে ব্যবহৃত হয়েছে।')
    }
    return preferredCode
  }

  while (true) {
    const nextCode = generateMemberCode(libraryCode)
    const existing = await dbFirst<{ id: string }>(
      db,
      `SELECT id FROM members WHERE member_no = ? LIMIT 1`,
      [nextCode],
    )
    if (!existing) {
      return nextCode
    }
  }
}

async function loadMemberById(
  db: D1Database,
  memberId: string,
  includeDeleted = false,
): Promise<Member | null> {
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
        ${derivedMemberStatusSql()} AS memberStatus,
        photo_r2_key AS photoKey,
        note AS notes,
        updated_at AS updatedAt,
        deleted_at AS deletedAt
      FROM members
      WHERE id = ?
        ${includeDeleted ? '' : 'AND deleted_at IS NULL'}
      LIMIT 1
    `,
    [memberId],
  )

  return row ? mapMember(row) : null
}

async function listMemberLoans(
  db: D1Database,
  memberId: string,
  clause: string,
  limit = 12,
) {
  const rows = await dbAll<LoanRow>(
    db,
    `
      SELECT
        loans.id AS loanId,
        book_copies.id AS copyItemId,
        bibliographic_records.id AS bibliographicRecordId,
        book_copies.accession_code AS accessionCode,
        book_copies.copy_number AS copyNumber,
        COALESCE(bibliographic_records.title_bn, bibliographic_records.title_en) AS title,
        (
          SELECT COALESCE(json_group_array(item.contributor_name_en), '[]')
          FROM (
            SELECT contributor_name_en
            FROM book_contributors
            WHERE bibliographic_record_id = bibliographic_records.id
              AND contributor_role = 'author'
            ORDER BY sort_order ASC
          ) AS item
        ) AS authorsJson,
        loans.issued_at AS issuedAt,
        loans.due_at AS dueAt,
        loans.returned_at AS returnedAt,
        loans.renewed_count AS renewedCount,
        (
          SELECT COALESCE(SUM(assessed_amount), 0)
          FROM fines
          WHERE fines.loan_id = loans.id
        ) AS fineAccrued,
        (
          SELECT COALESCE(SUM(paid_amount), 0)
          FROM fines
          WHERE fines.loan_id = loans.id
        ) AS finePaid,
        loans.status AS status
      FROM loans
      INNER JOIN book_copies ON book_copies.id = loans.book_copy_id
      INNER JOIN bibliographic_records ON bibliographic_records.id = book_copies.bibliographic_record_id
      WHERE loans.member_id = ?
        ${clause}
      ORDER BY loans.issued_at DESC
      LIMIT ?
    `,
    [memberId, limit],
  )

  return rows.map(mapLoanRow)
}

async function loadMemberDuesSummary(
  db: D1Database,
  memberId: string,
): Promise<MemberDuesSummary> {
  const row = await dbFirst<{
    fineAssessedAmount: number | null
    fineWaivedAmount: number | null
    finePaidAmount: number | null
    fineOutstandingAmount: number | null
    duesAssessedAmount: number | null
    duesWaivedAmount: number | null
    duesPaidAmount: number | null
    duesOutstandingAmount: number | null
    openFineCount: number | null
  }>(
    db,
    `
      SELECT
        (
          SELECT COALESCE(SUM(assessed_amount), 0)
          FROM fines
          WHERE fines.member_id = ?
        ) AS fineAssessedAmount,
        (
          SELECT COALESCE(SUM(waived_amount), 0)
          FROM fines
          WHERE fines.member_id = ?
        ) AS fineWaivedAmount,
        (
          SELECT COALESCE(SUM(paid_amount), 0)
          FROM fines
          WHERE fines.member_id = ?
        ) AS finePaidAmount,
        (
          SELECT COALESCE(SUM(assessed_amount - waived_amount - paid_amount), 0)
          FROM fines
          WHERE fines.member_id = ?
        ) AS fineOutstandingAmount,
        (
          SELECT COALESCE(SUM(expected_amount), 0)
          FROM member_fee_periods
          WHERE member_fee_periods.member_id = ?
            AND member_fee_periods.deleted_at IS NULL
        ) AS duesAssessedAmount,
        (
          SELECT COALESCE(SUM(waived_amount), 0)
          FROM member_fee_periods
          WHERE member_fee_periods.member_id = ?
            AND member_fee_periods.deleted_at IS NULL
        ) AS duesWaivedAmount,
        (
          SELECT COALESCE(SUM(paid_amount), 0)
          FROM member_fee_periods
          WHERE member_fee_periods.member_id = ?
            AND member_fee_periods.deleted_at IS NULL
        ) AS duesPaidAmount,
        (
          SELECT COALESCE(SUM(expected_amount - waived_amount - paid_amount), 0)
          FROM member_fee_periods
          WHERE member_fee_periods.member_id = ?
            AND member_fee_periods.deleted_at IS NULL
        ) AS duesOutstandingAmount,
        (
          SELECT COALESCE(SUM(CASE WHEN status IN ('open', 'partial') THEN 1 ELSE 0 END), 0)
          FROM fines
          WHERE fines.member_id = ?
        ) AS openFineCount
    `,
    [memberId, memberId, memberId, memberId, memberId, memberId, memberId, memberId, memberId],
  )

  return {
    assessedAmount:
      Number(row?.fineAssessedAmount ?? 0) + Number(row?.duesAssessedAmount ?? 0),
    waivedAmount:
      Number(row?.fineWaivedAmount ?? 0) + Number(row?.duesWaivedAmount ?? 0),
    paidAmount: Number(row?.finePaidAmount ?? 0) + Number(row?.duesPaidAmount ?? 0),
    outstandingAmount:
      Number(row?.fineOutstandingAmount ?? 0) + Number(row?.duesOutstandingAmount ?? 0),
    openFineCount: Number(row?.openFineCount ?? 0),
  }
}

async function loadMemberPaymentSummary(
  db: D1Database,
  memberId: string,
): Promise<MemberPaymentSummary> {
  const row = await dbFirst<{
    totalPaidAmount: number | null
    paymentCount: number | null
    lastPaidAt: string | null
  }>(
    db,
    `
      SELECT
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) AS totalPaidAmount,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS paymentCount,
        MAX(CASE WHEN status = 'completed' THEN paid_at ELSE NULL END) AS lastPaidAt
      FROM payments
      WHERE member_id = ?
    `,
    [memberId],
  )

  return {
    totalPaidAmount: Number(row?.totalPaidAmount ?? 0),
    paymentCount: Number(row?.paymentCount ?? 0),
    lastPaidAt: row?.lastPaidAt ?? null,
  }
}

async function loadRecentPayments(db: D1Database, memberId: string) {
  const rows = await dbAll<PaymentRow>(
    db,
    `
      SELECT
        payments.id AS paymentId,
        payments.amount AS amount,
        payment_types.payment_type_code AS paymentTypeCode,
        COALESCE(payment_types.name_bn, payment_types.name_en) AS paymentTypeName,
        payments.paid_at AS paidAt,
        payments.reference_no AS referenceNo,
        payments.note AS note,
        payments.status AS status
      FROM payments
      INNER JOIN payment_types ON payment_types.id = payments.payment_type_id
      WHERE payments.member_id = ?
      ORDER BY payments.paid_at DESC, payments.created_at DESC
      LIMIT 12
    `,
    [memberId],
  )

  return rows.map(mapPaymentRow)
}

export async function listMembers(
  db: D1Database,
  options: { search: string; page: number; pageSize: number; status?: string },
): Promise<MemberListingPayload> {
  const likeSearch = `%${sanitizeString(options.search)}%`
  const statusFilter = sanitizeString(options.status)
  const derivedStatus = derivedMemberStatusSql()

  const items = await dbAll<
    MemberRow & {
      activeLoanCount: number | null
      totalLoanCount: number | null
      outstandingDue: number | null
      totalPaid: number | null
      hasLinkedUser: number | null
    }
  >(
    db,
    `
      SELECT
        members.id AS id,
        members.member_no AS memberCode,
        members.full_name_bn AS fullNameBn,
        members.full_name_en AS fullNameEn,
        members.guardian_name AS guardianName,
        members.email AS email,
        members.phone AS phone,
        members.national_id AS nationalId,
        members.address_line AS addressLine,
        members.area AS area,
        members.district AS district,
        members.date_of_birth AS dateOfBirth,
        members.joined_at AS joinedAt,
        members.membership_expires_at AS membershipExpiresAt,
        ${derivedStatus} AS memberStatus,
        members.photo_r2_key AS photoKey,
        members.note AS notes,
        members.updated_at AS updatedAt,
        (
          SELECT COUNT(*)
          FROM loans
          WHERE loans.member_id = members.id
            AND loans.status IN ('issued', 'overdue')
        ) AS activeLoanCount,
        (
          SELECT COUNT(*)
          FROM loans
          WHERE loans.member_id = members.id
        ) AS totalLoanCount,
        (
          SELECT COALESCE(SUM(assessed_amount - waived_amount - paid_amount), 0)
          FROM fines
          WHERE fines.member_id = members.id
            AND fines.status IN ('open', 'partial')
        ) AS outstandingDue,
        (
          SELECT COALESCE(SUM(amount), 0)
          FROM payments
          WHERE payments.member_id = members.id
            AND payments.status = 'completed'
        ) AS totalPaid,
        CASE
          WHEN members.user_id IS NULL THEN 0
          ELSE 1
        END AS hasLinkedUser
      FROM members
      WHERE members.deleted_at IS NULL
        AND (
          ? = '%%'
          OR members.member_no LIKE ?
          OR members.full_name_bn LIKE ?
          OR COALESCE(members.full_name_en, '') LIKE ?
          OR members.phone LIKE ?
        )
        AND (
          ? = ''
          OR ${derivedStatus} = ?
        )
      ORDER BY members.created_at DESC
      LIMIT ? OFFSET ?
    `,
    [
      likeSearch,
      likeSearch,
      likeSearch,
      likeSearch,
      likeSearch,
      statusFilter,
      statusFilter,
      options.pageSize,
      (options.page - 1) * options.pageSize,
    ],
  )

  const totalRow = await dbFirst<{ total: number }>(
    db,
    `
      SELECT COUNT(*) AS total
      FROM members
      WHERE deleted_at IS NULL
        AND (
          ? = '%%'
          OR member_no LIKE ?
          OR full_name_bn LIKE ?
          OR COALESCE(full_name_en, '') LIKE ?
          OR phone LIKE ?
        )
        AND (
          ? = ''
          OR ${derivedStatus} = ?
        )
    `,
    [likeSearch, likeSearch, likeSearch, likeSearch, likeSearch, statusFilter, statusFilter],
  )

  const statsRow = await dbFirst<{
    totalMembers: number | null
    activeMembers: number | null
    expiringSoon: number | null
    membersWithDues: number | null
  }>(
    db,
    `
      SELECT
        COUNT(*) AS totalMembers,
        SUM(CASE WHEN ${derivedStatus} = 'active' THEN 1 ELSE 0 END) AS activeMembers,
        SUM(
          CASE
            WHEN members.status = 'active'
              AND members.membership_expires_at IS NOT NULL
              AND members.membership_expires_at <> ''
              AND date(members.membership_expires_at) BETWEEN date('now') AND date('now', '+30 day')
            THEN 1
            ELSE 0
          END
        ) AS expiringSoon,
        SUM(
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM fines
              WHERE fines.member_id = members.id
                AND fines.status IN ('open', 'partial')
            )
            THEN 1
            ELSE 0
          END
        ) AS membersWithDues
      FROM members
      WHERE deleted_at IS NULL
    `,
  )

  return {
    items: items.map((row) => ({
      ...mapMember(row),
      activeLoanCount: Number(row.activeLoanCount ?? 0),
      totalLoanCount: Number(row.totalLoanCount ?? 0),
      outstandingDue: Number(row.outstandingDue ?? 0),
      totalPaid: Number(row.totalPaid ?? 0),
      hasLinkedUser: Number(row.hasLinkedUser ?? 0) === 1,
      updatedAt: row.updatedAt ?? row.joinedAt,
    })),
    page: options.page,
    pageSize: options.pageSize,
    total: Number(totalRow?.total ?? 0),
    stats: {
      totalMembers: Number(statsRow?.totalMembers ?? 0),
      activeMembers: Number(statsRow?.activeMembers ?? 0),
      expiringSoon: Number(statsRow?.expiringSoon ?? 0),
      membersWithDues: Number(statsRow?.membersWithDues ?? 0),
    },
  }
}

export async function listArchivedMembers(
  db: D1Database,
  options: { search: string; page: number; pageSize: number },
) {
  const likeSearch = `%${sanitizeString(options.search)}%`
  const items = await dbAll<MemberRow>(
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
        ${derivedMemberStatusSql()} AS memberStatus,
        photo_r2_key AS photoKey,
        note AS notes,
        updated_at AS updatedAt,
        deleted_at AS deletedAt
      FROM members
      WHERE deleted_at IS NOT NULL
        AND (
          ? = '%%'
          OR member_no LIKE ?
          OR full_name_bn LIKE ?
          OR COALESCE(full_name_en, '') LIKE ?
          OR phone LIKE ?
        )
      ORDER BY deleted_at DESC
      LIMIT ? OFFSET ?
    `,
    [
      likeSearch,
      likeSearch,
      likeSearch,
      likeSearch,
      likeSearch,
      options.pageSize,
      (options.page - 1) * options.pageSize,
    ],
  )

  const totalRow = await dbFirst<{ total: number }>(
    db,
    `
      SELECT COUNT(*) AS total
      FROM members
      WHERE deleted_at IS NOT NULL
        AND (
          ? = '%%'
          OR member_no LIKE ?
          OR full_name_bn LIKE ?
          OR COALESCE(full_name_en, '') LIKE ?
          OR phone LIKE ?
        )
    `,
    [likeSearch, likeSearch, likeSearch, likeSearch, likeSearch],
  )

  return {
    items: items.map(mapMember),
    page: options.page,
    pageSize: options.pageSize,
    total: Number(totalRow?.total ?? 0),
  }
}

export async function getMemberProfile(
  db: D1Database,
  memberId: string,
): Promise<MemberProfileDetail | null> {
  const member = await loadMemberById(db, memberId)
  if (!member) {
    return null
  }

  const [currentBorrowedBooks, borrowingHistory, returnHistory, dues, paymentSummary, recentPayments] =
    await Promise.all([
      listMemberLoans(db, memberId, `AND loans.status IN ('issued', 'overdue')`, 12),
      listMemberLoans(db, memberId, '', 20),
      listMemberLoans(db, memberId, `AND loans.returned_at IS NOT NULL`, 20),
      loadMemberDuesSummary(db, memberId),
      loadMemberPaymentSummary(db, memberId),
      loadRecentPayments(db, memberId),
    ])

  return {
    member,
    currentBorrowedBooks,
    borrowingHistory,
    returnHistory,
    dues,
    paymentSummary,
    recentPayments,
  }
}

export async function getSelfMemberProfile(
  db: D1Database,
  userId: string,
): Promise<MemberProfileDetail | null> {
  const row = await dbFirst<{ id: string }>(
    db,
    `SELECT id FROM members WHERE user_id = ? AND deleted_at IS NULL LIMIT 1`,
    [userId],
  )

  return row?.id ? getMemberProfile(db, row.id) : null
}

export async function uploadMemberPhoto(env: AppBindings, file: File) {
  const key = buildR2Key('members', file.name)
  await putFile(env.MEDIA_BUCKET, key, file, {
    assetKind: 'member_photo',
  })

  return {
    key,
    url: `/files/${encodeURIComponent(key)}`,
    fileName: file.name,
    contentType: file.type,
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function createMember(
  env: AppBindings,
  actor: SessionUser,
  payload: {
    memberCode?: string
    fullNameBn: string
    fullNameEn?: string
    guardianName?: string
    email?: string
    phone: string
    nationalId?: string
    addressLine: string
    area?: string
    district?: string
    dateOfBirth?: string
    joinedAt?: string
    membershipExpiresAt?: string
    memberStatus: MemberStatus
    photoKey?: string
    notes?: string
  },
  requestId?: string | null,
) {
  const now = dhakaNow()
  const memberId = crypto.randomUUID()
  const memberCode = await ensureUniqueMemberCode(env.DB, env.LIBRARY_CODE, payload.memberCode)

  await dbRun(
    env.DB,
    `
      INSERT INTO members (
        id,
        member_no,
        full_name_bn,
        full_name_en,
        guardian_name,
        email,
        phone,
        national_id,
        date_of_birth,
        address_line,
        area,
        district,
        joined_at,
        membership_expires_at,
        status,
        photo_r2_key,
        note,
        created_by_user_id,
        updated_by_user_id,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      memberId,
      memberCode,
      payload.fullNameBn,
      optionalString(payload.fullNameEn),
      optionalString(payload.guardianName),
      optionalString(payload.email),
      payload.phone,
      optionalString(payload.nationalId),
      optionalString(payload.dateOfBirth),
      payload.addressLine,
      optionalString(payload.area),
      optionalString(payload.district),
      optionalString(payload.joinedAt) ?? now.slice(0, 10),
      optionalString(payload.membershipExpiresAt),
      payload.memberStatus,
      optionalString(payload.photoKey),
      optionalString(payload.notes),
      actor.id,
      actor.id,
      now,
      now,
    ],
  )

  const member = await loadMemberById(env.DB, memberId)
  if (!member) {
    throw new Error('সদস্য প্রোফাইল তৈরি করা যায়নি।')
  }

  await writeAudit(
    env.DB,
    actor,
    'members.create',
    'member',
    memberId,
    'নতুন সদস্য প্রোফাইল তৈরি করা হয়েছে।',
    {
      requestId,
      after: member,
    },
  )

  return member
}

export async function updateMember(
  env: AppBindings,
  actor: SessionUser,
  memberId: string,
  payload: {
    fullNameBn: string
    fullNameEn?: string
    guardianName?: string
    email?: string
    phone: string
    nationalId?: string
    addressLine: string
    area?: string
    district?: string
    dateOfBirth?: string
    joinedAt?: string
    membershipExpiresAt?: string
    memberStatus: MemberStatus
    photoKey?: string
    notes?: string
  },
  requestId?: string | null,
) {
  const before = await loadMemberById(env.DB, memberId)
  if (!before) {
    throw new Error('সদস্য প্রোফাইল পাওয়া যায়নি।')
  }

  await dbRun(
    env.DB,
    `
      UPDATE members
      SET
        full_name_bn = ?,
        full_name_en = ?,
        guardian_name = ?,
        email = ?,
        phone = ?,
        national_id = ?,
        date_of_birth = ?,
        address_line = ?,
        area = ?,
        district = ?,
        joined_at = ?,
        membership_expires_at = ?,
        status = ?,
        photo_r2_key = ?,
        note = ?,
        updated_by_user_id = ?,
        updated_at = ?
      WHERE id = ?
        AND deleted_at IS NULL
    `,
    [
      payload.fullNameBn,
      optionalString(payload.fullNameEn),
      optionalString(payload.guardianName),
      optionalString(payload.email),
      payload.phone,
      optionalString(payload.nationalId),
      optionalString(payload.dateOfBirth),
      payload.addressLine,
      optionalString(payload.area),
      optionalString(payload.district),
      optionalString(payload.joinedAt) ?? before.joinedAt.slice(0, 10),
      optionalString(payload.membershipExpiresAt),
      payload.memberStatus,
      optionalString(payload.photoKey),
      optionalString(payload.notes),
      actor.id,
      dhakaNow(),
      memberId,
    ],
  )

  const after = await loadMemberById(env.DB, memberId)
  if (!after) {
    throw new Error('সদস্য প্রোফাইল হালনাগাদ করা যায়নি।')
  }

  await writeAudit(
    env.DB,
    actor,
    'members.update',
    'member',
    memberId,
    'সদস্য প্রোফাইল হালনাগাদ করা হয়েছে।',
    {
      requestId,
      before,
      after,
    },
  )

  return after
}

export async function archiveMember(
  env: AppBindings,
  actor: SessionUser,
  memberId: string,
  requestId?: string | null,
) {
  const before = await loadMemberById(env.DB, memberId)
  if (!before) {
    throw new Error('সদস্য প্রোফাইল পাওয়া যায়নি।')
  }

  const activeLoan = await dbFirst<{ total: number }>(
    env.DB,
    `
      SELECT COUNT(*) AS total
      FROM loans
      WHERE member_id = ?
        AND status IN ('issued', 'overdue')
    `,
    [memberId],
  )
  if (Number(activeLoan?.total ?? 0) > 0) {
    throw new Error('সক্রিয় ইস্যু থাকা অবস্থায় সদস্য আর্কাইভ করা যাবে না।')
  }

  await dbRun(
    env.DB,
    `
      UPDATE members
      SET
        deleted_at = ?,
        updated_by_user_id = ?,
        updated_at = ?
      WHERE id = ?
        AND deleted_at IS NULL
    `,
    [dhakaNow(), actor.id, dhakaNow(), memberId],
  )

  await writeAudit(
    env.DB,
    actor,
    'members.archive',
    'member',
    memberId,
    'সদস্য প্রোফাইল soft delete করা হয়েছে।',
    {
      requestId,
      before,
      after: { deletedAt: dhakaNow() },
    },
  )
}

export async function restoreMember(
  env: AppBindings,
  actor: SessionUser,
  memberId: string,
  requestId?: string | null,
) {
  const before = await loadMemberById(env.DB, memberId, true)
  if (!before || !before.deletedAt) {
    throw new Error('আর্কাইভ করা সদস্য প্রোফাইল পাওয়া যায়নি।')
  }

  await dbRun(
    env.DB,
    `
      UPDATE members
      SET
        deleted_at = NULL,
        updated_by_user_id = ?,
        updated_at = ?
      WHERE id = ?
        AND deleted_at IS NOT NULL
    `,
    [actor.id, dhakaNow(), memberId],
  )

  const after = await loadMemberById(env.DB, memberId)
  if (!after) {
    throw new Error('সদস্য প্রোফাইল পুনরুদ্ধার করা যায়নি।')
  }

  await writeAudit(
    env.DB,
    actor,
    'members.restore',
    'member',
    memberId,
    'আর্কাইভ করা সদস্য প্রোফাইল পুনরুদ্ধার করা হয়েছে।',
    {
      before,
      after,
      requestId,
    },
  )

  return after
}

export async function listMemberCardTemplates(
  db: D1Database,
): Promise<MemberCardTemplate[]> {
  const rows = await dbAll<TemplateRow>(
    db,
    `
      SELECT
        id,
        template_key AS templateKey,
        name_bn AS nameBn,
        name_en AS nameEn,
        page_size AS pageSize,
        is_default AS isDefault,
        config_json AS configJson
      FROM print_templates
      WHERE template_type = 'member_card'
        AND active = 1
        AND deleted_at IS NULL
      ORDER BY is_default DESC, updated_at DESC
    `,
  )

  return rows.map(parseTemplate)
}

async function resolveMemberCardTemplate(
  db: D1Database,
  templateId?: string | null,
): Promise<MemberCardTemplate> {
  const rows = await listMemberCardTemplates(db)
  const selected = templateId
    ? rows.find((item) => item.id === templateId)
    : rows.find((item) => item.isDefault) ?? rows[0]

  if (!selected) {
    throw new Error('সদস্য আইডি কার্ড টেমপ্লেট পাওয়া যায়নি।')
  }

  return selected
}

async function buildMemberCardHtml(
  members: Member[],
  template: MemberCardTemplate,
  origin: string,
) {
  const accentColor = sanitizeString(template.config.accentColor) || '#0d3b66'
  const showPhoto = template.config.showPhoto !== false
  const showQr = template.config.showQr !== false
  const footerText =
    sanitizeString(template.config.footerText) || 'Community Library Member Card'
  const qrCodes = showQr
    ? await Promise.all(
        members.map((member) =>
          QRCode.toDataURL(`${origin}/app/members?member=${member.id}`, {
            margin: 0,
            width: 180,
          }),
        ),
      )
    : members.map(() => '')

  const cardsHtml = members
    .map((member, index) => {
      const photoUrl = member.photoKey
        ? `${origin}/files/${encodeURIComponent(member.photoKey)}`
        : null
      const initials = escapeHtml(member.fullNameBn.slice(0, 2).toUpperCase())
      const address = escapeHtml(
        [member.addressLine, member.area, member.district].filter(Boolean).join(', '),
      )

      return `
        <article class="member-card">
          <header class="member-card__header">
            <div>
              <p class="member-card__eyebrow">লাইব্রেরি সদস্য</p>
              <h1>${escapeHtml(member.fullNameBn)}</h1>
              <p class="member-card__meta">${escapeHtml(member.memberCode)}</p>
            </div>
            <div class="member-card__status">${escapeHtml(member.memberStatus)}</div>
          </header>

          <section class="member-card__body">
            ${
              showPhoto
                ? `
              <div class="member-card__photo">
                ${
                  photoUrl
                    ? `<img src="${photoUrl}" alt="${escapeHtml(member.fullNameBn)}" />`
                    : `<span>${initials}</span>`
                }
              </div>
            `
                : ''
            }

            <div class="member-card__details">
              <div>
                <span>মোবাইল</span>
                <strong>${escapeHtml(member.phone)}</strong>
              </div>
              <div>
                <span>যোগদানের তারিখ</span>
                <strong>${escapeHtml(member.joinedAt.slice(0, 10))}</strong>
              </div>
              <div>
                <span>মেয়াদ</span>
                <strong>${escapeHtml(member.membershipExpiresAt ?? 'N/A')}</strong>
              </div>
              <div>
                <span>ঠিকানা</span>
                <strong>${address || 'N/A'}</strong>
              </div>
            </div>

            ${
              showQr
                ? `
              <div class="member-card__qr">
                <img src="${qrCodes[index]}" alt="QR code" />
              </div>
            `
                : ''
            }
          </section>

          <footer class="member-card__footer">
            <span>${escapeHtml(footerText)}</span>
          </footer>
        </article>
      `
    })
    .join('')

  const pageSize =
    template.pageSize.toUpperCase() === 'CR80' ? '86mm 54mm' : escapeHtml(template.pageSize)

  return `
    <!doctype html>
    <html lang="bn">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(template.nameBn)} - Member Cards</title>
        <style>
          :root { --accent: ${accentColor}; --line: rgba(24, 33, 47, 0.12); }
          * { box-sizing: border-box; }
          @page { size: ${pageSize}; margin: 8mm; }
          body { margin: 0; font-family: "Hind Siliguri", sans-serif; background: #f5f0e6; color: #18212f; }
          .print-toolbar { position: sticky; top: 0; z-index: 10; display: flex; justify-content: space-between; gap: 1rem; padding: 1rem 1.25rem; background: rgba(255,255,255,0.96); border-bottom: 1px solid var(--line); }
          .print-toolbar button { border: none; border-radius: 999px; padding: 0.75rem 1rem; background: var(--accent); color: #fff; font-weight: 700; cursor: pointer; }
          .member-card-grid { display: grid; gap: 1rem; padding: 1rem; }
          .member-card { width: 100%; max-width: 86mm; min-height: 54mm; padding: 1rem; background: linear-gradient(160deg, var(--accent), #1f4f77); color: #fff; border-radius: 1.4rem; box-shadow: 0 18px 40px rgba(13, 59, 102, 0.22); break-inside: avoid; }
          .member-card__header, .member-card__body { display: flex; justify-content: space-between; gap: 0.9rem; }
          .member-card__eyebrow { margin: 0 0 0.2rem; font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.8; }
          .member-card h1 { margin: 0; font-size: 1rem; line-height: 1.15; }
          .member-card__meta, .member-card__footer, .member-card__details span { color: rgba(255,255,255,0.82); font-size: 0.72rem; }
          .member-card__status { padding: 0.32rem 0.65rem; border-radius: 999px; background: rgba(255,255,255,0.16); font-size: 0.72rem; align-self: flex-start; }
          .member-card__body { margin-top: 0.9rem; align-items: stretch; }
          .member-card__photo { width: 4.2rem; min-width: 4.2rem; height: 4.8rem; border-radius: 1rem; background: rgba(255,255,255,0.18); overflow: hidden; display: grid; place-items: center; font-size: 1.4rem; font-weight: 700; }
          .member-card__photo img { width: 100%; height: 100%; object-fit: cover; }
          .member-card__details { flex: 1; display: grid; gap: 0.45rem; }
          .member-card__details strong { display: block; font-size: 0.78rem; line-height: 1.2; }
          .member-card__qr { width: 3.2rem; min-width: 3.2rem; align-self: end; }
          .member-card__qr img { width: 100%; display: block; border-radius: 0.75rem; background: #fff; padding: 0.2rem; }
          .member-card__footer { margin-top: 0.75rem; }
          @media print {
            body { background: #fff; }
            .print-toolbar { display: none; }
            .member-card-grid { padding: 0; }
            .member-card { box-shadow: none; margin: 0 auto; page-break-after: always; }
          }
        </style>
      </head>
      <body>
        <div class="print-toolbar">
          <div>
            <strong>${escapeHtml(template.nameBn)}</strong>
            <p>${members.length} টি সদস্য কার্ড</p>
          </div>
          <button type="button" onclick="window.print()">প্রিন্ট করুন</button>
        </div>
        <main class="member-card-grid">${cardsHtml}</main>
      </body>
    </html>
  `
}

export async function createMemberCardPrintJob(
  env: AppBindings,
  actor: SessionUser,
  origin: string,
  payload: { memberIds: string[]; templateId?: string },
  requestId?: string | null,
): Promise<MemberCardPrintJobResult> {
  const template = await resolveMemberCardTemplate(env.DB, payload.templateId)
  const members: Member[] = []

  for (const memberId of payload.memberIds) {
    const member = await loadMemberById(env.DB, memberId)
    if (member) {
      members.push(member)
    }
  }

  if (members.length === 0) {
    throw new Error('প্রিন্টের জন্য বৈধ সদস্য পাওয়া যায়নি।')
  }

  const jobId = crypto.randomUUID()
  await dbRun(
    env.DB,
    `
      INSERT INTO print_jobs (
        id,
        template_id,
        job_type,
        entity_type,
        entity_ids_json,
        requested_by_user_id,
        status,
        created_at,
        started_at
      )
      VALUES (?, ?, 'member_card', 'member', ?, ?, 'processing', ?, ?)
    `,
    [
      jobId,
      template.id,
      JSON.stringify(members.map((member) => member.id)),
      actor.id,
      dhakaNow(),
      dhakaNow(),
    ],
  )

  const html = await buildMemberCardHtml(members, template, origin)
  const fileName = `${template.templateKey}-${Date.now()}.html`
  const outputKey = buildR2Key('exports', fileName)
  const htmlFile = new File([html], fileName, {
    type: 'text/html; charset=utf-8',
  })
  await putFile(env.MEDIA_BUCKET, outputKey, htmlFile, {
    jobType: 'member_card',
    templateKey: template.templateKey,
    requestedBy: actor.id,
  })

  await dbRun(
    env.DB,
    `
      UPDATE print_jobs
      SET
        status = 'completed',
        output_r2_key = ?,
        completed_at = ?
      WHERE id = ?
    `,
    [outputKey, dhakaNow(), jobId],
  )

  await writeAudit(
    env.DB,
    actor,
    'members.print_cards',
    'print_job',
    jobId,
    'সদস্য আইডি কার্ড প্রিন্ট জব তৈরি করা হয়েছে।',
    {
      requestId,
      after: {
        templateId: template.id,
        memberIds: members.map((member) => member.id),
        outputKey,
      },
    },
  )

  return {
    jobId,
    template,
    memberCount: members.length,
    outputKey,
    outputUrl: `/files/${encodeURIComponent(outputKey)}`,
  }
}
