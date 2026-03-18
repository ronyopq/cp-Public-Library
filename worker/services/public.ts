import type {
  PublicBookDetail,
  PublicCatalogFilters,
  PublicCatalogListItem,
  PublicCatalogPayload,
  PublicCatalogQuery,
  PublicQrResolution,
  PublicSiteSettings,
} from '@shared/index'
import {
  buildPublicBookPath,
  dhakaNow,
  normalizeText,
} from '@shared/utils'
import type { AppBindings } from '../types'
import { dbAll, dbFirst, jsonArray } from '../lib/db'
import { getPublicSiteSettings } from '../lib/settings'

interface PublicRecordRow {
  id: string
  title: string
  subtitle: string | null
  authorsJson: string | null
  publisherId: string | null
  publisherName: string | null
  languageCode: string | null
  languageName: string | null
  categoryId: string | null
  categoryName: string | null
  subcategoryName: string | null
  publicationYear: number | null
  edition: string | null
  pageCount: number | null
  summary: string | null
  tagsJson: string | null
  coverImageKey: string | null
  coverThumbnailKey: string | null
  totalCopies: number | null
  availableCopies: number | null
  popularityScore: number | null
  createdAt: string
  qrShortCode: string | null
}

interface FilterRow {
  value: string
  labelBn: string
  labelEn: string | null
  total: number | null
}

function sanitizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toFileUrl(key?: string | null) {
  return key ? `/files/${encodeURIComponent(key)}` : null
}

function visibilityLabel(availableCopies: number | null, totalCopies: number | null) {
  if (Number(availableCopies ?? 0) > 0) {
    return 'এখন পাওয়া যাচ্ছে'
  }

  if (Number(totalCopies ?? 0) > 0) {
    return 'সব কপি বর্তমানে ইস্যু আছে'
  }

  return 'কপি তথ্য আপডেট হচ্ছে'
}

function mapPublicRecord(
  row: PublicRecordRow,
  settings: PublicSiteSettings,
): PublicCatalogListItem {
  const item: PublicCatalogListItem = {
    id: row.id,
    title: row.title,
    subtitle: settings.catalogFields.subtitle ? row.subtitle : null,
    authors: settings.catalogFields.authors ? jsonArray(row.authorsJson) : [],
    publisherId: settings.catalogFields.publisher ? row.publisherId : null,
    publisherName: settings.catalogFields.publisher ? row.publisherName : null,
    languageCode: settings.catalogFields.language ? row.languageCode : null,
    languageName: settings.catalogFields.language ? row.languageName : null,
    categoryId: settings.catalogFields.category ? row.categoryId : null,
    categoryName: settings.catalogFields.category ? row.categoryName : null,
    publicationYear: settings.catalogFields.publicationYear ? row.publicationYear : null,
    edition: settings.catalogFields.edition ? row.edition : null,
    pageCount: settings.catalogFields.pageCount ? row.pageCount : null,
    summary: settings.catalogFields.summary ? row.summary : null,
    tags: settings.catalogFields.tags ? jsonArray(row.tagsJson) : [],
    coverImageUrl: settings.catalogFields.cover ? toFileUrl(row.coverImageKey) : null,
    coverThumbnailUrl: settings.catalogFields.cover
      ? toFileUrl(row.coverThumbnailKey ?? row.coverImageKey)
      : null,
    totalCopies: settings.catalogFields.availability
      ? Number(row.totalCopies ?? 0)
      : undefined,
    availableCopies: settings.catalogFields.availability
      ? Number(row.availableCopies ?? 0)
      : undefined,
    popularityScore: Number(row.popularityScore ?? 0),
    createdAt: row.createdAt,
    detailPath: buildPublicBookPath(row.id, row.title),
  }

  return item
}

function catalogBaseSelect() {
  return `
    SELECT
      bibliographic_records.id AS id,
      COALESCE(bibliographic_records.title_bn, bibliographic_records.title_en) AS title,
      COALESCE(bibliographic_records.subtitle_bn, bibliographic_records.subtitle_en) AS subtitle,
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
      bibliographic_records.publisher_id AS publisherId,
      COALESCE(publishers.name_bn, publishers.name_en) AS publisherName,
      languages.iso_code AS languageCode,
      COALESCE(languages.name_bn, languages.name_en) AS languageName,
      categories.id AS categoryId,
      COALESCE(categories.name_bn, categories.name_en) AS categoryName,
      COALESCE(subcategories.name_bn, subcategories.name_en) AS subcategoryName,
      bibliographic_records.publication_year AS publicationYear,
      bibliographic_records.edition_statement AS edition,
      bibliographic_records.number_of_pages AS pageCount,
      bibliographic_records.summary AS summary,
      bibliographic_records.subject_keywords AS tagsJson,
      bibliographic_records.cover_r2_key AS coverImageKey,
      bibliographic_records.cover_thumbnail_r2_key AS coverThumbnailKey,
      (
        SELECT COUNT(*)
        FROM book_copies
        WHERE book_copies.bibliographic_record_id = bibliographic_records.id
          AND book_copies.deleted_at IS NULL
      ) AS totalCopies,
      (
        SELECT COUNT(*)
        FROM book_copies
        WHERE book_copies.bibliographic_record_id = bibliographic_records.id
          AND book_copies.deleted_at IS NULL
          AND book_copies.availability_status = 'available'
      ) AS availableCopies,
      (
        SELECT COUNT(*)
        FROM loans
        INNER JOIN book_copies ON book_copies.id = loans.book_copy_id
        WHERE book_copies.bibliographic_record_id = bibliographic_records.id
      ) AS popularityScore,
      (
        SELECT qr_links.short_code
        FROM qr_links
        INNER JOIN book_copies ON book_copies.id = qr_links.entity_id
        WHERE qr_links.entity_type = 'book_copy'
          AND qr_links.is_active = 1
          AND book_copies.bibliographic_record_id = bibliographic_records.id
        ORDER BY qr_links.created_at ASC
        LIMIT 1
      ) AS qrShortCode,
      bibliographic_records.created_at AS createdAt
    FROM bibliographic_records
    LEFT JOIN publishers ON publishers.id = bibliographic_records.publisher_id
    LEFT JOIN languages ON languages.id = bibliographic_records.language_id
    LEFT JOIN categories ON categories.id = bibliographic_records.primary_category_id
    LEFT JOIN categories AS subcategories ON subcategories.id = bibliographic_records.subcategory_id
  `
}

function publicCatalogWhere() {
  return `
    bibliographic_records.deleted_at IS NULL
    AND bibliographic_records.public_visibility = 1
    AND bibliographic_records.metadata_status = 'active'
  `
}

async function loadPublicCatalogFilters(db: D1Database): Promise<PublicCatalogFilters> {
  const [categories, authors, publishers, languages] = await Promise.all([
    dbAll<FilterRow>(
      db,
      `
        SELECT
          categories.id AS value,
          categories.name_bn AS labelBn,
          categories.name_en AS labelEn,
          COUNT(DISTINCT bibliographic_records.id) AS total
        FROM categories
        INNER JOIN bibliographic_records
          ON bibliographic_records.primary_category_id = categories.id
        WHERE ${publicCatalogWhere()}
        GROUP BY categories.id, categories.name_bn, categories.name_en
        ORDER BY categories.sort_order ASC, categories.name_bn ASC
      `,
    ),
    dbAll<FilterRow>(
      db,
      `
        SELECT
          book_contributors.contributor_name_en AS value,
          book_contributors.contributor_name_en AS labelBn,
          book_contributors.contributor_name_en AS labelEn,
          COUNT(DISTINCT bibliographic_records.id) AS total
        FROM book_contributors
        INNER JOIN bibliographic_records
          ON bibliographic_records.id = book_contributors.bibliographic_record_id
        WHERE ${publicCatalogWhere()}
          AND book_contributors.contributor_role = 'author'
        GROUP BY book_contributors.contributor_name_en
        ORDER BY total DESC, book_contributors.contributor_name_en ASC
        LIMIT 60
      `,
    ),
    dbAll<FilterRow>(
      db,
      `
        SELECT
          publishers.id AS value,
          publishers.name_bn AS labelBn,
          publishers.name_en AS labelEn,
          COUNT(DISTINCT bibliographic_records.id) AS total
        FROM publishers
        INNER JOIN bibliographic_records
          ON bibliographic_records.publisher_id = publishers.id
        WHERE ${publicCatalogWhere()}
        GROUP BY publishers.id, publishers.name_bn, publishers.name_en
        ORDER BY total DESC, publishers.name_bn ASC
        LIMIT 60
      `,
    ),
    dbAll<FilterRow>(
      db,
      `
        SELECT
          languages.iso_code AS value,
          languages.name_bn AS labelBn,
          languages.name_en AS labelEn,
          COUNT(DISTINCT bibliographic_records.id) AS total
        FROM languages
        INNER JOIN bibliographic_records
          ON bibliographic_records.language_id = languages.id
        WHERE ${publicCatalogWhere()}
        GROUP BY languages.iso_code, languages.name_bn, languages.name_en
        ORDER BY languages.name_bn ASC
      `,
    ),
  ])

  return {
    categories: categories.map((row) => ({
      value: row.value,
      labelBn: row.labelBn,
      labelEn: row.labelEn,
      total: Number(row.total ?? 0),
    })),
    authors: authors.map((row) => ({
      value: row.value,
      labelBn: row.labelBn,
      labelEn: row.labelEn,
      total: Number(row.total ?? 0),
    })),
    publishers: publishers.map((row) => ({
      value: row.value,
      labelBn: row.labelBn,
      labelEn: row.labelEn,
      total: Number(row.total ?? 0),
    })),
    languages: languages.map((row) => ({
      value: row.value,
      labelBn: row.labelBn,
      labelEn: row.labelEn,
      total: Number(row.total ?? 0),
    })),
  }
}

export function parsePublicCatalogQuery(searchParams: URLSearchParams): PublicCatalogQuery {
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const pageSize = Math.max(
    1,
    Math.min(48, Number(searchParams.get('pageSize') ?? 12)),
  )
  const availabilityParam = sanitizeString(searchParams.get('availability'))
  const sortParam = sanitizeString(searchParams.get('sort'))

  return {
    search: sanitizeString(searchParams.get('search')),
    categoryId: sanitizeString(searchParams.get('categoryId')) || undefined,
    author: sanitizeString(searchParams.get('author')) || undefined,
    publisherId: sanitizeString(searchParams.get('publisherId')) || undefined,
    languageCode: sanitizeString(searchParams.get('languageCode')) || undefined,
    availability:
      availabilityParam === 'available' || availabilityParam === 'unavailable'
        ? availabilityParam
        : 'all',
    sort: sortParam === 'popular' ? 'popular' : 'newest',
    page,
    pageSize,
  }
}

export async function listPublicCatalog(
  env: AppBindings,
  query: PublicCatalogQuery,
): Promise<PublicCatalogPayload> {
  const settings = await getPublicSiteSettings(env.DB)
  const filters = await loadPublicCatalogFilters(env.DB)
  const conditions = [publicCatalogWhere()]
  const bindings: unknown[] = []

  const normalizedSearch = normalizeText(query.search)
  if (normalizedSearch) {
    conditions.push(
      `(bibliographic_records.search_blob LIKE ? OR bibliographic_records.normalized_title LIKE ? OR bibliographic_records.normalized_authors LIKE ?)`,
    )
    const likeValue = `%${normalizedSearch}%`
    bindings.push(likeValue, likeValue, likeValue)
  }

  if (query.categoryId) {
    conditions.push(`(bibliographic_records.primary_category_id = ? OR bibliographic_records.subcategory_id = ?)`)
    bindings.push(query.categoryId, query.categoryId)
  }

  if (query.author) {
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM book_contributors
        WHERE book_contributors.bibliographic_record_id = bibliographic_records.id
          AND book_contributors.contributor_role = 'author'
          AND lower(book_contributors.contributor_name_en) LIKE lower(?)
      )
    `)
    bindings.push(`%${query.author}%`)
  }

  if (query.publisherId) {
    conditions.push(`bibliographic_records.publisher_id = ?`)
    bindings.push(query.publisherId)
  }

  if (query.languageCode) {
    conditions.push(`languages.iso_code = ?`)
    bindings.push(query.languageCode)
  }

  if (query.availability === 'available') {
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM book_copies
        WHERE book_copies.bibliographic_record_id = bibliographic_records.id
          AND book_copies.deleted_at IS NULL
          AND book_copies.availability_status = 'available'
      )
    `)
  }

  if (query.availability === 'unavailable') {
    conditions.push(`
      NOT EXISTS (
        SELECT 1
        FROM book_copies
        WHERE book_copies.bibliographic_record_id = bibliographic_records.id
          AND book_copies.deleted_at IS NULL
          AND book_copies.availability_status = 'available'
      )
    `)
  }

  const whereClause = conditions.join(' AND ')
  const orderBy =
    query.sort === 'popular'
      ? `popularityScore DESC, availableCopies DESC, bibliographic_records.created_at DESC`
      : `bibliographic_records.created_at DESC, bibliographic_records.publication_year DESC`

  const rows = await dbAll<PublicRecordRow>(
    env.DB,
    `
      ${catalogBaseSelect()}
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `,
    [...bindings, query.pageSize, (query.page - 1) * query.pageSize],
  )

  const totalRow = await dbFirst<{ total: number }>(
    env.DB,
    `
      SELECT COUNT(*) AS total
      FROM bibliographic_records
      LEFT JOIN languages ON languages.id = bibliographic_records.language_id
      WHERE ${whereClause}
    `,
    bindings,
  )

  return {
    items: rows.map((row) => mapPublicRecord(row, settings)),
    filters,
    query,
    page: query.page,
    pageSize: query.pageSize,
    total: Number(totalRow?.total ?? 0),
  }
}

export async function getPublicBookDetail(
  env: AppBindings,
  recordId: string,
): Promise<PublicBookDetail | null> {
  const settings = await getPublicSiteSettings(env.DB)
  const row = await dbFirst<PublicRecordRow>(
    env.DB,
    `
      ${catalogBaseSelect()}
      WHERE ${publicCatalogWhere()}
        AND bibliographic_records.id = ?
      LIMIT 1
    `,
    [recordId],
  )

  if (!row) {
    return null
  }

  const relatedRows = await dbAll<PublicRecordRow>(
    env.DB,
    `
      ${catalogBaseSelect()}
      WHERE ${publicCatalogWhere()}
        AND bibliographic_records.id <> ?
        AND (
          bibliographic_records.primary_category_id = ?
          OR bibliographic_records.publisher_id = ?
        )
      ORDER BY popularityScore DESC, bibliographic_records.created_at DESC
      LIMIT 4
    `,
    [recordId, row.categoryId, row.publisherId],
  )

  const book = mapPublicRecord(row, settings)

  return {
    book: {
      ...book,
      subcategoryName: settings.catalogFields.category ? row.subcategoryName : null,
      availabilityLabelBn: settings.catalogFields.availability
        ? visibilityLabel(row.availableCopies, row.totalCopies)
        : 'উপলভ্যতার তথ্য গোপন রাখা হয়েছে',
      qrPath: row.qrShortCode ? `/qr/${encodeURIComponent(row.qrShortCode)}` : null,
    },
    relatedBooks: relatedRows.map((item) => mapPublicRecord(item, settings)),
  }
}

export async function resolvePublicQr(
  db: D1Database,
  shortCode: string,
): Promise<PublicQrResolution | null> {
  const row = await dbFirst<{
    shortCode: string
    entityType: string
    entityId: string
    targetPath: string
    recordId: string | null
    title: string | null
  }>(
    db,
    `
      SELECT
        qr_links.short_code AS shortCode,
        qr_links.entity_type AS entityType,
        qr_links.entity_id AS entityId,
        qr_links.target_path AS targetPath,
        bibliographic_records.id AS recordId,
        COALESCE(bibliographic_records.title_bn, bibliographic_records.title_en) AS title
      FROM qr_links
      LEFT JOIN book_copies ON book_copies.id = qr_links.entity_id
      LEFT JOIN bibliographic_records
        ON bibliographic_records.id = COALESCE(
          book_copies.bibliographic_record_id,
          CASE
            WHEN qr_links.entity_type = 'bibliographic_record' THEN qr_links.entity_id
            ELSE NULL
          END
        )
      WHERE qr_links.short_code = ?
        AND qr_links.is_active = 1
      LIMIT 1
    `,
    [shortCode],
  )

  if (!row) {
    return null
  }

  const destinationPath =
    row.recordId && row.title
      ? buildPublicBookPath(row.recordId, row.title)
      : sanitizeString(row.targetPath) || '/catalog'

  return {
    shortCode: row.shortCode,
    entityType: row.entityType,
    entityId: row.entityId,
    destinationPath,
    destinationLabelBn: 'পাবলিক বইয়ের পাতা',
  }
}

export function isCompetitionRegistrationOpen(
  opensAt?: string | null,
  closesAt?: string | null,
  status?: string | null,
) {
  if (status && status !== 'open') {
    return false
  }

  const now = new Date(dhakaNow()).getTime()
  const opens = opensAt ? new Date(opensAt).getTime() : null
  const closes = closesAt ? new Date(closesAt).getTime() : null

  if (opens && now < opens) {
    return false
  }

  if (closes && now > closes) {
    return false
  }

  return true
}
