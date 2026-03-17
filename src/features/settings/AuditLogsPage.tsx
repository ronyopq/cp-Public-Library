import { useQuery } from '@tanstack/react-query'
import { toDhakaDisplay } from '@shared/index'
import { DataTable } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { TextInput } from '@/components/ui/FormField'
import { LoadingState } from '@/components/ui/LoadingState'
import { useLocalStorageState } from '@/hooks/useLocalStorageState'
import { apiRequest } from '@/lib/api'

interface AuditPayload {
  items: Array<{
    id: string
    actorDisplayName: string
    actorRoleKey: string | null
    actionKey: string
    entityType: string
    entityId: string
    note: string | null
    createdAt: string
  }>
  page: number
  pageSize: number
  total: number
}

export function AuditLogsPage() {
  const [filters, setFilters] = useLocalStorageState('plms-audit-filters', {
    search: '',
    page: 1,
    pageSize: 20,
  })

  const auditQuery = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () =>
      apiRequest<AuditPayload>(
        `/api/admin/audit-logs?search=${encodeURIComponent(filters.search)}&page=${filters.page}&pageSize=${filters.pageSize}`,
      ),
  })

  if (auditQuery.isLoading) {
    return <LoadingState label="অডিট লগ লোড হচ্ছে..." />
  }

  const data = auditQuery.data
  if (!data) {
    return <EmptyState title="অডিট লগ পাওয়া যায়নি" description="পরে আবার চেষ্টা করুন।" />
  }

  return (
    <div className="page-stack">
      <div className="page-header content-card">
        <h1>অডিট লগ</h1>
        <p>অথেন্টিকেশন, ইউজার ও সেটিংস পরিবর্তনের নির্ভরযোগ্য ইতিহাস।</p>
      </div>

      <section className="content-card">
        <div className="content-card__header">
          <TextInput
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })}
            placeholder="actor, action, entity বা note দিয়ে খুঁজুন"
          />
        </div>
        <DataTable
          items={data.items}
          empty={<EmptyState title="কোনো অডিট এন্ট্রি নেই" description="পরিবর্তন শুরু হলে এখানে দেখা যাবে।" />}
          columns={[
            {
              key: 'actor',
              header: 'অভিনেতা',
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
              header: 'বিস্তারিত',
              render: (item) => item.note ?? 'নোট নেই',
            },
            {
              key: 'time',
              header: 'সময়',
              render: (item) => toDhakaDisplay(item.createdAt),
            },
          ]}
        />
      </section>
    </div>
  )
}
