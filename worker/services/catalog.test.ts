import { describe, expect, it } from 'vitest'
import type { BibliographicRecord } from '@shared/index'
import { bookIntakeSeedSchema } from '@shared/index'
import { createCopiesForRecord, evaluateDuplicateCandidate } from './catalog'
import type { AppBindings } from '../types'

function makeRecord(overrides: Partial<BibliographicRecord> = {}): BibliographicRecord {
  return {
    id: 'record-1',
    recordCode: 'BIB-TEST-001',
    isbn10: null,
    isbn13: null,
    titleBn: null,
    titleEn: 'River Stories',
    subtitleBn: null,
    subtitleEn: null,
    authors: ['Amina Rahman'],
    coAuthors: [],
    editors: [],
    translators: [],
    publisherId: null,
    publisherName: 'Nodi Prokash',
    edition: '2nd',
    languageCode: 'bn',
    publicationYear: 2024,
    pageCount: 220,
    categoryId: null,
    categoryName: null,
    subcategoryId: null,
    subcategoryName: null,
    tags: [],
    summary: null,
    notes: null,
    publicVisibility: true,
    coverImageKey: null,
    coverThumbnailKey: null,
    metadataPageKey: null,
    sourceUrl: null,
    sourceNote: null,
    recordStatus: 'active',
    createdAt: '2026-03-19T00:00:00.000Z',
    updatedAt: '2026-03-19T00:00:00.000Z',
    ...overrides,
  }
}

function createFakeDb() {
  const statements: Array<{ query: string; bindings: unknown[] }> = []

  const db = {
    prepare(query: string) {
      let bindings: unknown[] = []
      return {
        bind(...values: unknown[]) {
          bindings = values
          return this
        },
        async first<T>() {
          if (query.includes('SELECT MAX(copy_number)')) {
            return { maxCopyNumber: 3 } as T
          }
          return null
        },
        async all<T>() {
          return { results: [] as T[] }
        },
        async run() {
          statements.push({ query, bindings: [...bindings] })
          return { success: true }
        },
        async raw() {
          return []
        },
      }
    },
    async batch() {
      return []
    },
    async exec() {
      return { count: 0, duration: 0 }
    },
    async dump() {
      return new ArrayBuffer(0)
    },
  } as unknown as D1Database

  return { db, statements }
}

function createBindings(db: D1Database): AppBindings {
  return {
    DB: db,
    APP_CACHE: {} as KVNamespace,
    MEDIA_BUCKET: {} as R2Bucket,
    TASK_QUEUE: {} as Queue<any>,
    ACCESSION_COUNTER: {
      idFromName: () => ({}) as DurableObjectId,
      get: () => ({
        fetch: async () =>
          new Response(
            JSON.stringify({
              codes: [
                { accessionCode: 'CPL-000001', accessionSequence: 1 },
                { accessionCode: 'CPL-000002', accessionSequence: 2 },
              ],
            }),
            {
              headers: {
                'content-type': 'application/json',
              },
            },
          ),
      }),
    } as DurableObjectNamespace,
    ASSETS: {} as Fetcher,
    APP_NAME_BN: 'কমিউনিটি লাইব্রেরি',
    APP_NAME_EN: 'Community Library',
    APP_TIMEZONE: 'Asia/Dhaka',
    LIBRARY_CODE: 'CPL',
    DEFAULT_FINE_PER_DAY: '5',
    AI_BOOK_INTAKE_MODEL: '@cf/meta/llama-3.1-8b-instruct',
  }
}

describe('catalog intake rules', () => {
  it('rejects a completely blank intake seed', () => {
    const parsed = bookIntakeSeedSchema.safeParse({})
    expect(parsed.success).toBe(false)
  })

  it('flags an exact-ISBN duplicate as a strong add-copy candidate', () => {
    const candidate = evaluateDuplicateCandidate(
      {
        isbn13: '9789840000001',
        titleEn: 'River Stories',
        authors: ['Amina Rahman'],
        edition: '2nd',
        publisherName: 'Nodi Prokash',
        publicationYear: 2024,
      },
      makeRecord({
        isbn13: '9789840000001',
      }),
    )

    expect(candidate).not.toBeNull()
    expect(candidate?.exactIsbnMatch).toBe(true)
    expect(candidate?.similarityScore).toBe(1)
    expect(candidate?.resolutionHint).toBe('add_copy_to_existing_record')
  })

  it('ignores low-similarity matches', () => {
    const candidate = evaluateDuplicateCandidate(
      {
        titleEn: 'Physics Lab Manual',
        authors: ['Different Author'],
      },
      makeRecord({
        titleEn: 'River Stories',
        authors: ['Amina Rahman'],
      }),
    )

    expect(candidate).toBeNull()
  })

  it('creates copy, barcode, and QR records for each requested item', async () => {
    const { db, statements } = createFakeDb()
    const result = await createCopiesForRecord(
      createBindings(db),
      makeRecord({
        titleBn: 'নদীর গল্প',
      }),
      'actor-1',
      {
        quantity: 2,
        condition: 'good',
        acquisitionType: 'purchase',
        acquisitionDate: '2026-03-19',
        acquisitionPrice: 300,
        acquisitionSource: 'Book Shop',
        invoiceReference: 'INV-001',
        vendorName: 'Book Shop',
        locationRoom: 'Room A',
        locationRack: 'Rack 1',
        locationShelf: 'Shelf 2',
        notes: 'Batch import',
      },
    )

    expect(result.createdCopyIds).toHaveLength(2)
    expect(result.createdBarcodeValues).toEqual(['CPL-000001', 'CPL-000002'])
    expect(result.createdQrCodes).toHaveLength(2)
    expect(
      statements.filter((item) => item.query.includes('INSERT INTO book_copies')),
    ).toHaveLength(2)
    expect(
      statements.filter((item) => item.query.includes('INSERT INTO barcodes')),
    ).toHaveLength(2)
    expect(
      statements.filter((item) => item.query.includes('INSERT INTO qr_links')),
    ).toHaveLength(2)
  })
})
