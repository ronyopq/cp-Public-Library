import { useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ROLE_RANK, toBanglaCurrency, toDhakaDisplay } from '@shared/index'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { apiRequest } from '@/lib/api'

interface DashboardPayload {
  stats: {
    totalTitles: number
    totalCopies: number
    activeMembers: number
    issuedCopies: number
    overdueCopies: number
    todayCollections: number
  }
  recentActivities: Array<{
    id: string
    actorDisplayName: string
    actorRoleKey: string | null
    actionKey: string
    entityType: string
    entityId: string
    note: string | null
    createdAt: string
  }>
  dashboardWidgets: Array<{
    key: string
    enabled: boolean
    order: number
    minRole: keyof typeof ROLE_RANK
  }>
}

export function DashboardPage() {
  const { roleRank } = useOutletContext<{ roleRank: number }>()
  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiRequest<DashboardPayload>('/api/app/dashboard'),
  })

  if (dashboardQuery.isLoading) {
    return <LoadingState label="ড্যাশবোর্ড লোড হচ্ছে..." />
  }

  const data = dashboardQuery.data
  if (!data) {
    return <EmptyState title="ড্যাশবোর্ড পাওয়া যায়নি" description="পরে আবার চেষ্টা করুন।" />
  }

  const widgetConfig = data.dashboardWidgets
    .filter((widget) => widget.enabled && roleRank >= ROLE_RANK[widget.minRole])
    .sort((left, right) => left.order - right.order)

  const widgetMap = {
    titles: { label: 'মোট টাইটেল', value: data.stats.totalTitles },
    copies: { label: 'মোট কপি', value: data.stats.totalCopies },
    members: { label: 'সক্রিয় সদস্য', value: data.stats.activeMembers },
    issued: { label: 'ইস্যুকৃত কপি', value: data.stats.issuedCopies },
    overdue: { label: 'ওভারডিউ', value: data.stats.overdueCopies },
    collections: { label: 'আজকের আদায়', value: toBanglaCurrency(data.stats.todayCollections) },
    featureFlags: { label: 'সক্রিয় উইজেট', value: widgetConfig.length },
    auditFeed: { label: 'সাম্প্রতিক অডিট', value: data.recentActivities.length },
  } as const

  return (
    <div className="page-stack">
      <div className="page-header content-card">
        <h1>ড্যাশবোর্ড</h1>
        <p>রোল এবং ফিচার ফ্ল্যাগ অনুযায়ী উইজেট ও প্রশাসনিক নিয়ন্ত্রণ সাজানো হয়েছে।</p>
      </div>

      <section className="stats-grid">
        {widgetConfig.map((widget) => (
          <article className="stat-card" key={widget.key}>
            <p className="muted">{widgetMap[widget.key as keyof typeof widgetMap]?.label ?? widget.key}</p>
            <div className="stat-card__value">
              {widgetMap[widget.key as keyof typeof widgetMap]?.value ?? 0}
            </div>
          </article>
        ))}
      </section>

      <section className="content-card">
        <div className="content-card__header">
          <div>
            <h2>সাম্প্রতিক কার্যক্রম</h2>
            <p className="muted">অথেন্টিকেশন, ইউজার এবং সেটিংস পরিবর্তনের অডিট ইতিহাস।</p>
          </div>
        </div>
        {data.recentActivities.length === 0 ? (
          <EmptyState title="অডিট লগ এখনো খালি" description="সমালোচনামূলক কার্যকলাপ শুরু হলে এখানে দেখা যাবে।" />
        ) : (
          <div className="section-grid">
            {data.recentActivities.map((entry) => (
              <article className="shell-card" key={entry.id}>
                <strong>{entry.note ?? entry.actionKey}</strong>
                <p className="muted">
                  {entry.actorDisplayName} • {entry.actorRoleKey ?? 'system'} • {toDhakaDisplay(entry.createdAt)}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
