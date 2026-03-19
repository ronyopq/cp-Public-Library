import type {
  BibliographicRecord,
  BookIntakeDraft,
  CatalogOption,
  CatalogOptionsPayload,
  CatalogSaveResult,
  CopyItem,
  DuplicateCandidate,
  DuplicateResolutionStrategy,
  IntakeAsset,
  SessionUser,
} from '@shared/index'
import {
  buildPublicBookPath,
  dhakaNow,
  normalizeText,
  similarityScore,
  toSlug,
} from '@shared/utils'
import type { AppBindings } from '../types'
import { writeAudit } from '../lib/audit'
import {
  boolToInt,
  dbAll,
  dbFirst,
  dbRun,
  intToBool,
  jsonArray,
} from '../lib/db'
import { buildR2Key, putFile } from '../lib/storage'

type CatalogContributorRole = 'author' | 'co_author' | 'editor' | 'translator'

interface BibliographicRow {
  id: string
  recordCode: string | null
  isbn10: string | null
  isbn13: string | null
  titleBn: string | null
  titleEn: string
  subtitleBn: string | null
  subtitleEn: string | null
  edition: string | null
  publicationYear: number | null
  pageCount: number | null
  summary: string | null
  tagsJson: string | null
  coverImageKey: string | null
  coverThumbnailKey: string | null
  metadataPageKey: string | null
  sourceUrl: string | null
  sourceNote: string | null
  notes: string | null
  publicVisibility: number
  recordStatus: BibliographicRecord['recordStatus']
  createdAt: string
  updatedAt: string
  publisherId: string | null
  publisherName: string | null
  languageCode: string | null
  categoryId: string | null
  categoryName: string | null
  subcategoryId: string | null
  subcategoryName: string | null
  authorsJson: string | null
  coAuthorsJson: string | null
  editorsJson: string | null
  translatorsJson: string | null
}

interface DraftSeedInput {
  isbn?: string
  sourceUrl?: string
  manualTitle?: string
  manualAuthor?: string
  manualPublisher?: string
  coverImageKey?: string | null
  coverThumbnailKey?: string | null
  metadataPageKey?: string | null
  notes?: string
  pageImage?: File | null
}

interface SaveIntakePayload {
  seed: {
    isbn?: string
    sourceUrl?: string
    manualTitle?: string
    manualAuthor?: string
    manualPublisher?: string
    metadataPageKey?: string
    notes?: string
  }
  record: {
    recordCode?: string
    isbn10?: string
    isbn13?: string
    titleBn?: string
    titleEn?: string
    subtitleBn?: string
    subtitleEn?: string
    authors: string[]
    coAuthors: string[]
    editors: string[]
    translators: string[]
    publisherId?: string
    publisherName?: string
    edition?: string
    languageCode: string
    publicationYear?: number
    pageCount?: number
    categoryId?: string
    subcategoryId?: string
    tags: string[]
    summary?: string
    notes?: string
    publicVisibility: boolean
    coverImageKey?: string
    coverThumbnailKey?: string
    metadataPageKey?: string
    sourceUrl?: string
    sourceNote?: string
    recordStatus?: BibliographicRecord['recordStatus']
  }
  copies: {
    quantity: number
    condition: CopyItem['condition']
    acquisitionType: CopyItem['acquisitionType']
    acquisitionDate?: string
    acquisitionPrice?: number
    acquisitionSource?: string
    invoiceReference?: string
    vendorName?: string
    locationRoom?: string
    locationRack?: string
    locationShelf?: string
    notes?: string
  }
  duplicateResolution: {
    strategy: DuplicateResolutionStrategy
    existingRecordId?: string
  }
}

function contributorSubquery(role: CatalogContributorRole, alias: string) {
  return `
    (
      SELECT COALESCE(json_group_array(item.contributor_name_en), '[]')
      FROM (
        SELECT contributor_name_en
        FROM book_contributors
        WHERE bibliographic_record_id = bibliographic_records.id
          AND contributor_role = '${role}'
        ORDER BY sort_order ASC
      ) AS item
    ) AS ${alias}
  `
}

const bibliographicSelect = `
  SELECT
    bibliographic_records.id AS id,
    bibliographic_records.record_code AS recordCode,
    bibliographic_records.isbn_10 AS isbn10,
    bibliographic_records.isbn_13 AS isbn13,
    bibliographic_records.title_bn AS titleBn,
    bibliographic_records.title_en AS titleEn,
    bibliographic_records.subtitle_bn AS subtitleBn,
    bibliographic_records.subtitle_en AS subtitleEn,
    bibliographic_records.edition_statement AS edition,
    bibliographic_records.publication_year AS publicationYear,
    bibliographic_records.number_of_pages AS pageCount,
    bibliographic_records.summary AS summary,
    bibliographic_records.subject_keywords AS tagsJson,
    bibliographic_records.cover_r2_key AS coverImageKey,
    bibliographic_records.cover_thumbnail_r2_key AS coverThumbnailKey,
    bibliographic_records.metadata_page_r2_key AS metadataPageKey,
    bibliographic_records.source_url AS sourceUrl,
    bibliographic_records.source_note AS sourceNote,
    bibliographic_records.internal_note AS notes,
    bibliographic_records.public_visibility AS publicVisibility,
    bibliographic_records.metadata_status AS recordStatus,
    bibliographic_records.created_at AS createdAt,
    bibliographic_records.updated_at AS updatedAt,
    bibliographic_records.publisher_id AS publisherId,
    COALESCE(publishers.name_bn, publishers.name_en) AS publisherName,
    languages.iso_code AS languageCode,
    categories.id AS categoryId,
    COALESCE(categories.name_bn, categories.name_en) AS categoryName,
    subcategories.id AS subcategoryId,
    COALESCE(subcategories.name_bn, subcategories.name_en) AS subcategoryName,
    ${contributorSubquery('author', 'authorsJson')},
    ${contributorSubquery('co_author', 'coAuthorsJson')},
    ${contributorSubquery('editor', 'editorsJson')},
    ${contributorSubquery('translator', 'translatorsJson')}
  FROM bibliographic_records
  LEFT JOIN publishers ON publishers.id = bibliographic_records.publisher_id
  LEFT JOIN languages ON languages.id = bibliographic_records.language_id
  LEFT JOIN categories ON categories.id = bibliographic_records.primary_category_id
  LEFT JOIN categories AS subcategories ON subcategories.id = bibliographic_records.subcategory_id
`

function sanitizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function sanitizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return []
  }

  return [...new Set(values.map((value) => sanitizeString(value)).filter(Boolean))]
}

function optionalString(value: unknown): string | null {
  const normalized = sanitizeString(value)
  return normalized || null
}

function normalizeIsbn(raw: string | null | undefined) {
  const cleaned = sanitizeString(raw).replace(/[^0-9X]/gi, '').toUpperCase()
  if (cleaned.length === 10) {
    return { isbn10: cleaned, isbn13: null as string | null }
  }
  if (cleaned.length === 13) {
    return { isbn10: null as string | null, isbn13: cleaned }
  }
  return { isbn10: null as string | null, isbn13: null as string | null }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim()
}

function extractMetaContent(html: string, selectors: string[]): string | null {
  for (const selector of selectors) {
    const expression = new RegExp(
      `<meta[^>]+(?:property|name)=["']${selector}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      'i',
    )
    const match = html.match(expression)
    if (match?.[1]) {
      return stripHtml(match[1])
    }
  }

  return null
}

function extractJsonLdObjects(html: string): unknown[] {
  const matches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  return matches
    .map((match) => match[1]?.trim())
    .filter(Boolean)
    .flatMap((content) => {
      try {
        const parsed = JSON.parse(content as string)
        if (Array.isArray(parsed)) {
          return parsed
        }
        return [parsed]
      } catch {
        return []
      }
    })
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const normalized = sanitizeString(value)
    if (normalized) {
      return normalized
    }
  }

  return null
}

function mergeMetadata(
  current: Partial<BibliographicRecord>,
  incoming: Partial<BibliographicRecord>,
): Partial<BibliographicRecord> {
  return {
    ...incoming,
    ...current,
    recordCode: current.recordCode || incoming.recordCode || null,
    isbn10: current.isbn10 || incoming.isbn10 || null,
    isbn13: current.isbn13 || incoming.isbn13 || null,
    titleBn: current.titleBn || incoming.titleBn || null,
    titleEn: current.titleEn || incoming.titleEn || '',
    subtitleBn: current.subtitleBn || incoming.subtitleBn || null,
    subtitleEn: current.subtitleEn || incoming.subtitleEn || null,
    authors:
      current.authors && current.authors.length > 0
        ? sanitizeStringArray(current.authors)
        : sanitizeStringArray(incoming.authors),
    coAuthors:
      current.coAuthors && current.coAuthors.length > 0
        ? sanitizeStringArray(current.coAuthors)
        : sanitizeStringArray(incoming.coAuthors),
    editors:
      current.editors && current.editors.length > 0
        ? sanitizeStringArray(current.editors)
        : sanitizeStringArray(incoming.editors),
    translators:
      current.translators && current.translators.length > 0
        ? sanitizeStringArray(current.translators)
        : sanitizeStringArray(incoming.translators),
    publisherId: current.publisherId || incoming.publisherId || null,
    publisherName: current.publisherName || incoming.publisherName || null,
    edition: current.edition || incoming.edition || null,
    languageCode: current.languageCode || incoming.languageCode || 'bn',
    publicationYear: current.publicationYear ?? incoming.publicationYear ?? null,
    pageCount: current.pageCount ?? incoming.pageCount ?? null,
    categoryId: current.categoryId || incoming.categoryId || null,
    subcategoryId: current.subcategoryId || incoming.subcategoryId || null,
    tags: [...new Set([...(incoming.tags ?? []), ...(current.tags ?? [])])],
    summary: current.summary || incoming.summary || null,
    notes: current.notes || incoming.notes || null,
    publicVisibility: current.publicVisibility ?? incoming.publicVisibility ?? true,
    coverImageKey: current.coverImageKey || incoming.coverImageKey || null,
    coverThumbnailKey: current.coverThumbnailKey || incoming.coverThumbnailKey || null,
    metadataPageKey: current.metadataPageKey || incoming.metadataPageKey || null,
    sourceUrl: current.sourceUrl || incoming.sourceUrl || null,
    sourceNote: current.sourceNote || incoming.sourceNote || null,
    recordStatus: current.recordStatus || incoming.recordStatus || 'draft',
  }
}

function getCompleteness(metadata: Partial<BibliographicRecord>) {
  return {
    title: Boolean(metadata.titleBn || metadata.titleEn),
    authors: Boolean((metadata.authors?.length ?? 0) > 0),
    publisher: Boolean(metadata.publisherName || metadata.publisherId),
    publicationYear: Boolean(metadata.publicationYear),
    isbn: Boolean(metadata.isbn10 || metadata.isbn13),
    language: Boolean(metadata.languageCode),
    cover: Boolean(metadata.coverImageKey),
  }
}

function requiresMetadataPage(metadata: Partial<BibliographicRecord>) {
  const completeness = getCompleteness(metadata)
  return !completeness.title || (!completeness.authors && !completeness.isbn)
}

function mapBibliographicRow(row: BibliographicRow): BibliographicRecord {
  return {
    id: row.id,
    recordCode: row.recordCode,
    isbn10: row.isbn10,
    isbn13: row.isbn13,
    titleBn: row.titleBn,
    titleEn: row.titleEn,
    subtitleBn: row.subtitleBn,
    subtitleEn: row.subtitleEn,
    authors: jsonArray(row.authorsJson),
    coAuthors: jsonArray(row.coAuthorsJson),
    editors: jsonArray(row.editorsJson),
    translators: jsonArray(row.translatorsJson),
    publisherId: row.publisherId,
    publisherName: row.publisherName,
    edition: row.edition,
    languageCode: row.languageCode ?? 'bn',
    publicationYear: row.publicationYear,
    pageCount: row.pageCount,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    subcategoryId: row.subcategoryId,
    subcategoryName: row.subcategoryName,
    tags: jsonArray(row.tagsJson),
    summary: row.summary,
    notes: row.notes,
    publicVisibility: intToBool(row.publicVisibility),
    coverImageKey: row.coverImageKey,
    coverThumbnailKey: row.coverThumbnailKey,
    metadataPageKey: row.metadataPageKey,
    sourceUrl: row.sourceUrl,
    sourceNote: row.sourceNote,
    recordStatus: row.recordStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function loadBibliographicRecord(
  db: D1Database,
  recordId: string,
): Promise<BibliographicRecord | null> {
  const row = await dbFirst<BibliographicRow>(
    db,
    `
      ${bibliographicSelect}
      WHERE bibliographic_records.id = ?
        AND bibliographic_records.deleted_at IS NULL
      LIMIT 1
    `,
    [recordId],
  )

  return row ? mapBibliographicRow(row) : null
}

function toRecordFromGoogleVolume(volume: Record<string, any>): Partial<BibliographicRecord> {
  const info = (volume.volumeInfo ?? {}) as Record<string, any>
  const identifiers = Array.isArray(info.industryIdentifiers)
    ? info.industryIdentifiers
    : []
  const isbn10 = identifiers.find((item: Record<string, any>) => item.type === 'ISBN_10')?.identifier
  const isbn13 = identifiers.find((item: Record<string, any>) => item.type === 'ISBN_13')?.identifier

  return {
    isbn10: optionalString(isbn10),
    isbn13: optionalString(isbn13),
    titleEn: sanitizeString(info.title),
    subtitleEn: optionalString(info.subtitle),
    authors: sanitizeStringArray(info.authors),
    publisherName: optionalString(info.publisher),
    publicationYear: optionalString(info.publishedDate)
      ? Number.parseInt(String(info.publishedDate).slice(0, 4), 10) || null
      : null,
    pageCount: typeof info.pageCount === 'number' ? info.pageCount : null,
    languageCode: sanitizeString(info.language) || 'bn',
    summary: optionalString(info.description),
    sourceNote: 'Google Books metadata lookup',
  }
}

async function fetchGoogleBooksMetadata(isbn: string) {
  const response = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`,
  )

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as Record<string, any>
  const volume = Array.isArray(payload.items) ? payload.items[0] : null
  return volume ? toRecordFromGoogleVolume(volume) : null
}

async function fetchOpenLibraryMetadata(isbn: string) {
  const response = await fetch(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`,
  )

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as Record<string, any>
  const book = payload[`ISBN:${isbn}`]
  if (!book) {
    return null
  }

  const publicationYearMatch = String(book.publish_date ?? '').match(/(18|19|20)\d{2}/)

  return {
    isbn13: isbn.length === 13 ? isbn : null,
    isbn10: isbn.length === 10 ? isbn : null,
    titleEn: sanitizeString(book.title),
    subtitleEn: optionalString(book.subtitle),
    authors: Array.isArray(book.authors)
      ? sanitizeStringArray(book.authors.map((author: { name: string }) => author.name))
      : [],
    publisherName:
      Array.isArray(book.publishers) && book.publishers[0]
        ? optionalString(book.publishers[0].name)
        : null,
    publicationYear: publicationYearMatch ? Number(publicationYearMatch[0]) : null,
    pageCount: typeof book.number_of_pages === 'number' ? book.number_of_pages : null,
    sourceNote: 'Open Library metadata lookup',
  } satisfies Partial<BibliographicRecord>
}

function parseSchemaOrgRecord(schema: Record<string, any>): Partial<BibliographicRecord> {
  const authorEntries = Array.isArray(schema.author) ? schema.author : schema.author ? [schema.author] : []
  const authors = sanitizeStringArray(
    authorEntries.map((author: Record<string, any> | string) =>
      typeof author === 'string' ? author : author?.name,
    ),
  )

  const isbn = firstNonEmpty(schema.isbn, schema.isbn13, schema.isbn10)
  const normalizedIsbn = normalizeIsbn(isbn)

  return {
    isbn10: normalizedIsbn.isbn10,
    isbn13: normalizedIsbn.isbn13,
    titleEn: sanitizeString(schema.name),
    subtitleEn: optionalString(schema.alternativeHeadline),
    authors,
    publisherName: optionalString(
      typeof schema.publisher === 'string' ? schema.publisher : schema.publisher?.name,
    ),
    publicationYear: optionalString(schema.datePublished)
      ? Number.parseInt(String(schema.datePublished).slice(0, 4), 10) || null
      : null,
    pageCount:
      typeof schema.numberOfPages === 'number'
        ? schema.numberOfPages
        : Number.parseInt(String(schema.numberOfPages ?? ''), 10) || null,
    summary: optionalString(schema.description),
  }
}

async function extractMetadataFromUrl(sourceUrl: string) {
  const response = await fetch(sourceUrl, {
    headers: {
      'user-agent': 'CommunityPublicLibrary/1.0',
    },
  })

  if (!response.ok) {
    return null
  }

  const html = await response.text()
  const url = new URL(sourceUrl)
  const host = url.hostname.toLowerCase()
  const logs: BookIntakeDraft['lookupLog'] = []
  let metadata: Partial<BibliographicRecord> = {
    sourceUrl,
  }

  if (host.includes('openlibrary.org')) {
    const isbnFromUrl = sourceUrl.match(/isbn\/([0-9x-]+)/i)?.[1]
    if (isbnFromUrl) {
      const normalizedIsbn = normalizeIsbn(isbnFromUrl)
      const lookupIsbn = normalizedIsbn.isbn13 ?? normalizedIsbn.isbn10
      if (lookupIsbn) {
        const openLibraryMetadata = await fetchOpenLibraryMetadata(lookupIsbn)
        if (openLibraryMetadata) {
          metadata = mergeMetadata(metadata, openLibraryMetadata)
          logs.push({
            source: 'open_library_url',
            status: 'success',
            message: 'Open Library URL থেকে বইয়ের তথ্য পাওয়া গেছে।',
          })
        }
      }
    }
  }

  if (host.includes('books.google')) {
    const volumeId = url.searchParams.get('id')
    if (volumeId) {
      const apiResponse = await fetch(
        `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(volumeId)}`,
      )
      if (apiResponse.ok) {
        const payload = (await apiResponse.json()) as Record<string, any>
        metadata = mergeMetadata(metadata, toRecordFromGoogleVolume(payload))
        logs.push({
          source: 'google_books_url',
          status: 'success',
          message: 'Google Books URL থেকে বইয়ের তথ্য পাওয়া গেছে।',
        })
      }
    }
  }

  const schemaObjects = extractJsonLdObjects(html)
  const schemaRecord = schemaObjects.find((entry) => {
    const type = entry && typeof entry === 'object' ? String((entry as Record<string, any>)['@type'] ?? '') : ''
    return /book|product/i.test(type)
  })
  if (schemaRecord && typeof schemaRecord === 'object') {
    metadata = mergeMetadata(metadata, parseSchemaOrgRecord(schemaRecord as Record<string, any>))
    logs.push({
      source: host.includes('rokomari.com') ? 'rokomari' : 'schema_org',
      status: 'success',
      message: 'ওয়েব পেজের structured data থেকে তথ্য পাওয়া গেছে।',
    })
  }

  const title =
    extractMetaContent(html, ['og:title', 'twitter:title']) ??
    stripHtml(html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? '')
  const description = extractMetaContent(html, [
    'description',
    'og:description',
    'twitter:description',
  ])
  const isbnMatch = html.match(/ISBN(?:-1[03])?\s*[:#]?\s*([0-9X-]{10,20})/i)
  const publisherMatch = html.match(/Publisher\s*[:#]?\s*<\/[^>]+>\s*([^<]+)/i)
  const editionMatch = html.match(/Edition\s*[:#]?\s*<\/[^>]+>\s*([^<]+)/i)
  const yearMatch = html.match(/(?:Publication|Published)\s*(?:Year|Date)?\s*[:#]?\s*([^<]{4,20})/i)
  const normalizedIsbn = normalizeIsbn(isbnMatch?.[1] ?? '')

  metadata = mergeMetadata(metadata, {
    titleEn: title,
    summary: description,
    isbn10: metadata.isbn10 || normalizedIsbn.isbn10,
    isbn13: metadata.isbn13 || normalizedIsbn.isbn13,
    publisherName: metadata.publisherName || optionalString(publisherMatch?.[1]),
    edition: metadata.edition || optionalString(editionMatch?.[1]),
    publicationYear:
      metadata.publicationYear ??
      (yearMatch ? Number.parseInt(yearMatch[1].match(/(18|19|20)\d{2}/)?.[0] ?? '', 10) || null : null),
    sourceNote: `Source URL lookup: ${host}`,
  })

  logs.push({
    source: 'generic_html',
    status: 'success',
    message: 'ওয়েব পেজের meta tag থেকে অতিরিক্ত তথ্য যোগ করা হয়েছে।',
  })

  return { metadata, logs }
}

function coerceVisionJson(rawText: string) {
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return null
  }

  try {
    return JSON.parse(jsonMatch[0]) as Record<string, unknown>
  } catch {
    return null
  }
}

async function tryVisionDraft(env: AppBindings, file: File) {
  if (!env.AI) {
    return null
  }

  try {
    const bytes = Array.from(new Uint8Array(await file.arrayBuffer()))
    const result = (await env.AI.run(env.AI_BOOK_INTAKE_MODEL, {
      prompt: [
        'Read this title page or copyright page image.',
        'Return only one JSON object.',
        'Keys: titleBn, titleEn, subtitleBn, subtitleEn, authors, coAuthors, editors, translators, publisherName, edition, isbn10, isbn13, languageCode, publicationYear, pageCount, tags, summary, notes.',
        'Use arrays for contributor fields and tags. Use null for missing scalar values.',
      ].join(' '),
      image: bytes,
    })) as Record<string, unknown>

    const rawText =
      (typeof result.response === 'string' && result.response) ||
      (typeof result.result === 'string' && result.result) ||
      JSON.stringify(result)

    const parsed = coerceVisionJson(rawText)
    if (!parsed) {
      return null
    }

    const normalizedIsbn10 = normalizeIsbn(String(parsed.isbn10 ?? '')).isbn10
    const normalizedIsbn13 = normalizeIsbn(String(parsed.isbn13 ?? '')).isbn13

    return {
      titleBn: optionalString(parsed.titleBn),
      titleEn: sanitizeString(parsed.titleEn),
      subtitleBn: optionalString(parsed.subtitleBn),
      subtitleEn: optionalString(parsed.subtitleEn),
      authors: sanitizeStringArray(parsed.authors),
      coAuthors: sanitizeStringArray(parsed.coAuthors),
      editors: sanitizeStringArray(parsed.editors),
      translators: sanitizeStringArray(parsed.translators),
      publisherName: optionalString(parsed.publisherName),
      edition: optionalString(parsed.edition),
      isbn10: normalizedIsbn10,
      isbn13: normalizedIsbn13,
      languageCode: sanitizeString(parsed.languageCode) || 'bn',
      publicationYear:
        typeof parsed.publicationYear === 'number'
          ? parsed.publicationYear
          : Number.parseInt(String(parsed.publicationYear ?? ''), 10) || null,
      pageCount:
        typeof parsed.pageCount === 'number'
          ? parsed.pageCount
          : Number.parseInt(String(parsed.pageCount ?? ''), 10) || null,
      tags: sanitizeStringArray(parsed.tags),
      summary: optionalString(parsed.summary),
      notes: optionalString(parsed.notes),
    } satisfies Partial<BibliographicRecord>
  } catch {
    return null
  }
}

function buildDuplicateReason(record: BibliographicRecord, options: {
  exactIsbnMatch: boolean
  titleScore: number
  authorScore: number
  editionScore: number
  publisherMatched: boolean
  yearMatched: boolean
}) {
  const hints: string[] = []
  if (options.exactIsbnMatch) {
    hints.push('ISBN exact match')
  }
  if (options.titleScore >= 0.7) {
    hints.push('title is very similar')
  }
  if (options.authorScore >= 0.55) {
    hints.push('author list is similar')
  }
  if (options.editionScore >= 0.8 || (options.editionScore > 0 && record.edition)) {
    hints.push('edition looks close')
  }
  if (options.publisherMatched) {
    hints.push('publisher matches')
  }
  if (options.yearMatched) {
    hints.push('publication year matches')
  }

  return hints.join(', ')
}

export function evaluateDuplicateCandidate(
  metadata: Partial<BibliographicRecord>,
  record: BibliographicRecord,
): DuplicateCandidate | null {
  const normalizedPublisher = normalizeText(metadata.publisherName)
  const isbn10 = normalizeIsbn(metadata.isbn10).isbn10 ?? metadata.isbn10 ?? ''
  const isbn13 = normalizeIsbn(metadata.isbn13).isbn13 ?? metadata.isbn13 ?? ''
  const exactIsbnMatch =
    Boolean(isbn10 && record.isbn10 === isbn10) ||
    Boolean(isbn13 && record.isbn13 === isbn13)
  const titleScore = Math.max(
    similarityScore(metadata.titleEn ?? '', record.titleEn),
    similarityScore(metadata.titleBn ?? '', record.titleBn ?? ''),
  )
  const authorScore = similarityScore(
    [...(metadata.authors ?? []), ...(metadata.coAuthors ?? [])].join(' '),
    [...record.authors, ...record.coAuthors].join(' '),
  )
  const editionScore = similarityScore(metadata.edition ?? '', record.edition ?? '')
  const publisherMatched =
    Boolean(normalizedPublisher) &&
    normalizeText(record.publisherName) === normalizedPublisher
  const yearMatched =
    Boolean(metadata.publicationYear) && metadata.publicationYear === record.publicationYear

  const similarityScoreValue = exactIsbnMatch
    ? 1
    : Number(
        (
          titleScore * 0.5 +
          authorScore * 0.23 +
          editionScore * 0.12 +
          (publisherMatched ? 0.08 : 0) +
          (yearMatched ? 0.07 : 0)
        ).toFixed(2),
      )

  const reason = buildDuplicateReason(record, {
    exactIsbnMatch,
    titleScore,
    authorScore,
    editionScore,
    publisherMatched,
    yearMatched,
  })

  const candidate = {
    record: {
      ...record,
      duplicateScore: similarityScoreValue,
      duplicateHints: reason
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    },
    reason,
    resolutionHint:
      exactIsbnMatch || similarityScoreValue >= 0.82
        ? 'add_copy_to_existing_record'
        : 'use_existing_record',
    exactIsbnMatch,
    similarityScore: similarityScoreValue,
  } satisfies DuplicateCandidate

  return candidate.exactIsbnMatch || candidate.similarityScore >= 0.42 ? candidate : null
}

export async function detectDuplicateBooks(
  db: D1Database,
  metadata: Partial<BibliographicRecord>,
): Promise<DuplicateCandidate[]> {
  const normalizedTitle = normalizeText(metadata.titleBn || metadata.titleEn)
  const normalizedAuthors = normalizeText([...(metadata.authors ?? []), ...(metadata.coAuthors ?? [])].join(' '))
  const isbn10 = normalizeIsbn(metadata.isbn10).isbn10 ?? metadata.isbn10 ?? ''
  const isbn13 = normalizeIsbn(metadata.isbn13).isbn13 ?? metadata.isbn13 ?? ''

  if (!normalizedTitle && !isbn10 && !isbn13) {
    return []
  }

  const rows = await dbAll<BibliographicRow>(
    db,
    `
      ${bibliographicSelect}
      WHERE bibliographic_records.deleted_at IS NULL
        AND (
          (? <> '' AND bibliographic_records.isbn_10 = ?)
          OR (? <> '' AND bibliographic_records.isbn_13 = ?)
          OR (? <> '' AND bibliographic_records.normalized_title LIKE ?)
          OR (? <> '' AND bibliographic_records.normalized_authors LIKE ?)
        )
      ORDER BY bibliographic_records.updated_at DESC
      LIMIT 24
    `,
    [
      isbn10,
      isbn10,
      isbn13,
      isbn13,
      normalizedTitle,
      `%${normalizedTitle.split(' ').slice(0, 5).join('%')}%`,
      normalizedAuthors,
      `%${normalizedAuthors.slice(0, 24)}%`,
    ],
  )

  return rows
    .map((row) => mapBibliographicRow(row))
    .map((record) => evaluateDuplicateCandidate(metadata, record))
    .filter((candidate): candidate is DuplicateCandidate => Boolean(candidate))
    .sort((left, right) => right.similarityScore - left.similarityScore)
}

export async function buildBookIntakeDraft(
  env: AppBindings,
  input: DraftSeedInput,
): Promise<BookIntakeDraft> {
  let metadata: Partial<BibliographicRecord> = {
    titleEn: sanitizeString(input.manualTitle),
    authors: input.manualAuthor ? [sanitizeString(input.manualAuthor)] : [],
    publisherName: optionalString(input.manualPublisher),
    coverImageKey: input.coverImageKey ?? null,
    coverThumbnailKey: input.coverThumbnailKey ?? null,
    metadataPageKey: input.metadataPageKey ?? null,
    sourceUrl: optionalString(input.sourceUrl),
    notes: optionalString(input.notes),
    languageCode: 'bn',
    publicVisibility: true,
    recordStatus: 'draft',
  }

  const sources: BookIntakeDraft['sources'] = []
  const warnings: string[] = []
  const lookupLog: BookIntakeDraft['lookupLog'] = [
    {
      source: 'manual',
      status: 'success',
      message: 'ম্যানুয়াল seed input গ্রহণ করা হয়েছে।',
    },
  ]

  const normalizedIsbn = normalizeIsbn(input.isbn)
  if (normalizedIsbn.isbn10 || normalizedIsbn.isbn13) {
    const lookupIsbn = normalizedIsbn.isbn13 ?? normalizedIsbn.isbn10 ?? ''
    sources.push({ type: 'isbn', value: lookupIsbn })
    metadata = mergeMetadata(metadata, {
      isbn10: normalizedIsbn.isbn10,
      isbn13: normalizedIsbn.isbn13,
    })

    const openLibraryMetadata = await fetchOpenLibraryMetadata(lookupIsbn)
    if (openLibraryMetadata) {
      metadata = mergeMetadata(metadata, openLibraryMetadata)
      lookupLog.push({
        source: 'open_library',
        status: 'success',
        message: 'Open Library থেকে ISBN metadata পাওয়া গেছে।',
      })
    } else {
      lookupLog.push({
        source: 'open_library',
        status: 'warning',
        message: 'Open Library থেকে metadata পাওয়া যায়নি।',
      })
    }

    const completenessAfterOpenLibrary = getCompleteness(metadata)
    if (!completenessAfterOpenLibrary.title || !completenessAfterOpenLibrary.authors) {
      const googleBooksMetadata = await fetchGoogleBooksMetadata(lookupIsbn)
      if (googleBooksMetadata) {
        metadata = mergeMetadata(metadata, googleBooksMetadata)
        lookupLog.push({
          source: 'google_books',
          status: 'success',
          message: 'Google Books থেকে অতিরিক্ত metadata পাওয়া গেছে।',
        })
      } else {
        lookupLog.push({
          source: 'google_books',
          status: 'warning',
          message: 'Google Books fallback থেকেও metadata পাওয়া যায়নি।',
        })
      }
    } else {
      lookupLog.push({
        source: 'google_books',
        status: 'skipped',
        message: 'ISBN lookup যথেষ্ট হওয়ায় Google Books fallback লাগেনি।',
      })
    }
  }

  if (input.sourceUrl) {
    sources.push({ type: 'url', value: input.sourceUrl })
    const urlMetadata = await extractMetadataFromUrl(input.sourceUrl)
    if (urlMetadata) {
      metadata = mergeMetadata(metadata, urlMetadata.metadata)
      lookupLog.push(...urlMetadata.logs)
    } else {
      warnings.push('Source URL থেকে metadata extraction ব্যর্থ হয়েছে।')
      lookupLog.push({
        source: 'generic_html',
        status: 'failed',
        message: 'Source URL parse করা যায়নি।',
      })
    }
  }

  if (input.pageImage) {
    sources.push({ type: 'ocr', value: input.pageImage.name })
    const aiMetadata = await tryVisionDraft(env, input.pageImage)
    if (aiMetadata) {
      metadata = mergeMetadata(metadata, aiMetadata)
      lookupLog.push({
        source: 'workers_ai',
        status: 'success',
        message: 'Workers AI দিয়ে title/copyright page থেকে draft metadata পাওয়া গেছে।',
      })
    } else {
      warnings.push('AI/OCR draft পাওয়া যায়নি। ম্যানুয়াল review প্রয়োজন।')
      lookupLog.push({
        source: 'workers_ai',
        status: 'warning',
        message: 'AI/OCR extraction অসম্পূর্ণ বা অনুপলব্ধ।',
      })
    }
  } else if (requiresMetadataPage(metadata)) {
    warnings.push('Metadata এখনো অসম্পূর্ণ। title/copyright page image দিলে আরও ভালো draft পাওয়া যাবে।')
  }

  const duplicates = await detectDuplicateBooks(env.DB, metadata)
  const completeness = getCompleteness(metadata)

  return {
    seed: {
      isbn: normalizedIsbn.isbn13 ?? normalizedIsbn.isbn10 ?? '',
      sourceUrl: sanitizeString(input.sourceUrl),
      manualTitle: sanitizeString(input.manualTitle),
      manualAuthor: sanitizeString(input.manualAuthor),
      manualPublisher: sanitizeString(input.manualPublisher),
    },
    metadata,
    copyDefaults: {
      quantity: duplicates.length > 0 ? 0 : 1,
      condition: 'good' satisfies CopyItem['condition'],
      acquisitionType: 'purchase' satisfies CopyItem['acquisitionType'],
      acquisitionDate: dhakaNow().slice(0, 10),
      acquisitionSource: sanitizeString(input.manualPublisher),
    },
    sources,
    lookupLog,
    completeness,
    requiresMetadataPage: requiresMetadataPage(metadata),
    warnings,
    duplicates,
  }
}

export async function getCatalogOptions(db: D1Database): Promise<CatalogOptionsPayload> {
  const [publishers, languages, categories] = await Promise.all([
    dbAll<CatalogOption>(
      db,
      `
        SELECT
          id,
          name_bn AS labelBn,
          COALESCE(name_en, name_bn) AS labelEn
        FROM publishers
        WHERE deleted_at IS NULL
          AND active = 1
        ORDER BY name_bn ASC
      `,
    ),
    dbAll<CatalogOption>(
      db,
      `
        SELECT
          id,
          iso_code AS code,
          name_bn AS labelBn,
          name_en AS labelEn
        FROM languages
        WHERE active = 1
        ORDER BY name_bn ASC
      `,
    ),
    dbAll<CatalogOption & { parentId: string | null }>(
      db,
      `
        SELECT
          id,
          parent_id AS parentId,
          name_bn AS labelBn,
          name_en AS labelEn
        FROM categories
        WHERE deleted_at IS NULL
          AND active = 1
        ORDER BY sort_order ASC, name_bn ASC
      `,
    ),
  ])

  return {
    publishers,
    languages,
    categories,
  }
}

export async function uploadCatalogAsset(
  env: AppBindings,
  kind: IntakeAsset['kind'],
  file: File,
) {
  const storageKind = kind === 'metadata_page' ? 'scans' : 'covers'
  const key = buildR2Key(storageKind, file.name)
  await putFile(env.MEDIA_BUCKET, key, file, {
    assetKind: kind,
  })

  return {
    key,
    url: `/files/${encodeURIComponent(key)}`,
    kind,
    fileName: file.name,
    contentType: file.type,
  } satisfies IntakeAsset
}

async function resolvePublisherId(
  db: D1Database,
  publisherId: string | undefined,
  publisherName: string | undefined,
) {
  const normalizedPublisherId = sanitizeString(publisherId)
  if (normalizedPublisherId) {
    return normalizedPublisherId
  }

  const normalizedPublisherName = sanitizeString(publisherName)
  if (!normalizedPublisherName) {
    return null
  }

  const existing = await dbFirst<{ id: string }>(
    db,
    `
      SELECT id
      FROM publishers
      WHERE deleted_at IS NULL
        AND (
          lower(name_bn) = lower(?)
          OR lower(COALESCE(name_en, '')) = lower(?)
        )
      LIMIT 1
    `,
    [normalizedPublisherName, normalizedPublisherName],
  )
  if (existing?.id) {
    return existing.id
  }

  const id = crypto.randomUUID()
  await dbRun(
    db,
    `
      INSERT INTO publishers (
        id,
        publisher_code,
        name_bn,
        name_en,
        active,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `,
    [
      id,
      `PUB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      normalizedPublisherName,
      normalizedPublisherName,
      dhakaNow(),
      dhakaNow(),
    ],
  )

  return id
}

async function resolveLanguageId(db: D1Database, languageCode: string | undefined) {
  const normalizedCode = sanitizeString(languageCode) || 'bn'
  const language = await dbFirst<{ id: string }>(
    db,
    `SELECT id FROM languages WHERE iso_code = ? LIMIT 1`,
    [normalizedCode],
  )

  if (language?.id) {
    return language.id
  }

  const fallback = await dbFirst<{ id: string }>(
    db,
    `SELECT id FROM languages WHERE iso_code = 'bn' LIMIT 1`,
  )
  return fallback?.id ?? null
}

async function replaceContributors(
  db: D1Database,
  recordId: string,
  role: CatalogContributorRole,
  values: string[],
) {
  await dbRun(
    db,
    `
      DELETE FROM book_contributors
      WHERE bibliographic_record_id = ?
        AND contributor_role = ?
    `,
    [recordId, role],
  )

  for (const [index, name] of sanitizeStringArray(values).entries()) {
    await dbRun(
      db,
      `
        INSERT INTO book_contributors (
          id,
          bibliographic_record_id,
          contributor_name_en,
          contributor_role,
          sort_order,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [crypto.randomUUID(), recordId, name, role, index + 1, dhakaNow()],
    )
  }
}

function buildSearchBlob(record: SaveIntakePayload['record']) {
  return normalizeText(
    [
      record.titleBn,
      record.titleEn,
      record.subtitleBn,
      record.subtitleEn,
      record.authors.join(' '),
      record.coAuthors.join(' '),
      record.publisherName,
      record.edition,
      record.tags.join(' '),
    ].join(' '),
  )
}

function generateRecordCode(seedTitle: string) {
  const slug = toSlug(seedTitle || 'record').replace(/-/g, '').slice(0, 8).toUpperCase()
  return `BIB-${slug || 'BOOK'}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
}

export async function requestAccessionCodes(
  env: AppBindings,
  count: number,
): Promise<Array<{ accessionCode: string; accessionSequence: number }>> {
  const id = env.ACCESSION_COUNTER.idFromName('library-sequence')
  const stub = env.ACCESSION_COUNTER.get(id)
  const response = await stub.fetch('https://accession-counter/next', {
    method: 'POST',
    body: JSON.stringify({
      count,
      prefix: env.LIBRARY_CODE,
    }),
  })

  const payload = (await response.json()) as {
    codes: Array<{ accessionCode: string; accessionSequence: number }>
  }

  return payload.codes
}

export async function createCopiesForRecord(
  env: AppBindings,
  record: BibliographicRecord,
  actorId: string,
  copies: SaveIntakePayload['copies'],
) {
  const quantity = Math.max(0, Math.floor(copies.quantity))
  if (quantity === 0) {
    return {
      createdCopyIds: [] as string[],
      createdBarcodeValues: [] as string[],
      createdQrCodes: [] as string[],
    }
  }

  const acquisitionRecordId = crypto.randomUUID()
  const acquisitionCode = `ACQ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
  await dbRun(
    env.DB,
    `
      INSERT INTO acquisition_records (
        id,
        acquisition_code,
        acquisition_type,
        source_name,
        invoice_or_reference,
        acquired_on,
        unit_cost,
        total_cost,
        note,
        created_by_user_id,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      acquisitionRecordId,
      acquisitionCode,
      copies.acquisitionType,
      optionalString(copies.acquisitionSource) ?? optionalString(copies.vendorName),
      optionalString(copies.invoiceReference),
      copies.acquisitionDate || dhakaNow().slice(0, 10),
      copies.acquisitionPrice ?? null,
      copies.acquisitionPrice ? Number((copies.acquisitionPrice * quantity).toFixed(2)) : null,
      optionalString(copies.notes),
      actorId,
      dhakaNow(),
      dhakaNow(),
    ],
  )

  const currentCopyNumber = await dbFirst<{ maxCopyNumber: number | null }>(
    env.DB,
    `
      SELECT MAX(copy_number) AS maxCopyNumber
      FROM book_copies
      WHERE bibliographic_record_id = ?
        AND deleted_at IS NULL
    `,
    [record.id],
  )
  const accessionCodes = await requestAccessionCodes(env, quantity)

  const createdCopyIds: string[] = []
  const createdBarcodeValues: string[] = []
  const createdQrCodes: string[] = []

  for (const [index, accession] of accessionCodes.entries()) {
    const copyId = crypto.randomUUID()
    const copyNumber = Number(currentCopyNumber?.maxCopyNumber ?? 0) + index + 1
    const qrShortCode = crypto.randomUUID().replace(/-/g, '').slice(0, 10)

    await dbRun(
      env.DB,
      `
        INSERT INTO book_copies (
          id,
          bibliographic_record_id,
          acquisition_record_id,
          accession_code,
          accession_sequence,
          copy_number,
          copy_label,
          condition_status,
          availability_status,
          source_note,
          note,
          room_label,
          rack_label,
          shelf_label,
          created_by_user_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        copyId,
        record.id,
        acquisitionRecordId,
        accession.accessionCode,
        accession.accessionSequence,
        copyNumber,
        `${record.recordCode ?? 'BOOK'}-${copyNumber}`,
        copies.condition,
        optionalString(copies.acquisitionSource),
        optionalString(copies.notes),
        optionalString(copies.locationRoom),
        optionalString(copies.locationRack),
        optionalString(copies.locationShelf),
        actorId,
        dhakaNow(),
        dhakaNow(),
      ],
    )

    await dbRun(
      env.DB,
      `
        INSERT INTO barcodes (
          id,
          entity_type,
          entity_id,
          symbology,
          barcode_value,
          printable_label,
          is_active,
          created_at,
          updated_at
        )
        VALUES (?, 'book_copy', ?, 'code128', ?, ?, 1, ?, ?)
      `,
      [
        crypto.randomUUID(),
        copyId,
        accession.accessionCode,
        accession.accessionCode,
        dhakaNow(),
        dhakaNow(),
      ],
    )

    await dbRun(
      env.DB,
      `
        INSERT INTO qr_links (
          id,
          entity_type,
          entity_id,
          short_code,
          target_type,
          target_path,
          payload_json,
          is_active,
          created_at,
          updated_at
        )
        VALUES (?, 'book_copy', ?, ?, 'public', ?, ?, 1, ?, ?)
      `,
      [
        crypto.randomUUID(),
        copyId,
        qrShortCode,
        `/qr/${qrShortCode}`,
        JSON.stringify({
          recordId: record.id,
          copyId,
          destinationPath: buildPublicBookPath(
            record.id,
            record.titleBn || record.titleEn || 'book',
          ),
        }),
        dhakaNow(),
        dhakaNow(),
      ],
    )

    createdCopyIds.push(copyId)
    createdBarcodeValues.push(accession.accessionCode)
    createdQrCodes.push(qrShortCode)
  }

  return {
    createdCopyIds,
    createdBarcodeValues,
    createdQrCodes,
  }
}

export async function saveCatalogIntake(
  env: AppBindings,
  actor: SessionUser | null,
  payload: SaveIntakePayload,
  requestId?: string | null,
): Promise<CatalogSaveResult> {
  if (!actor) {
    throw new Error('Actor is required to save catalog intake.')
  }

  if (
    payload.duplicateResolution.strategy === 'add_copy_to_existing_record' &&
    payload.copies.quantity < 1
  ) {
    throw new Error('Adding a copy to an existing record requires quantity of at least 1.')
  }

  let recordId = sanitizeString(payload.duplicateResolution.existingRecordId)
  let bibliographicRecord: BibliographicRecord | null = null

  if (payload.duplicateResolution.strategy === 'create_new_record') {
    recordId = crypto.randomUUID()
    const publisherId = await resolvePublisherId(
      env.DB,
      payload.record.publisherId,
      payload.record.publisherName,
    )
    const languageId = await resolveLanguageId(env.DB, payload.record.languageCode)
    const titleEn = sanitizeString(payload.record.titleEn) || sanitizeString(payload.record.titleBn)
    const titleBn = optionalString(payload.record.titleBn)
    const normalizedAuthors = normalizeText(
      [...payload.record.authors, ...payload.record.coAuthors].join(' '),
    )

    await dbRun(
      env.DB,
      `
        INSERT INTO bibliographic_records (
          id,
          record_code,
          isbn_10,
          isbn_13,
          title_bn,
          title_en,
          subtitle_bn,
          subtitle_en,
          edition_statement,
          publisher_id,
          language_id,
          primary_category_id,
          subcategory_id,
          publication_year,
          number_of_pages,
          summary,
          subject_keywords,
          cover_r2_key,
          cover_thumbnail_r2_key,
          metadata_page_r2_key,
          source_url,
          source_note,
          metadata_status,
          normalized_title,
          normalized_authors,
          search_blob,
          internal_note,
          public_visibility,
          source_payload_json,
          created_by_user_id,
          updated_by_user_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        recordId,
        sanitizeString(payload.record.recordCode) || generateRecordCode(titleEn || 'book'),
        optionalString(payload.record.isbn10),
        optionalString(payload.record.isbn13),
        titleBn,
        titleEn,
        optionalString(payload.record.subtitleBn),
        optionalString(payload.record.subtitleEn) ?? optionalString(payload.record.subtitleBn),
        optionalString(payload.record.edition),
        publisherId,
        languageId,
        optionalString(payload.record.categoryId),
        optionalString(payload.record.subcategoryId),
        payload.record.publicationYear ?? null,
        payload.record.pageCount ?? null,
        optionalString(payload.record.summary),
        JSON.stringify(sanitizeStringArray(payload.record.tags)),
        optionalString(payload.record.coverImageKey),
        optionalString(payload.record.coverThumbnailKey),
        optionalString(payload.record.metadataPageKey || payload.seed.metadataPageKey),
        optionalString(payload.record.sourceUrl || payload.seed.sourceUrl),
        optionalString(payload.record.sourceNote),
        'active',
        normalizeText(titleBn || titleEn),
        normalizedAuthors,
        buildSearchBlob(payload.record),
        optionalString(payload.record.notes),
        boolToInt(payload.record.publicVisibility),
        JSON.stringify(payload.seed),
        actor.id,
        actor.id,
        dhakaNow(),
        dhakaNow(),
      ],
    )

    await Promise.all([
      replaceContributors(env.DB, recordId, 'author', payload.record.authors),
      replaceContributors(env.DB, recordId, 'co_author', payload.record.coAuthors),
      replaceContributors(env.DB, recordId, 'editor', payload.record.editors),
      replaceContributors(env.DB, recordId, 'translator', payload.record.translators),
    ])

    bibliographicRecord = await loadBibliographicRecord(env.DB, recordId)
  } else {
    if (!recordId) {
      throw new Error('An existing bibliographic record must be selected.')
    }
    bibliographicRecord = await loadBibliographicRecord(env.DB, recordId)
  }

  if (!bibliographicRecord) {
    throw new Error('Bibliographic record could not be resolved.')
  }

  const copyResult = await createCopiesForRecord(env, bibliographicRecord, actor.id, payload.copies)

  await writeAudit(
    env.DB,
    actor,
    'catalog.intake.save',
    'bibliographic_record',
    bibliographicRecord.id,
    'বইয়ের intake review শেষে সংরক্ষণ করা হয়েছে।',
    {
      requestId,
      after: {
        duplicateStrategy: payload.duplicateResolution.strategy,
        copyCount: copyResult.createdCopyIds.length,
        recordId: bibliographicRecord.id,
      },
    },
  )

  return {
    bibliographicRecord,
    duplicateStrategy: payload.duplicateResolution.strategy,
    createdCopyIds: copyResult.createdCopyIds,
    createdBarcodeValues: copyResult.createdBarcodeValues,
    createdQrCodes: copyResult.createdQrCodes,
  }
}
