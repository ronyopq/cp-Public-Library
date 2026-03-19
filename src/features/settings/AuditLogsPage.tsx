import { useMemo, useState } from 'react'
import {
  toDhakaDisplay,
  type AppRole,
  type AuditLogFilters,
  type AuditLogListPayload,
  type AuditLogRecord,
} from '@shared/index'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormField, SelectInput, TextInput } from '@/components/ui/FormField'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
import { useLocalStorageState } from '@/hooks/useLocalStorageState'
import { apiRequest, errorMessage } from '@/lib/api'

const roleOptions: AppRole[] = [
  'member',
  'librarian',
  'officer',
  'manager',
  'admin',
  'super_admin',
]

const defaultFilters: AuditLogFilters = {
  page: 1,
  pageSize: 25,
  search: '',
  actionKey: '',
  entityType: '',
  actorRoleKey: '',
  startDate: '',
  endDate: '',
}

function buildAuditQuery(filters: AuditLogFilters) {
  const params = new URLSearchParams()
  params.set('page', String(filters.page))
  params.set('pageSize', String(filters.pageSize))

  if (filters.search) {
    params.set('search', filters.search)
  }
  if (filters.actionKey) {
    params.set('actionKey', filters.actionKey)
  }
  if (filters.entityType) {
    params.set('entityType', filters.entityType)
  }
  if (filters.actorRoleKey) {
    params.set('actorRoleKey', filters.actorRoleKey)
  }
  if (filters.startDate) {
    params.set('startDate', filters.startDate)
  }
  if (filters.endDate) {
    params.set('endDate', filters.endDate)
  }

  return params.toString()
}

function formatJson(value: Record<string, unknown> | null | undefined) {
  if (!value) {
    return 'কোনো ডাটা নেই'
  }

  return JSON.stringify(value, null, 2)
}

export function AuditLogsPage() {
  const [filters, setFilters] = useLocalStorageState('plms-audit-filters-v2', defaultFilters)
  const [selectedLog, setSelectedLog] = useState<AuditLogRecord | null>(null)

  const auditQuery = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () =>
      apiRequest<AuditLogListPayload>(`/api/admin/audit-logs?${buildAuditQuery(filters)}`),
  })

  const data = auditQuery.data
  const totalPages = Math.max(
    1,
    Math.ceil((data?.total ?? 0) / Math.max(1, data?.pageSize ?? filters.pageSize)),
  )

  const suggestions = useMemo(() => {
    const items = data?.items ?? []
    return {
      actions: [...new Set(items.map((item) => item.actionKey))].slice(0, 12),
      entityTypes: [...new Set(items.map((item) => item.entityType))].slice(0, 12),
    }
  }, [data?.items])

  if (auditQuery.isLoading) {
    return <LoadingState label="অডিট লগ লোড হচ্ছে..." />
  }

  if (auditQuery.isError) {
    return (
      <EmptyState
        title="অডিট লগ লোড করা যায়নি"
        description={errorMessage(auditQuery.error)}
      />
    )
  }

  if (!data) {
    return (
      <EmptyState
        title="অডিট লগ পাওয়া যায়নি"
        description="পরে আবার চেষ্টা করুন।"
      />
    )
  }

  return (
    <div className="page-stack">
      <div className="page-header content-card">
        <h1>অডিট লগ ভিউয়ার</h1>
        <p>
          Authentication, settings, user, accounting, import/export, এবং অন্যান্য
          সংবেদনশীল পরিবর্তনের নির্ভরযোগ্য ইতিহাস এখানে দেখা যাবে।
        </p>
      </div>

      <section className="content-card section-grid">
        <div className="content-card__header">
          <div>
            <h2>ফিল্টার</h2>
            <p className="muted">
              মোট {data.total}টি এন্ট্রি পাওয়া গেছে। প্রয়োজন হলে তারিখ, role, action, বা
              entity দিয়ে সংকুচিত করুন।
            </p>
          </div>
          <div className="page-actions">
            <Button type="button" variant="ghost" onClick={() => setFilters(defaultFilters)}>
              রিসেট
            </Button>
          </div>
        </div>

        <div className="form-grid form-grid--three">
          <FormField label="সার্চ">
            <TextInput
              value={filters.search}
              onChange={(event) =>
                setFilters({ ...filters, search: event.target.value, page: 1 })
              }
              placeholder="actor, action, entity, note"
            />
          </FormField>

          <FormField label="Action key">
            <TextInput
              list="audit-action-options"
              value={filters.actionKey ?? ''}
              onChange={(event) =>
                setFilters({ ...filters, actionKey: event.target.value, page: 1 })
              }
              placeholder="users.update"
            />
            <datalist id="audit-action-options">
              {suggestions.actions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </FormField>

          <FormField label="Entity type">
            <TextInput
              list="audit-entity-options"
              value={filters.entityType ?? ''}
              onChange={(event) =>
                setFilters({ ...filters, entityType: event.target.value, page: 1 })
              }
              placeholder="payment, user, member"
            />
            <datalist id="audit-entity-options">
              {suggestions.entityTypes.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </FormField>

          <FormField label="Actor role">
            <SelectInput
              value={filters.actorRoleKey ?? ''}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  actorRoleKey: event.target.value as AuditLogFilters['actorRoleKey'],
                  page: 1,
                })
              }
            >
              <option value="">সব role</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField label="শুরু তারিখ">
            <TextInput
              type="date"
              value={filters.startDate ?? ''}
              onChange={(event) =>
                setFilters({ ...filters, startDate: event.target.value, page: 1 })
              }
            />
          </FormField>

          <FormField label="শেষ তারিখ">
            <TextInput
              type="date"
              value={filters.endDate ?? ''}
              onChange={(event) =>
                setFilters({ ...filters, endDate: event.target.value, page: 1 })
              }
            />
          </FormField>
        </div>
      </section>

      <section className="content-card section-grid">
        <div className="content-card__header">
          <div>
            <h2>লগ তালিকা</h2>
            <p className="muted">
              Page {data.page} / {totalPages}
            </p>
          </div>
          <FormField label="প্রতি পৃষ্ঠা">
            <SelectInput
              value={String(filters.pageSize)}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  pageSize: Number(event.target.value),
                  page: 1,
                })
              }
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </SelectInput>
          </FormField>
        </div>

        <DataTable
          items={data.items}
          empty={
            <EmptyState
              title="কোনো অডিট এন্ট্রি নেই"
              description="এই ফিল্টারে কোনো matching audit log পাওয়া যায়নি।"
            />
          }
          columns={[
            {
              key: 'actor',
              header: 'Actor',
              render: (item) => (
                <div>
                  <strong>{item.actorDisplayName}</strong>
                  <p className="muted">{item.actorRoleKey ?? 'system'}</p>
                </div>
              ),
            },
            {
              key: 'action',
              header: 'Action',
              render: (item) => <code>{item.actionKey}</code>,
            },
            {
              key: 'entity',
              header: 'Entity',
              render: (item) => (
                <div>
                  <strong>{item.entityType}</strong>
                  <p className="muted">{item.entityId}</p>
                </div>
              ),
            },
            {
              key: 'note',
              header: 'নোট',
              render: (item) => item.note ?? 'নোট নেই',
            },
            {
              key: 'time',
              header: 'সময়',
              render: (item) => toDhakaDisplay(item.createdAt),
            },
            {
              key: 'details',
              header: 'বিস্তারিত',
              render: (item) => (
                <Button type="button" variant="ghost" onClick={() => setSelectedLog(item)}>
                  দেখুন
                </Button>
              ),
            },
          ]}
        />

        <div className="page-actions">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setFilters({ ...filters, page: Math.max(1, filters.page - 1) })}
            disabled={filters.page <= 1}
          >
            আগের পৃষ্ঠা
          </Button>
          <span className="muted">
            পৃষ্ঠা {filters.page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              setFilters({ ...filters, page: Math.min(totalPages, filters.page + 1) })
            }
            disabled={filters.page >= totalPages}
          >
            পরের পৃষ্ঠা
          </Button>
        </div>
      </section>

      <Modal
        open={Boolean(selectedLog)}
        title="অডিট বিস্তারিত"
        onClose={() => setSelectedLog(null)}
        footer={
          <Button type="button" variant="ghost" onClick={() => setSelectedLog(null)}>
            বন্ধ করুন
          </Button>
        }
      >
        {selectedLog ? (
          <div className="section-grid">
            <div className="split-grid split-grid--audit">
              <div className="shell-card section-grid">
                <div>
                  <p className="muted">Actor</p>
                  <strong>{selectedLog.actorDisplayName}</strong>
                </div>
                <div>
                  <p className="muted">Role</p>
                  <strong>{selectedLog.actorRoleKey ?? 'system'}</strong>
                </div>
                <div>
                  <p className="muted">সময়</p>
                  <strong>{toDhakaDisplay(selectedLog.createdAt)}</strong>
                </div>
              </div>

              <div className="shell-card section-grid">
                <div>
                  <p className="muted">Action</p>
                  <strong>{selectedLog.actionKey}</strong>
                </div>
                <div>
                  <p className="muted">Entity</p>
                  <strong>
                    {selectedLog.entityType} / {selectedLog.entityId}
                  </strong>
                </div>
                <div>
                  <p className="muted">Request ID</p>
                  <strong>{selectedLog.requestId ?? 'নেই'}</strong>
                </div>
              </div>
            </div>

            <div className="split-grid split-grid--audit">
              <div className="shell-card section-grid">
                <div>
                  <p className="muted">IP address</p>
                  <strong>{selectedLog.ipAddress ?? 'নেই'}</strong>
                </div>
                <div>
                  <p className="muted">User agent</p>
                  <strong>{selectedLog.userAgent ?? 'নেই'}</strong>
                </div>
              </div>

              <div className="shell-card section-grid">
                <div>
                  <p className="muted">নোট</p>
                  <strong>{selectedLog.note ?? 'নোট নেই'}</strong>
                </div>
              </div>
            </div>

            <div className="split-grid split-grid--audit">
              <div className="json-preview">
                <strong>Before</strong>
                <pre>{formatJson(selectedLog.before)}</pre>
              </div>
              <div className="json-preview">
                <strong>After</strong>
                <pre>{formatJson(selectedLog.after)}</pre>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
