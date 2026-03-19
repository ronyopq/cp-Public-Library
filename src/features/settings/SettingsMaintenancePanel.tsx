import { useState } from 'react'
import type { ExportSummaryPayload, ImportMode, ImportSummaryPayload } from '@shared/index'
import { toDhakaDisplay } from '@shared/index'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormField, SelectInput, TextInput } from '@/components/ui/FormField'
import { LoadingState } from '@/components/ui/LoadingState'
import { apiForm, apiPost, apiRequest, errorMessage } from '@/lib/api'

const CORE_BACKUP_TABLES = [
  'users',
  'roles',
  'permissions',
  'user_roles',
  'members',
  'bibliographic_records',
  'book_copies',
  'loans',
  'fines',
  'payments',
  'receipts',
  'app_settings',
  'feature_flags',
] as const

const FULL_BACKUP_TABLES = [
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

interface BackupQueuedPayload {
  exportId: string
  status: string
}

function ImportSummaryCard({
  title,
  summary,
}: {
  title: string
  summary: ImportSummaryPayload | null
}) {
  if (!summary) {
    return null
  }

  return (
    <article className="shell-card">
      <strong>{title}</strong>
      <p className="muted">
        মোট {summary.totalRows} row, তৈরি {summary.created}, আপডেট {summary.updated}, skip{' '}
        {summary.skipped}
      </p>
      {summary.errors.length > 0 ? (
        <div className="json-preview">
          <strong>ত্রুটি</strong>
          <pre>{summary.errors.map((item) => `Row ${item.row}: ${item.message}`).join('\n')}</pre>
        </div>
      ) : null}
    </article>
  )
}

export function SettingsMaintenancePanel() {
  const queryClient = useQueryClient()
  const [memberFile, setMemberFile] = useState<File | null>(null)
  const [catalogFile, setCatalogFile] = useState<File | null>(null)
  const [memberMode, setMemberMode] = useState<ImportMode>('create_only')
  const [catalogMode, setCatalogMode] = useState<ImportMode>('create_only')
  const [memberSummary, setMemberSummary] = useState<ImportSummaryPayload | null>(null)
  const [catalogSummary, setCatalogSummary] = useState<ImportSummaryPayload | null>(null)

  const exportsQuery = useQuery({
    queryKey: ['admin-exports'],
    queryFn: () => apiRequest<ExportSummaryPayload>('/api/admin/exports'),
  })

  const backupMutation = useMutation({
    mutationFn: (tables: readonly string[]) =>
      apiPost<BackupQueuedPayload>('/api/admin/backups', { tables }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-exports'] })
    },
  })

  const memberImportMutation = useMutation({
    mutationFn: async () => {
      if (!memberFile) {
        throw new Error('একটি member CSV নির্বাচন করুন।')
      }
      const formData = new FormData()
      formData.set('file', memberFile)
      formData.set('mode', memberMode)
      return apiForm<{ summary: ImportSummaryPayload }>('/api/admin/imports/members', formData)
    },
    onSuccess: async (payload) => {
      setMemberSummary(payload.summary)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['members'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-exports'] }),
      ])
    },
  })

  const catalogImportMutation = useMutation({
    mutationFn: async () => {
      if (!catalogFile) {
        throw new Error('একটি catalog CSV নির্বাচন করুন।')
      }
      const formData = new FormData()
      formData.set('file', catalogFile)
      formData.set('mode', catalogMode)
      return apiForm<{ summary: ImportSummaryPayload }>('/api/admin/imports/catalog', formData)
    },
    onSuccess: async (payload) => {
      setCatalogSummary(payload.summary)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['books'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-exports'] }),
      ])
    },
  })

  return (
    <section className="content-card section-grid">
      <div className="content-card__header">
        <div>
          <h2>Import, Backup এবং Export Ops</h2>
          <p className="muted">
            Excel থেকে CSV export করে import করুন। বড় ব্যাকআপ Queue হয়ে R2-এ সংরক্ষিত হবে।
          </p>
        </div>
      </div>

      <div className="split-grid">
        <article className="shell-card section-grid">
          <h3>Member CSV Import</h3>
          <FormField label="Import mode">
            <SelectInput value={memberMode} onChange={(event) => setMemberMode(event.target.value as ImportMode)}>
              <option value="create_only">Create only</option>
              <option value="upsert">Upsert</option>
            </SelectInput>
          </FormField>
          <TextInput
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setMemberFile(event.target.files?.[0] ?? null)}
          />
          <Button type="button" onClick={() => void memberImportMutation.mutate()} disabled={memberImportMutation.isPending}>
            {memberImportMutation.isPending ? 'Import হচ্ছে...' : 'Member import চালু করুন'}
          </Button>
          {memberImportMutation.isError ? (
            <div className="error-banner">{errorMessage(memberImportMutation.error)}</div>
          ) : null}
          <ImportSummaryCard title="Member import summary" summary={memberSummary} />
        </article>

        <article className="shell-card section-grid">
          <h3>Catalog CSV Import</h3>
          <FormField label="Import mode">
            <SelectInput value={catalogMode} onChange={(event) => setCatalogMode(event.target.value as ImportMode)}>
              <option value="create_only">Create only</option>
              <option value="upsert">Upsert</option>
            </SelectInput>
          </FormField>
          <TextInput
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setCatalogFile(event.target.files?.[0] ?? null)}
          />
          <Button type="button" onClick={() => void catalogImportMutation.mutate()} disabled={catalogImportMutation.isPending}>
            {catalogImportMutation.isPending ? 'Import হচ্ছে...' : 'Catalog import চালু করুন'}
          </Button>
          {catalogImportMutation.isError ? (
            <div className="error-banner">{errorMessage(catalogImportMutation.error)}</div>
          ) : null}
          <ImportSummaryCard title="Catalog import summary" summary={catalogSummary} />
        </article>
      </div>

      <div className="split-grid">
        <article className="shell-card section-grid">
          <h3>System Backup</h3>
          <p className="muted">Core backup দ্রুত। Full backup-এ operational tables-ও থাকবে।</p>
          <div className="page-actions">
            <Button type="button" variant="ghost" onClick={() => void backupMutation.mutate(CORE_BACKUP_TABLES)} disabled={backupMutation.isPending}>
              Core backup queue
            </Button>
            <Button type="button" variant="secondary" onClick={() => void backupMutation.mutate(FULL_BACKUP_TABLES)} disabled={backupMutation.isPending}>
              Full backup queue
            </Button>
          </div>
          {backupMutation.isError ? (
            <div className="error-banner">{errorMessage(backupMutation.error)}</div>
          ) : null}
          {backupMutation.data ? (
            <div className="warning-banner">
              Backup request queued হয়েছে। Export ID: {backupMutation.data.exportId}
            </div>
          ) : null}
        </article>

        <article className="shell-card section-grid">
          <h3>Recent Exports</h3>
          {exportsQuery.isLoading ? (
            <LoadingState label="Export history লোড হচ্ছে..." />
          ) : exportsQuery.isError ? (
            <EmptyState title="Export history পাওয়া যায়নি" description={errorMessage(exportsQuery.error)} />
          ) : (
            <DataTable
              items={exportsQuery.data?.items ?? []}
              empty={<EmptyState title="কোনও export নেই" description="নতুন report বা backup তৈরি হলে এখানে দেখা যাবে।" />}
              columns={[
                {
                  key: 'type',
                  header: 'ধরন',
                  render: (item) => (
                    <div>
                      <strong>{item.exportType}</strong>
                      <p className="muted">{item.exportFormat}</p>
                    </div>
                  ),
                },
                {
                  key: 'status',
                  header: 'স্ট্যাটাস',
                  render: (item) => item.status,
                },
                {
                  key: 'time',
                  header: 'সময়',
                  render: (item) => (
                    <div>
                      <strong>{toDhakaDisplay(item.createdAt)}</strong>
                      <p className="muted">{item.completedAt ? toDhakaDisplay(item.completedAt) : 'চলমান'}</p>
                    </div>
                  ),
                },
                {
                  key: 'actions',
                  header: 'ফাইল',
                  render: (item) =>
                    item.outputUrl ? (
                      <a href={item.outputUrl} target="_blank" rel="noreferrer">
                        {item.fileName ?? 'ফাইল খুলুন'}
                      </a>
                    ) : (
                      item.fileName ?? 'প্রস্তুত হয়নি'
                    ),
                },
              ]}
            />
          )}
        </article>
      </div>
    </section>
  )
}
