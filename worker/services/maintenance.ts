import type {
  BackupRequestPayload,
  ExportSummaryPayload,
  ExportSummaryRecord,
  ImportMode,
  ImportSummaryPayload,
  SessionUser,
} from '@shared/index'
import { dhakaNow, readCsvLines } from '@shared/utils'
import type { AppBindings } from '../types'
import { getUserAuthorization } from '../lib/auth'
import { writeAudit } from '../lib/audit'
import { dbAll, dbFirst, dbRun } from '../lib/db'
import { buildR2Key, putFile } from '../lib/storage'
import { getMemberProfile, createMember, updateMember } from './members'
import { detectDuplicateBooks, saveCatalogIntake } from './catalog'

const BACKUP_TABLES = [
  'accounts',
  'acquisition_records',
  'app_settings',
  'audit_logs',
  'barcodes',
  'bibliographic_records',
  'book_contributors',
  'book_copies',
  'categories',
  'competition_registrations',
  'competition_results',
  'competitions',
  'exports',
  'feature_flags',
  'fee_types',
  'fines',
  'languages',
  'ledgers',
  'loan_history',
  'loans',
  'member_fee_periods',
  'members',
  'payment_allocations',
  'payment_types',
  'payments',
  'permissions',
  'print_jobs',
  'print_templates',
  'publishers',
  'qr_links',
  'racks',
  'receipts',
  'reminders',
  'reservations',
  'role_permissions',
  'roles',
  'rooms',
  'sessions',
  'shelves',
  'user_permission_overrides',
  'user_roles',
  'users',
] as const

type BackupTableName = (typeof BACKUP_TABLES)[number]

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

function stringValue(
  row: Record<string, string>,
  keys: string[],
  fallback = '',
) {
  for (const key of keys) {
    const value = row[normalizeHeader(key)]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }
  return fallback
}

function nullableValue(row: Record<string, string>, keys: string[]) {
  const value = stringValue(row, keys)
  return value || undefined
}

function numberValue(row: Record<string, string>, keys: string[]) {
  const value = stringValue(row, keys)
  if (!value) {
    return undefined
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function booleanValue(row: Record<string, string>, keys: string[], fallback = true) {
  const value = stringValue(row, keys).toLowerCase()
  if (!value) {
    return fallback
  }
  return ['1', 'true', 'yes', 'y', 'public', 'on'].includes(value)
}

function listValue(row: Record<string, string>, keys: string[]) {
  const raw = stringValue(row, keys)
  if (!raw) {
    return [] as string[]
  }

  return [...new Set(raw.split(/[|;,]/).map((item) => item.trim()).filter(Boolean))]
}

function toRowObjects(lines: string[][]) {
  const [headerRow, ...dataRows] = lines
  const headers = headerRow.map(normalizeHeader)
  return dataRows.map((cells, index) => {
    const row: Record<string, string> = {}
    headers.forEach((header, headerIndex) => {
      row[header] = cells[headerIndex]?.trim() ?? ''
    })
    return {
      rowNumber: index + 2,
      row,
    }
  })
}

function assertImportRows(csvText: string) {
  const lines = readCsvLines(csvText)
  if (lines.length < 2) {
    throw new Error('CSV ফাইলে অন্তত একটি header row এবং একটি data row থাকতে হবে।')
  }
  if (lines.length > 1001) {
    throw new Error('একসাথে সর্বোচ্চ 1000 টি data row import করা যাবে।')
  }
  return lines
}

function mapExportRow(row: {
  id: string
  exportType: string
  exportFormat: string
  status: string
  fileName: string | null
  outputKey: string | null
  note: string | null
  requestedByNameBn: string | null
  createdAt: string
  completedAt: string | null
}): ExportSummaryRecord {
  return {
    id: row.id,
    exportType: row.exportType,
    exportFormat: row.exportFormat,
    status: row.status,
    fileName: row.fileName,
    outputKey: row.outputKey,
    outputUrl: row.outputKey ? `/files/${encodeURIComponent(row.outputKey)}` : null,
    note: row.note,
    requestedByNameBn: row.requestedByNameBn,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  }
}

async function lookupMemberId(
  db: D1Database,
  memberCode?: string,
  phone?: string,
) {
  const normalizedCode = memberCode?.trim() ?? ''
  const normalizedPhone = phone?.trim() ?? ''
  if (!normalizedCode && !normalizedPhone) {
    return null
  }

  return dbFirst<{ id: string }>(
    db,
    `
      SELECT id
      FROM members
      WHERE deleted_at IS NULL
        AND (
          (? <> '' AND member_no = ?)
          OR (? <> '' AND phone = ?)
        )
      LIMIT 1
    `,
    [normalizedCode, normalizedCode, normalizedPhone, normalizedPhone],
  )
}

async function lookupCategoryId(db: D1Database, value?: string, parentId?: string | null) {
  const normalized = value?.trim() ?? ''
  if (!normalized) {
    return undefined
  }

  const row = await dbFirst<{ id: string }>(
    db,
    `
      SELECT id
      FROM categories
      WHERE deleted_at IS NULL
        AND active = 1
        AND (
          id = ?
          OR lower(COALESCE(name_bn, '')) = lower(?)
          OR lower(COALESCE(name_en, '')) = lower(?)
          OR lower(COALESCE(slug, '')) = lower(?)
        )
        AND (
          (? IS NULL AND parent_category_id IS NULL)
          OR parent_category_id = ?
        )
      LIMIT 1
    `,
    [normalized, normalized, normalized, normalized, parentId ?? null, parentId ?? null],
  )

  return row?.id
}

async function lookupLanguageCode(db: D1Database, value?: string) {
  const normalized = value?.trim() ?? ''
  if (!normalized) {
    return 'bn'
  }

  const row = await dbFirst<{ isoCode: string }>(
    db,
    `
      SELECT iso_code AS isoCode
      FROM languages
      WHERE deleted_at IS NULL
        AND active = 1
        AND (
          lower(iso_code) = lower(?)
          OR lower(COALESCE(name_bn, '')) = lower(?)
          OR lower(COALESCE(name_en, '')) = lower(?)
        )
      LIMIT 1
    `,
    [normalized, normalized, normalized],
  )

  return row?.isoCode ?? normalized.toLowerCase() ?? 'bn'
}

async function loadRequestedActor(db: D1Database, actorId: string) {
  const actor = await getUserAuthorization(db, actorId)
  if (!actor) {
    throw new Error('Backup export actor could not be resolved.')
  }
  return actor
}

export async function listRecentExports(
  db: D1Database,
  limit = 25,
): Promise<ExportSummaryPayload> {
  const rows = await dbAll<{
    id: string
    exportType: string
    exportFormat: string
    status: string
    fileName: string | null
    outputKey: string | null
    note: string | null
    requestedByNameBn: string | null
    createdAt: string
    completedAt: string | null
  }>(
    db,
    `
      SELECT
        exports.id AS id,
        exports.export_type AS exportType,
        exports.export_format AS exportFormat,
        exports.status AS status,
        exports.file_name AS fileName,
        exports.output_r2_key AS outputKey,
        exports.note AS note,
        users.full_name_bn AS requestedByNameBn,
        exports.created_at AS createdAt,
        exports.completed_at AS completedAt
      FROM exports
      LEFT JOIN users ON users.id = exports.requested_by_user_id
      ORDER BY exports.created_at DESC
      LIMIT ?
    `,
    [limit],
  )

  return {
    items: rows.map(mapExportRow),
  }
}

export async function requestSystemBackupExport(
  env: AppBindings,
  actor: SessionUser,
  payload: BackupRequestPayload,
  requestId?: string | null,
) {
  const requestedTables = [...new Set(payload.tables.map((item) => item.trim() as BackupTableName))]
  const unsupported = requestedTables.filter(
    (item) => !BACKUP_TABLES.includes(item as BackupTableName),
  )
  if (unsupported.length > 0) {
    throw new Error(`Unsupported backup tables: ${unsupported.join(', ')}`)
  }

  const exportId = crypto.randomUUID()
  const note = payload.note?.trim() || 'System backup requested'
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
        note,
        created_at,
        filter_json,
        file_name
      )
      VALUES (?, 'system_backup', 'json', ?, ?, 'queued', ?, ?, ?, ?)
    `,
    [
      exportId,
      JSON.stringify(requestedTables),
      actor.id,
      note,
      dhakaNow(),
      JSON.stringify({ tables: requestedTables }),
      `system-backup-${exportId}.json`,
    ],
  )

  await env.TASK_QUEUE.send({
    type: 'export-snapshot',
    exportId,
    tableNames: requestedTables,
    actorId: actor.id,
  })

  await writeAudit(
    env.DB,
    actor,
    'maintenance.backup.requested',
    'export',
    exportId,
    'System backup export has been queued.',
    {
      requestId: requestId ?? null,
      after: { tables: requestedTables, note },
    },
  )

  return {
    exportId,
    status: 'queued',
  }
}

export async function runSystemBackupExport(
  env: AppBindings,
  exportId: string,
  tableNames: string[],
  actorId: string,
) {
  const validTables = tableNames.filter((item): item is BackupTableName =>
    BACKUP_TABLES.includes(item as BackupTableName),
  )
  if (validTables.length === 0) {
    throw new Error('No valid tables were supplied for the backup export.')
  }

  await dbRun(
    env.DB,
    `UPDATE exports SET status = 'processing', note = ?, completed_at = NULL WHERE id = ?`,
    ['System backup is being generated', exportId],
  )

  try {
    const snapshot: Record<string, unknown> = {
      exportId,
      generatedAt: dhakaNow(),
      tables: {} as Record<string, unknown>,
    }

    for (const tableName of validTables) {
      ;(snapshot.tables as Record<string, unknown>)[tableName] = await dbAll<Record<string, unknown>>(
        env.DB,
        `SELECT * FROM ${tableName}`,
      )
    }

    const fileName = `system-backup-${exportId}.json`
    const outputKey = buildR2Key('exports', fileName)
    const file = new File([JSON.stringify(snapshot, null, 2)], fileName, {
      type: 'application/json; charset=utf-8',
    })
    await putFile(env.MEDIA_BUCKET, outputKey, file, {
      exportType: 'system_backup',
      exportId,
    })

    await dbRun(
      env.DB,
      `
        UPDATE exports
        SET
          status = 'completed',
          output_r2_key = ?,
          completed_at = ?,
          note = ?,
          file_name = ?,
          filter_json = ?
        WHERE id = ?
      `,
      [
        outputKey,
        dhakaNow(),
        'System backup export generated',
        fileName,
        JSON.stringify({ tables: validTables }),
        exportId,
      ],
    )

    const actor = await loadRequestedActor(env.DB, actorId)
    await writeAudit(
      env.DB,
      actor,
      'maintenance.backup.completed',
      'export',
      exportId,
      'System backup export completed.',
      {
        after: { tables: validTables, outputKey },
      },
    )
  } catch (error) {
    await dbRun(
      env.DB,
      `UPDATE exports SET status = 'failed', completed_at = ?, note = ? WHERE id = ?`,
      [
        dhakaNow(),
        error instanceof Error ? error.message : 'System backup failed.',
        exportId,
      ],
    )
    throw error
  }
}

export async function importMembersFromCsv(
  env: AppBindings,
  actor: SessionUser,
  csvText: string,
  mode: ImportMode,
  requestId?: string | null,
): Promise<ImportSummaryPayload> {
  const rows = toRowObjects(assertImportRows(csvText))
  const result: ImportSummaryPayload = {
    kind: 'members',
    mode,
    totalRows: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  }

  for (const entry of rows) {
    try {
      const memberCode = nullableValue(entry.row, ['membership_id', 'member_code', 'member_no'])
      const fullNameBn = stringValue(entry.row, ['name', 'full_name_bn', 'name_bn'])
      const phone = stringValue(entry.row, ['mobile', 'phone'])
      const addressLine = stringValue(entry.row, ['address', 'address_line'])
      if (!fullNameBn || !phone || !addressLine) {
        throw new Error('নাম, মোবাইল এবং ঠিকানা আবশ্যক।')
      }

      const memberStatusInput = stringValue(entry.row, ['status']).toLowerCase()
      const memberStatus =
        memberStatusInput === 'inactive' ||
        memberStatusInput === 'suspended' ||
        memberStatusInput === 'expired'
          ? memberStatusInput
          : 'active'

      const payload = {
        memberCode,
        fullNameBn,
        fullNameEn: nullableValue(entry.row, ['full_name_en', 'name_en']),
        guardianName: nullableValue(entry.row, ['guardian', 'guardian_name']),
        email: nullableValue(entry.row, ['email']),
        phone,
        nationalId: nullableValue(entry.row, ['national_id', 'nid']),
        addressLine,
        area: nullableValue(entry.row, ['area']),
        district: nullableValue(entry.row, ['district', 'division']),
        dateOfBirth: nullableValue(entry.row, ['date_of_birth', 'dob']),
        joinedAt: nullableValue(entry.row, ['join_date', 'joined_at']) ?? undefined,
        membershipExpiresAt:
          nullableValue(entry.row, ['expiry_date', 'membership_expires_at']) ?? undefined,
        memberStatus,
        photoKey: undefined,
        notes: nullableValue(entry.row, ['notes', 'note']),
      }

      const existingMatch = await lookupMemberId(env.DB, memberCode, phone)
      if (existingMatch && mode === 'create_only') {
        result.skipped += 1
        continue
      }

      if (existingMatch && mode === 'upsert') {
        const current = await getMemberProfile(env.DB, existingMatch.id)
        if (!current) {
          throw new Error('বিদ্যমান সদস্য লোড করা যায়নি।')
        }
        await updateMember(
          env,
          actor,
          existingMatch.id,
          {
            fullNameBn: payload.fullNameBn || current.member.fullNameBn,
            fullNameEn: payload.fullNameEn ?? current.member.fullNameEn ?? '',
            guardianName: payload.guardianName ?? current.member.guardianName ?? '',
            email: payload.email ?? current.member.email ?? '',
            phone: payload.phone || current.member.phone,
            nationalId: payload.nationalId ?? current.member.nationalId ?? '',
            addressLine: payload.addressLine || current.member.addressLine,
            area: payload.area ?? current.member.area ?? '',
            district: payload.district ?? current.member.district ?? '',
            dateOfBirth: payload.dateOfBirth ?? current.member.dateOfBirth ?? '',
            joinedAt: payload.joinedAt ?? current.member.joinedAt,
            membershipExpiresAt:
              payload.membershipExpiresAt ?? current.member.membershipExpiresAt ?? '',
            memberStatus: payload.memberStatus as any,
            photoKey: current.member.photoKey ?? '',
            notes: payload.notes ?? current.member.notes ?? '',
          },
          requestId,
        )
        result.updated += 1
        continue
      }

      await createMember(env, actor, payload as any, requestId)
      result.created += 1
    } catch (error) {
      result.errors.push({
        row: entry.rowNumber,
        message: error instanceof Error ? error.message : 'Member import failed.',
      })
    }
  }

  await writeAudit(
    env.DB,
    actor,
    'maintenance.import.members',
    'import',
    crypto.randomUUID(),
    'Bulk member import completed.',
    {
      requestId: requestId ?? null,
      after: result,
    },
  )

  return result
}

export async function importCatalogFromCsv(
  env: AppBindings,
  actor: SessionUser,
  csvText: string,
  mode: ImportMode,
  requestId?: string | null,
): Promise<ImportSummaryPayload> {
  const rows = toRowObjects(assertImportRows(csvText))
  const result: ImportSummaryPayload = {
    kind: 'catalog',
    mode,
    totalRows: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  }

  for (const entry of rows) {
    try {
      const titleBn = nullableValue(entry.row, ['title_bn'])
      const titleEn =
        nullableValue(entry.row, ['title_en', 'title']) ??
        titleBn ??
        undefined
      const isbn13 = nullableValue(entry.row, ['isbn13', 'isbn_13'])
      const isbn10 = nullableValue(entry.row, ['isbn10', 'isbn_10'])
      if (!titleBn && !titleEn && !isbn10 && !isbn13) {
        throw new Error('শিরোনাম অথবা ISBN ছাড়া বই import করা যাবে না।')
      }

      const categoryId = await lookupCategoryId(
        env.DB,
        nullableValue(entry.row, ['category_id', 'category']),
      )
      const subcategoryId = await lookupCategoryId(
        env.DB,
        nullableValue(entry.row, ['subcategory_id', 'subcategory']),
        categoryId ?? null,
      )
      const languageCode = await lookupLanguageCode(
        env.DB,
        nullableValue(entry.row, ['language_code', 'language']),
      )
      const copyQuantity = Math.max(0, numberValue(entry.row, ['copy_quantity', 'quantity']) ?? 1)

      const record = {
        recordCode: nullableValue(entry.row, ['record_code']),
        isbn10,
        isbn13,
        titleBn,
        titleEn,
        subtitleBn: nullableValue(entry.row, ['subtitle_bn']),
        subtitleEn: nullableValue(entry.row, ['subtitle_en', 'subtitle']),
        authors: listValue(entry.row, ['authors', 'author']),
        coAuthors: listValue(entry.row, ['co_authors']),
        editors: listValue(entry.row, ['editors', 'editor']),
        translators: listValue(entry.row, ['translators', 'translator']),
        publisherName: nullableValue(entry.row, ['publisher', 'publisher_name']),
        edition: nullableValue(entry.row, ['edition']),
        languageCode,
        publicationYear: numberValue(entry.row, ['publication_year', 'year']),
        pageCount: numberValue(entry.row, ['page_count', 'pages']),
        categoryId,
        subcategoryId,
        tags: listValue(entry.row, ['tags', 'keywords']),
        summary: nullableValue(entry.row, ['summary', 'description']),
        notes: nullableValue(entry.row, ['notes', 'internal_notes']),
        publicVisibility: booleanValue(entry.row, ['public_visibility', 'is_public'], true),
        coverImageKey: undefined,
        coverThumbnailKey: undefined,
        metadataPageKey: undefined,
        sourceUrl: nullableValue(entry.row, ['source_url']),
        sourceNote: nullableValue(entry.row, ['source_note']),
        recordStatus: 'active' as const,
      }

      let strategy: 'create_new_record' | 'use_existing_record' | 'add_copy_to_existing_record' =
        'create_new_record'
      let existingRecordId = ''
      if (mode === 'upsert') {
        const duplicates = await detectDuplicateBooks(env.DB, record)
        const matched =
          duplicates.find((item) => item.exactIsbnMatch) ??
          duplicates.find((item) => item.similarityScore >= 0.92)
        if (matched) {
          existingRecordId = matched.record.id
          strategy = copyQuantity > 0 ? 'add_copy_to_existing_record' : 'use_existing_record'
        }
      }

      const saveResult = await saveCatalogIntake(
        env,
        actor,
        {
          seed: {
            isbn: isbn13 ?? isbn10 ?? undefined,
            sourceUrl: record.sourceUrl,
            manualTitle: titleBn ?? titleEn ?? undefined,
            manualAuthor: record.authors[0] ?? undefined,
            manualPublisher: record.publisherName,
            notes: undefined,
          },
          record,
          copies: {
            quantity: copyQuantity,
            condition: (nullableValue(entry.row, ['condition']) as any) ?? 'good',
            acquisitionType: (nullableValue(entry.row, ['acquisition_type']) as any) ?? 'other',
            acquisitionDate: nullableValue(entry.row, ['acquisition_date']),
            acquisitionPrice: numberValue(entry.row, ['acquisition_price']),
            acquisitionSource: nullableValue(entry.row, ['acquisition_source']),
            invoiceReference: nullableValue(entry.row, ['invoice_reference']),
            vendorName: nullableValue(entry.row, ['vendor_name']),
            locationRoom: nullableValue(entry.row, ['location_room', 'room']),
            locationRack: nullableValue(entry.row, ['location_rack', 'rack']),
            locationShelf: nullableValue(entry.row, ['location_shelf', 'shelf']),
            notes: nullableValue(entry.row, ['copy_notes']),
          },
          duplicateResolution: {
            strategy,
            existingRecordId,
          },
        },
        requestId,
      )

      if (saveResult.duplicateStrategy === 'create_new_record') {
        result.created += 1
      } else {
        result.updated += 1
      }
    } catch (error) {
      result.errors.push({
        row: entry.rowNumber,
        message: error instanceof Error ? error.message : 'Catalog import failed.',
      })
    }
  }

  await writeAudit(
    env.DB,
    actor,
    'maintenance.import.catalog',
    'import',
    crypto.randomUUID(),
    'Bulk catalog import completed.',
    {
      requestId: requestId ?? null,
      after: result,
    },
  )

  return result
}
