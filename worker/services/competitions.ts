import type {
  CompetitionAdminDashboardPayload,
  CompetitionAdminDetail,
  CompetitionAdminRecord,
  CompetitionAdminRegistration,
  CompetitionAdminResult,
  CompetitionRegistrationAcknowledgement,
  PublicCompetitionDetail,
  PublicCompetitionListItem,
  PublicSiteSettings,
  SessionUser,
} from '@shared/index'
import {
  buildPublicCompetitionPath,
  buildPublicCompetitionResultsPath,
  dhakaNow,
  toSlug,
} from '@shared/utils'
import type { AppBindings } from '../types'
import { writeAudit } from '../lib/audit'
import { dbAll, dbFirst, dbRun, intToBool } from '../lib/db'
import { getPublicSiteSettings, savePublicSiteSettings } from '../lib/settings'
import { isCompetitionRegistrationOpen } from './public'

interface CompetitionRow {
  id: string
  slug: string
  titleBn: string
  titleEn: string | null
  description: string | null
  registrationFeeAmount: number | null
  registrationOpensAt: string | null
  registrationClosesAt: string | null
  eventDate: string | null
  resultPublishedAt: string | null
  status: CompetitionAdminRecord['status']
  visibleToPublic: number
  registrationCount: number | null
  confirmedRegistrationCount: number | null
  resultCount: number | null
  createdAt: string
  updatedAt: string
}

interface CompetitionRegistrationRow {
  id: string
  competitionId: string
  memberId: string | null
  paymentId: string | null
  participantName: string
  guardianName: string | null
  phone: string
  email: string | null
  categoryLabel: string | null
  status: CompetitionAdminRegistration['status']
  note: string | null
  submittedAt: string
}

interface CompetitionResultRow {
  id: string
  registrationId: string | null
  participantName: string | null
  phone: string | null
  categoryLabel: string | null
  positionRank: number | null
  positionLabel: string
  score: number | null
  publishedNote: string | null
  publishedAt: string | null
}

function sanitizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function optionalString(value: unknown): string | null {
  const normalized = sanitizeString(value)
  return normalized || null
}

function mapCompetitionRow(row: CompetitionRow): CompetitionAdminRecord {
  return {
    id: row.id,
    slug: row.slug,
    titleBn: row.titleBn,
    titleEn: row.titleEn,
    description: row.description,
    registrationFeeAmount: Number(row.registrationFeeAmount ?? 0),
    registrationOpensAt: row.registrationOpensAt,
    registrationClosesAt: row.registrationClosesAt,
    eventDate: row.eventDate,
    resultPublishedAt: row.resultPublishedAt,
    status: row.status,
    visibleToPublic: intToBool(row.visibleToPublic),
    registrationCount: Number(row.registrationCount ?? 0),
    confirmedRegistrationCount: Number(row.confirmedRegistrationCount ?? 0),
    resultCount: Number(row.resultCount ?? 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapRegistrationRow(row: CompetitionRegistrationRow): CompetitionAdminRegistration {
  return {
    id: row.id,
    competitionId: row.competitionId,
    memberId: row.memberId,
    paymentId: row.paymentId,
    participantName: row.participantName,
    guardianName: row.guardianName,
    phone: row.phone,
    email: row.email,
    categoryLabel: row.categoryLabel,
    status: row.status,
    note: row.note,
    submittedAt: row.submittedAt,
  }
}

function mapResultRow(row: CompetitionResultRow): CompetitionAdminResult {
  return {
    id: row.id,
    registrationId: row.registrationId,
    participantName: row.participantName,
    phone: row.phone,
    categoryLabel: row.categoryLabel,
    positionRank: row.positionRank,
    positionLabel: row.positionLabel,
    score: row.score,
    publishedNote: row.publishedNote,
    publishedAt: row.publishedAt,
  }
}

function competitionSelect() {
  return `
    SELECT
      competitions.id AS id,
      competitions.slug AS slug,
      competitions.title_bn AS titleBn,
      competitions.title_en AS titleEn,
      competitions.description AS description,
      competitions.registration_fee_amount AS registrationFeeAmount,
      competitions.registration_opens_at AS registrationOpensAt,
      competitions.registration_closes_at AS registrationClosesAt,
      competitions.event_date AS eventDate,
      competitions.result_published_at AS resultPublishedAt,
      competitions.status AS status,
      competitions.visible_to_public AS visibleToPublic,
      (
        SELECT COUNT(*)
        FROM competition_registrations
        WHERE competition_registrations.competition_id = competitions.id
      ) AS registrationCount,
      (
        SELECT COUNT(*)
        FROM competition_registrations
        WHERE competition_registrations.competition_id = competitions.id
          AND competition_registrations.status = 'confirmed'
      ) AS confirmedRegistrationCount,
      (
        SELECT COUNT(*)
        FROM competition_results
        WHERE competition_results.competition_id = competitions.id
      ) AS resultCount,
      competitions.created_at AS createdAt,
      competitions.updated_at AS updatedAt
    FROM competitions
  `
}

async function loadCompetitionById(
  db: D1Database,
  competitionId: string,
): Promise<CompetitionAdminRecord | null> {
  const row = await dbFirst<CompetitionRow>(
    db,
    `
      ${competitionSelect()}
      WHERE competitions.id = ?
        AND competitions.deleted_at IS NULL
      LIMIT 1
    `,
    [competitionId],
  )

  return row ? mapCompetitionRow(row) : null
}

async function loadCompetitionBySlug(
  db: D1Database,
  slug: string,
): Promise<CompetitionAdminRecord | null> {
  const row = await dbFirst<CompetitionRow>(
    db,
    `
      ${competitionSelect()}
      WHERE competitions.slug = ?
        AND competitions.deleted_at IS NULL
      LIMIT 1
    `,
    [slug],
  )

  return row ? mapCompetitionRow(row) : null
}

async function ensureUniqueSlug(
  db: D1Database,
  slug: string,
  existingCompetitionId?: string,
) {
  const row = await dbFirst<{ id: string }>(
    db,
    `
      SELECT id
      FROM competitions
      WHERE slug = ?
        AND deleted_at IS NULL
        AND (? = '' OR id <> ?)
      LIMIT 1
    `,
    [slug, existingCompetitionId ?? '', existingCompetitionId ?? ''],
  )

  if (row?.id) {
    throw new Error('এই slug ইতোমধ্যে ব্যবহৃত হচ্ছে।')
  }
}

async function listCompetitionRegistrations(
  db: D1Database,
  competitionId: string,
): Promise<CompetitionAdminRegistration[]> {
  const rows = await dbAll<CompetitionRegistrationRow>(
    db,
    `
      SELECT
        id,
        competition_id AS competitionId,
        member_id AS memberId,
        payment_id AS paymentId,
        participant_name AS participantName,
        guardian_name AS guardianName,
        phone,
        email,
        category_label AS categoryLabel,
        status,
        note,
        submitted_at AS submittedAt
      FROM competition_registrations
      WHERE competition_id = ?
      ORDER BY submitted_at DESC
    `,
    [competitionId],
  )

  return rows.map(mapRegistrationRow)
}

async function listCompetitionResults(
  db: D1Database,
  competitionId: string,
): Promise<CompetitionAdminResult[]> {
  const rows = await dbAll<CompetitionResultRow>(
    db,
    `
      SELECT
        competition_results.id AS id,
        competition_results.registration_id AS registrationId,
        competition_registrations.participant_name AS participantName,
        competition_registrations.phone AS phone,
        competition_registrations.category_label AS categoryLabel,
        competition_results.position_rank AS positionRank,
        competition_results.position_label AS positionLabel,
        competition_results.score AS score,
        competition_results.published_note AS publishedNote,
        competition_results.published_at AS publishedAt
      FROM competition_results
      LEFT JOIN competition_registrations
        ON competition_registrations.id = competition_results.registration_id
      WHERE competition_results.competition_id = ?
      ORDER BY
        CASE WHEN competition_results.position_rank IS NULL THEN 999999 ELSE competition_results.position_rank END ASC,
        competition_results.published_at DESC
    `,
    [competitionId],
  )

  return rows.map(mapResultRow)
}

export async function getCompetitionAdminDashboard(
  db: D1Database,
): Promise<CompetitionAdminDashboardPayload> {
  const rows = await dbAll<CompetitionRow>(
    db,
    `
      ${competitionSelect()}
      WHERE competitions.deleted_at IS NULL
      ORDER BY competitions.created_at DESC
    `,
  )

  return {
    competitions: rows.map(mapCompetitionRow),
    publicSettings: await getPublicSiteSettings(db),
  }
}

export async function getCompetitionAdminDetail(
  db: D1Database,
  competitionId: string,
): Promise<CompetitionAdminDetail | null> {
  const competition = await loadCompetitionById(db, competitionId)
  if (!competition) {
    return null
  }

  const [registrations, results] = await Promise.all([
    listCompetitionRegistrations(db, competitionId),
    listCompetitionResults(db, competitionId),
  ])

  return {
    competition,
    registrations,
    results,
  }
}

export async function createCompetition(
  env: AppBindings,
  actor: SessionUser,
  payload: {
    slug: string
    titleBn: string
    titleEn?: string
    description?: string
    registrationFeeAmount: number
    registrationOpensAt?: string
    registrationClosesAt?: string
    eventDate?: string
    resultPublishedAt?: string
    status: CompetitionAdminRecord['status']
    visibleToPublic: boolean
  },
  requestId?: string | null,
) {
  const slug = toSlug(payload.slug) || toSlug(payload.titleBn) || crypto.randomUUID()
  await ensureUniqueSlug(env.DB, slug)

  const competitionId = crypto.randomUUID()
  const now = dhakaNow()
  await dbRun(
    env.DB,
    `
      INSERT INTO competitions (
        id,
        slug,
        title_bn,
        title_en,
        description,
        registration_fee_amount,
        registration_opens_at,
        registration_closes_at,
        event_date,
        result_published_at,
        status,
        visible_to_public,
        created_by_user_id,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      competitionId,
      slug,
      payload.titleBn,
      optionalString(payload.titleEn),
      optionalString(payload.description),
      payload.registrationFeeAmount,
      optionalString(payload.registrationOpensAt),
      optionalString(payload.registrationClosesAt),
      optionalString(payload.eventDate),
      optionalString(payload.resultPublishedAt),
      payload.status,
      payload.visibleToPublic ? 1 : 0,
      actor.id,
      now,
      now,
    ],
  )

  const competition = await loadCompetitionById(env.DB, competitionId)
  if (!competition) {
    throw new Error('প্রতিযোগিতা তৈরি করা যায়নি।')
  }

  await writeAudit(
    env.DB,
    actor,
    'competitions.create',
    'competition',
    competitionId,
    'নতুন প্রতিযোগিতা তৈরি করা হয়েছে।',
    {
      requestId,
      after: competition,
    },
  )

  return competition
}

export async function updateCompetition(
  env: AppBindings,
  actor: SessionUser,
  competitionId: string,
  payload: {
    slug: string
    titleBn: string
    titleEn?: string
    description?: string
    registrationFeeAmount: number
    registrationOpensAt?: string
    registrationClosesAt?: string
    eventDate?: string
    resultPublishedAt?: string
    status: CompetitionAdminRecord['status']
    visibleToPublic: boolean
  },
  requestId?: string | null,
) {
  const before = await loadCompetitionById(env.DB, competitionId)
  if (!before) {
    throw new Error('প্রতিযোগিতা পাওয়া যায়নি।')
  }

  const slug = toSlug(payload.slug) || toSlug(payload.titleBn) || before.slug
  await ensureUniqueSlug(env.DB, slug, competitionId)

  await dbRun(
    env.DB,
    `
      UPDATE competitions
      SET
        slug = ?,
        title_bn = ?,
        title_en = ?,
        description = ?,
        registration_fee_amount = ?,
        registration_opens_at = ?,
        registration_closes_at = ?,
        event_date = ?,
        result_published_at = ?,
        status = ?,
        visible_to_public = ?,
        updated_at = ?
      WHERE id = ?
        AND deleted_at IS NULL
    `,
    [
      slug,
      payload.titleBn,
      optionalString(payload.titleEn),
      optionalString(payload.description),
      payload.registrationFeeAmount,
      optionalString(payload.registrationOpensAt),
      optionalString(payload.registrationClosesAt),
      optionalString(payload.eventDate),
      optionalString(payload.resultPublishedAt),
      payload.status,
      payload.visibleToPublic ? 1 : 0,
      dhakaNow(),
      competitionId,
    ],
  )

  const after = await loadCompetitionById(env.DB, competitionId)
  if (!after) {
    throw new Error('প্রতিযোগিতা হালনাগাদ করা যায়নি।')
  }

  await writeAudit(
    env.DB,
    actor,
    'competitions.update',
    'competition',
    competitionId,
    'প্রতিযোগিতা হালনাগাদ করা হয়েছে।',
    {
      requestId,
      before,
      after,
    },
  )

  return after
}

export async function replaceCompetitionResults(
  env: AppBindings,
  actor: SessionUser,
  competitionId: string,
  payload: {
    results: Array<{
      id?: string
      registrationId?: string
      positionRank?: number
      positionLabel: string
      score?: number
      publishedNote?: string
    }>
  },
  requestId?: string | null,
) {
  const before = await listCompetitionResults(env.DB, competitionId)
  await dbRun(env.DB, `DELETE FROM competition_results WHERE competition_id = ?`, [competitionId])

  for (const entry of payload.results) {
    const registrationId = sanitizeString(entry.registrationId)
    if (!registrationId) {
      continue
    }

    await dbRun(
      env.DB,
      `
        INSERT INTO competition_results (
          id,
          competition_id,
          registration_id,
          position_rank,
          position_label,
          score,
          published_note,
          published_at,
          created_by_user_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        sanitizeString(entry.id) || crypto.randomUUID(),
        competitionId,
        registrationId,
        entry.positionRank ?? null,
        entry.positionLabel,
        entry.score ?? null,
        optionalString(entry.publishedNote),
        dhakaNow(),
        actor.id,
      ],
    )
  }

  const after = await listCompetitionResults(env.DB, competitionId)
  await writeAudit(
    env.DB,
    actor,
    'competitions.update_results',
    'competition',
    competitionId,
    'প্রতিযোগিতার ফলাফল আপডেট করা হয়েছে।',
    {
      requestId,
      before,
      after,
    },
  )

  return after
}

export async function updateCompetitionPublicSettings(
  env: AppBindings,
  actor: SessionUser,
  settings: PublicSiteSettings,
  requestId?: string | null,
) {
  const before = await getPublicSiteSettings(env.DB)
  await savePublicSiteSettings(env.DB, actor.id, settings)
  const after = await getPublicSiteSettings(env.DB)

  await writeAudit(
    env.DB,
    actor,
    'competitions.update_public_settings',
    'app_settings',
    'public_site_settings',
    'পাবলিক প্রতিযোগিতা ও ক্যাটালগ দৃশ্যমানতা সেটিংস হালনাগাদ করা হয়েছে।',
    {
      requestId,
      before,
      after,
    },
  )

  return after
}

function mapPublicCompetition(
  competition: CompetitionAdminRecord,
  publicSettings: PublicSiteSettings,
): PublicCompetitionListItem {
  const registrationOpen = isCompetitionRegistrationOpen(
    competition.registrationOpensAt,
    competition.registrationClosesAt,
    competition.status,
  )
  const resultsPublished =
    publicSettings.competition.resultsVisible &&
    competition.status === 'published' &&
    competition.resultCount > 0

  return {
    id: competition.id,
    slug: competition.slug,
    titleBn: competition.titleBn,
    titleEn: competition.titleEn,
    description: competition.description,
    registrationFeeAmount: competition.registrationFeeAmount,
    registrationOpensAt: competition.registrationOpensAt,
    registrationClosesAt: competition.registrationClosesAt,
    eventDate: competition.eventDate,
    resultPublishedAt: competition.resultPublishedAt,
    status: competition.status,
    registrationOpen,
    resultsPublished,
    detailPath: buildPublicCompetitionPath(competition.slug),
    resultsPath: buildPublicCompetitionResultsPath(competition.slug),
  }
}

export async function listPublicCompetitions(
  db: D1Database,
): Promise<PublicCompetitionListItem[]> {
  const settings = await getPublicSiteSettings(db)
  const rows = await dbAll<CompetitionRow>(
    db,
    `
      ${competitionSelect()}
      WHERE competitions.deleted_at IS NULL
        AND competitions.visible_to_public = 1
        AND competitions.status IN ('open', 'closed', 'published')
      ORDER BY competitions.event_date DESC, competitions.created_at DESC
    `,
  )

  return rows.map((row) => mapPublicCompetition(mapCompetitionRow(row), settings))
}

export async function getPublicCompetitionDetail(
  db: D1Database,
  slug: string,
): Promise<PublicCompetitionDetail | null> {
  const settings = await getPublicSiteSettings(db)
  const competition = await loadCompetitionBySlug(db, slug)
  if (!competition || !competition.visibleToPublic || competition.status === 'draft') {
    return null
  }

  const results =
    settings.competition.resultsVisible && competition.status === 'published'
      ? await listCompetitionResults(db, competition.id)
      : []

  return {
    competition: mapPublicCompetition(competition, settings),
    results,
    registrationEnabled: isCompetitionRegistrationOpen(
      competition.registrationOpensAt,
      competition.registrationClosesAt,
      competition.status,
    ),
    resultVisibilityEnabled: settings.competition.resultsVisible,
  }
}

export async function registerPublicCompetition(
  env: AppBindings,
  payload: {
    competitionSlug: string
    participantName: string
    guardianName?: string
    phone: string
    email?: string
    category?: string
    note?: string
  },
  requestId?: string | null,
): Promise<CompetitionRegistrationAcknowledgement> {
  const competition = await loadCompetitionBySlug(env.DB, payload.competitionSlug)
  const publicSettings = await getPublicSiteSettings(env.DB)
  if (!competition || !competition.visibleToPublic) {
    throw new Error('প্রতিযোগিতা পাওয়া যায়নি।')
  }

  if (
    !isCompetitionRegistrationOpen(
      competition.registrationOpensAt,
      competition.registrationClosesAt,
      competition.status,
    )
  ) {
    throw new Error('এই প্রতিযোগিতার নিবন্ধন এখন খোলা নেই।')
  }

  const duplicate = await dbFirst<{ id: string }>(
    env.DB,
    `
      SELECT id
      FROM competition_registrations
      WHERE competition_id = ?
        AND phone = ?
        AND status IN ('pending', 'confirmed')
      LIMIT 1
    `,
    [competition.id, payload.phone],
  )
  if (duplicate?.id) {
    throw new Error('এই মোবাইল নম্বর দিয়ে ইতোমধ্যে নিবন্ধন করা হয়েছে।')
  }

  const registrationId = crypto.randomUUID()
  const status: CompetitionRegistrationAcknowledgement['status'] =
    competition.registrationFeeAmount > 0 ? 'pending' : 'confirmed'
  const now = dhakaNow()

  await dbRun(
    env.DB,
    `
      INSERT INTO competition_registrations (
        id,
        competition_id,
        participant_name,
        guardian_name,
        phone,
        email,
        category_label,
        status,
        note,
        submitted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      registrationId,
      competition.id,
      payload.participantName,
      optionalString(payload.guardianName),
      payload.phone,
      optionalString(payload.email),
      optionalString(payload.category),
      status,
      optionalString(payload.note),
      now,
    ],
  )

  await writeAudit(
    env.DB,
    null,
    'competitions.public_register',
    'competition_registration',
    registrationId,
    'পাবলিক প্রতিযোগিতা নিবন্ধন জমা হয়েছে।',
    {
      requestId,
      after: {
        competitionId: competition.id,
        participantName: payload.participantName,
        phone: payload.phone,
        status,
      },
    },
  )

  return {
    registrationId,
    competitionId: competition.id,
    competitionSlug: competition.slug,
    competitionTitleBn: competition.titleBn,
    participantName: payload.participantName,
    guardianName: optionalString(payload.guardianName),
    phone: payload.phone,
    email: optionalString(payload.email),
    categoryLabel: optionalString(payload.category),
    submittedAt: now,
    status,
    feeAmount: competition.registrationFeeAmount,
    paymentRequired: competition.registrationFeeAmount > 0,
    paymentIntegration: {
      enabled: competition.registrationFeeAmount > 0,
      status:
        competition.registrationFeeAmount > 0 ? 'manual_pending' : 'not_required',
      feeTypeCode: 'competition_fee',
      amount: competition.registrationFeeAmount,
    },
    acknowledgementPath: `/competitions/acknowledgements/${registrationId}`,
    printable: publicSettings.competition.printableAcknowledgement,
  }
}

export async function getCompetitionAcknowledgement(
  db: D1Database,
  registrationId: string,
): Promise<CompetitionRegistrationAcknowledgement | null> {
  const publicSettings = await getPublicSiteSettings(db)
  const row = await dbFirst<
    CompetitionRegistrationRow & {
      slug: string
      titleBn: string
      registrationFeeAmount: number | null
    }
  >(
    db,
    `
      SELECT
        competition_registrations.id AS id,
        competition_registrations.competition_id AS competitionId,
        competition_registrations.member_id AS memberId,
        competition_registrations.payment_id AS paymentId,
        competition_registrations.participant_name AS participantName,
        competition_registrations.guardian_name AS guardianName,
        competition_registrations.phone AS phone,
        competition_registrations.email AS email,
        competition_registrations.category_label AS categoryLabel,
        competition_registrations.status AS status,
        competition_registrations.note AS note,
        competition_registrations.submitted_at AS submittedAt,
        competitions.slug AS slug,
        competitions.title_bn AS titleBn,
        competitions.registration_fee_amount AS registrationFeeAmount
      FROM competition_registrations
      INNER JOIN competitions ON competitions.id = competition_registrations.competition_id
      WHERE competition_registrations.id = ?
      LIMIT 1
    `,
    [registrationId],
  )

  if (!row) {
    return null
  }

  const feeAmount = Number(row.registrationFeeAmount ?? 0)
  return {
    registrationId: row.id,
    competitionId: row.competitionId,
    competitionSlug: row.slug,
    competitionTitleBn: row.titleBn,
    participantName: row.participantName,
    guardianName: row.guardianName,
    phone: row.phone,
    email: row.email,
    categoryLabel: row.categoryLabel,
    submittedAt: row.submittedAt,
    status: row.status,
    feeAmount,
    paymentRequired: feeAmount > 0,
    paymentIntegration: {
      enabled: feeAmount > 0,
      status: feeAmount > 0 ? 'manual_pending' : 'not_required',
      feeTypeCode: 'competition_fee',
      amount: feeAmount,
    },
    acknowledgementPath: `/competitions/acknowledgements/${row.id}`,
    printable: publicSettings.competition.printableAcknowledgement,
  }
}
