import type { BibliographicRecord, BookIntakeDraft, CopyItem } from '@shared/index'
import { dhakaNow, normalizeText, similarityScore } from '@shared/utils'
import type { AppBindings } from '../types'
import { dbAll, jsonArray } from '../lib/db'

interface BookRow {
  id: string
  isbn: string | null
  title_bn: string | null
  title_en: string
  subtitle: string | null
  authors_json: string
  publisher: string | null
  edition: string | null
  publication_year: number | null
  language_code: string
  category: string | null
  keywords_json: string
  summary: string | null
  cover_image_key: string | null
  source_url: string | null
  record_status: BibliographicRecord['recordStatus']
  duplicate_score: number | null
  created_at: string
  updated_at: string
}

export function mapBibliographicRow(row: BookRow): BibliographicRecord {
  return {
    id: row.id,
    isbn: row.isbn,
    titleBn: row.title_bn,
    titleEn: row.title_en,
    subtitle: row.subtitle,
    authors: jsonArray(row.authors_json),
    publisher: row.publisher,
    edition: row.edition,
    publicationYear: row.publication_year,
    languageCode: row.language_code,
    category: row.category,
    keywords: jsonArray(row.keywords_json),
    summary: row.summary,
    coverImageKey: row.cover_image_key,
    sourceUrl: row.source_url,
    recordStatus: row.record_status,
    duplicateScore: row.duplicate_score,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
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

export async function fetchOpenLibraryMetadata(
  isbn: string,
): Promise<Partial<BibliographicRecord> | null> {
  const response = await fetch(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
  )

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as Record<string, any>
  const book = payload[`ISBN:${isbn}`]
  if (!book) {
    return null
  }

  const publicationYearMatch = String(book.publish_date ?? '').match(/(19|20)\d{2}/)

  return {
    isbn,
    titleEn: book.title ?? '',
    subtitle: book.subtitle ?? '',
    authors: Array.isArray(book.authors)
      ? book.authors.map((author: { name: string }) => author.name).filter(Boolean)
      : [],
    publisher:
      Array.isArray(book.publishers) && book.publishers[0]
        ? book.publishers[0].name
        : null,
    publicationYear: publicationYearMatch ? Number(publicationYearMatch[0]) : null,
    coverImageKey: null,
  }
}

export async function fetchUrlMetadata(
  sourceUrl: string,
): Promise<Partial<BibliographicRecord> | null> {
  const response = await fetch(sourceUrl, {
    headers: {
      'user-agent': 'CommunityPublicLibrary/1.0',
    },
  })

  if (!response.ok) {
    return null
  }

  const html = await response.text()
  const title =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<title>([^<]+)<\/title>/i)?.[1] ??
    ''

  const description =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    null

  return {
    titleEn: title.trim(),
    summary: description?.trim() ?? null,
    sourceUrl,
  }
}

export async function tryVisionDraft(
  env: AppBindings,
  file: File,
): Promise<Partial<BibliographicRecord> | null> {
  if (!env.AI) {
    return null
  }

  try {
    const bytes = Array.from(new Uint8Array(await file.arrayBuffer()))
    const result = (await env.AI.run(env.AI_BOOK_INTAKE_MODEL, {
      prompt:
        'Read this book metadata image. Return JSON with titleEn, titleBn, authors, publisher, edition, publicationYear, summary.',
      image: bytes,
    })) as Record<string, unknown>

    const rawText =
      (typeof result.response === 'string' && result.response) ||
      (typeof result.result === 'string' && result.result) ||
      JSON.stringify(result)

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return null
    }

    return JSON.parse(jsonMatch[0]) as Partial<BibliographicRecord>
  } catch {
    return null
  }
}

export async function detectDuplicateBooks(
  db: D1Database,
  metadata: Partial<BibliographicRecord>,
): Promise<BibliographicRecord[]> {
  const title = metadata.titleEn?.trim()
  const authors = metadata.authors?.join(' ')

  if (!title && !metadata.isbn) {
    return []
  }

  const normalizedTitle = normalizeText(title ?? '')
  const normalizedAuthors = normalizeText(authors ?? '')
  const titlePrefix = normalizedTitle.split(' ').slice(0, 4).join('%')
  const authorPrefix = normalizedAuthors.slice(0, 20)

  const rows = await dbAll<BookRow>(
    db,
    `
      SELECT *
      FROM bibliographic_records
      WHERE deleted_at IS NULL
        AND (
          (? <> '' AND isbn = ?)
          OR (? <> '' AND normalized_title LIKE ?)
          OR (? <> '' AND normalized_authors LIKE ?)
        )
      ORDER BY updated_at DESC
      LIMIT 20
    `,
    [
      metadata.isbn ?? '',
      metadata.isbn ?? '',
      titlePrefix,
      `%${titlePrefix}%`,
      authorPrefix,
      `%${authorPrefix}%`,
    ],
  )

  return rows
    .map((row) => {
      const mapped = mapBibliographicRow(row)
      const titleScore = similarityScore(metadata.titleEn ?? '', mapped.titleEn)
      const authorScore = similarityScore(
        metadata.authors?.join(' ') ?? '',
        mapped.authors.join(' '),
      )
      const duplicateScore =
        metadata.isbn && mapped.isbn === metadata.isbn
          ? 1
          : Number((titleScore * 0.7 + authorScore * 0.3).toFixed(2))

      return {
        ...mapped,
        duplicateScore,
      }
    })
    .filter((book) => (book.duplicateScore ?? 0) >= 0.35)
    .sort((left, right) => (right.duplicateScore ?? 0) - (left.duplicateScore ?? 0))
}

export async function buildBookIntakeDraft(
  env: AppBindings,
  input: {
    isbn?: string
    sourceUrl?: string
    manualTitle?: string
    manualAuthor?: string
    coverImageKey?: string | null
    pageImage?: File | null
  },
): Promise<BookIntakeDraft> {
  const draft: BookIntakeDraft = {
    metadata: {
      titleEn: input.manualTitle?.trim() ?? '',
      authors: input.manualAuthor ? [input.manualAuthor.trim()] : [],
      coverImageKey: input.coverImageKey ?? null,
      sourceUrl: input.sourceUrl?.trim() ?? null,
      languageCode: 'bn',
    },
    copyDefaults: {
      condition: 'good' satisfies CopyItem['condition'],
      acquisitionType: 'purchase' satisfies CopyItem['acquisitionType'],
      acquisitionDate: dhakaNow().slice(0, 10),
    },
    sources: [],
    warnings: [],
    duplicates: [],
  }

  if (input.isbn?.trim()) {
    draft.sources.push({ type: 'isbn', value: input.isbn.trim() })
    const isbnMetadata = await fetchOpenLibraryMetadata(input.isbn.trim())
    if (isbnMetadata) {
      draft.metadata = { ...draft.metadata, ...isbnMetadata }
    } else {
      draft.warnings.push('ISBN metadata পাওয়া যায়নি।')
    }
  }

  if (input.sourceUrl?.trim()) {
    draft.sources.push({ type: 'url', value: input.sourceUrl.trim() })
    const urlMetadata = await fetchUrlMetadata(input.sourceUrl.trim())
    if (urlMetadata) {
      draft.metadata = { ...draft.metadata, ...urlMetadata }
    } else {
      draft.warnings.push('Source URL metadata fetch ব্যর্থ হয়েছে।')
    }
  }

  if (input.pageImage) {
    draft.sources.push({ type: 'ocr', value: input.pageImage.name })
    const aiMetadata = await tryVisionDraft(env, input.pageImage)
    if (aiMetadata) {
      draft.metadata = {
        ...draft.metadata,
        ...aiMetadata,
      }
    } else {
      draft.warnings.push('AI/OCR draft পাওয়া যায়নি। ম্যানুয়াল রিভিউ প্রয়োজন।')
    }
  }

  if (!draft.metadata.titleEn) {
    draft.warnings.push('Book title নিশ্চিত করা যায়নি।')
  }

  draft.duplicates = await detectDuplicateBooks(env.DB, draft.metadata)
  return draft
}
