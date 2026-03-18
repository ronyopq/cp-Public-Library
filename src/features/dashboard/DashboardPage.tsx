import { useEffect, useMemo, useState } from 'react'
import { Navigate, useOutletContext, useSearchParams } from 'react-router-dom'
import type {
  AnalyticsExportResult,
  DashboardWidgetKey,
  StaffDashboardPayload,
} from '@shared/index'
import { ROLE_RANK, toBanglaCurrency, toDhakaDisplay } from '@shared/index'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AnalyticsFilterBar } from '@/components/analytics/AnalyticsFilterBar'
import { AnalyticsRankingList } from '@/components/analytics/AnalyticsRankingList'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { apiPost, apiRequest, errorMessage } from '@/lib/api'
import {
  analyticsFilterDraftFromSearchParams,
  buildAnalyticsSearchParams,
  createDefaultAnalyticsFilterDraft,
  type AnalyticsFilterDraft,
} from '@/lib/analytics'
import { useAuth } from '@/providers/useAuth'

function buildDashboardUrl(searchParams: URLSearchParams) {
  const query = searchParams.toString()
  return `/api/app/dashboard${query ? `?${query}` : ''}`
}

function buildExportPayload(draft: AnalyticsFilterDraft, format: 'csv' | 'html') {
  const payload: Record<string, string> = {
    preset: draft.preset,
    year: draft.year,
    format,
  }

  if (draft.preset === 'month') {
    payload.month = draft.month
  }

  if (draft.preset === 'custom') {
    payload.startDate = draft.startDate
    payload.endDate = draft.endDate
  }

  return payload
}

export function DashboardPage() {
  const { roleRank } = useOutletContext<{ roleRank: number }>()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [draft, setDraft] = useState<AnalyticsFilterDraft>(() =>
    analyticsFilterDraftFromSearchParams(searchParams),
  )

  useEffect(() => {
    setDraft(analyticsFilterDraftFromSearchParams(searchParams))
  }, [searchParams])

  const isStaff = roleRank >= ROLE_RANK.librarian
  const dashboardQuery = useQuery({
    queryKey: ['dashboard', searchParams.toString()],
    enabled: isStaff,
    queryFn: () => apiRequest<StaffDashboardPayload>(buildDashboardUrl(searchParams)),
  })

  const exportMutation = useMutation({
    mutationFn: (format: 'csv' | 'html') =>
      apiPost<{ export: AnalyticsExportResult }>(
        '/api/app/dashboard/export',
        buildExportPayload(analyticsFilterDraftFromSearchParams(searchParams), format),
      ),
  })

  const data = dashboardQuery.data

  const exportAllowed = data?.exportHooks.some((item) => item.allowed) ?? false

  const widgetConfig = useMemo(() => {
    if (!data) {
      return []
    }

    return data.dashboardWidgets
      .filter((widget) => widget.enabled && roleRank >= ROLE_RANK[widget.minRole])
      .sort((left, right) => left.order - right.order)
  }, [data, roleRank])

  const widgetMap: Record<DashboardWidgetKey, { label: string; value: number | string }> | null =
    data
      ? {
          titles: { label: 'মোট টাইটেল', value: data.stats.totalTitles },
          copies: { label: 'মোট কপি', value: data.stats.totalCopies },
          categories: { label: 'মোট বিভাগ', value: data.stats.totalCategories },
          authors: { label: 'মোট লেখক', value: data.stats.totalAuthors },
          publishers: { label: 'মোট প্রকাশক', value: data.stats.totalPublishers },
          languages: { label: 'মোট ভাষা', value: data.stats.totalLanguages },
          members: { label: 'সক্রিয় সদস্য', value: data.stats.activeMembers },
          issued: { label: 'ইস্যুকৃত বই', value: data.stats.issuedBooks },
          overdue: { label: 'ওভারডিউ বই', value: data.stats.overdueBooks },
          acquisitions: {
            label: 'নির্বাচিত সময়ের অধিগ্রহণ',
            value: data.stats.acquisitionsInRange,
          },
          collections: {
            label: 'নির্বাচিত সময়ের আদায়',
            value: toBanglaCurrency(data.stats.collectionsInRange),
          },
          featureFlags: {
            label: 'সক্রিয় উইজেট',
            value: widgetConfig.length,
          },
          auditFeed: {
            label: 'ফিল্টারকৃত অডিট',
            value: data.recentActivities.length,
          },
        }
      : null

  function applyFilters() {
    setSearchParams(buildAnalyticsSearchParams(draft))
  }

  function resetFilters() {
    const next = createDefaultAnalyticsFilterDraft()
    setDraft(next)
    setSearchParams(buildAnalyticsSearchParams(next))
  }

  if (!isStaff) {
    return <Navigate to="/app/account" replace />
  }

  if (dashboardQuery.isLoading) {
    return <LoadingState label="ড্যাশবোর্ড অ্যানালিটিক্স লোড হচ্ছে..." />
  }

  if (!data || !widgetMap) {
    return (
      <EmptyState
        title="ড্যাশবোর্ড পাওয়া যাচ্ছে না"
        description={errorMessage(dashboardQuery.error)}
      />
    )
  }

  return (
    <div className="page-stack">
      <div className="page-header content-card">
        <div className="analytics-header">
          <div>
            <h1>স্টাফ ড্যাশবোর্ড ও অ্যানালিটিক্স</h1>
            <p>
              সংগ্রহ, পাঠকসেবা, অধিগ্রহণ, সদস্য ও বর্তমান circulation অবস্থার aggregate
              snapshot।
            </p>
            <p className="muted">
              সময়সীমা: {data.filters.rangeLabelBn} • হালনাগাদ: {toDhakaDisplay(data.generatedAt)}
            </p>
          </div>
          {exportAllowed ? (
            <div className="page-actions">
              <Button
                type="button"
                variant="ghost"
                onClick={() => void exportMutation.mutate('csv')}
                disabled={exportMutation.isPending}
              >
                CSV এক্সপোর্ট
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void exportMutation.mutate('html')}
                disabled={exportMutation.isPending}
              >
                প্রিন্ট/HTML
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {exportMutation.isError ? (
        <div className="error-banner">{errorMessage(exportMutation.error)}</div>
      ) : null}
      {exportMutation.data?.export ? (
        <div className="warning-banner">
          রিপোর্ট প্রস্তুত হয়েছে।{' '}
          <a href={exportMutation.data.export.outputUrl} target="_blank" rel="noreferrer">
            {exportMutation.data.export.fileName}
          </a>
        </div>
      ) : null}

      <AnalyticsFilterBar
        draft={draft}
        onChange={setDraft}
        onApply={applyFilters}
        onReset={resetFilters}
        busy={dashboardQuery.isFetching || exportMutation.isPending}
      />

      <section className="stats-grid stats-grid--dashboard">
        {widgetConfig.map((widget) => (
          <article className="stat-card" key={widget.key}>
            <p className="muted">{widgetMap[widget.key]?.label ?? widget.key}</p>
            <div className="stat-card__value">{widgetMap[widget.key]?.value ?? 0}</div>
          </article>
        ))}
      </section>

      <section className="analytics-grid">
        <article className="content-card section-grid">
          <div className="content-card__header">
            <div>
              <h2>অধিগ্রহণ প্রবণতা</h2>
              <p className="muted">নির্বাচিত সময়সীমায় মাসভিত্তিক copy acquisition।</p>
            </div>
          </div>
          <AnalyticsRankingList
            items={data.charts.acquisitionsByMonth.map((item) => ({
              key: item.key,
              label: item.labelBn,
              value: item.value,
            }))}
            emptyTitle="অধিগ্রহণ ডেটা নেই"
            emptyDescription="এই সময়সীমায় acquisition record পাওয়া যায়নি।"
          />
        </article>

        <article className="content-card section-grid">
          <div className="content-card__header">
            <div>
              <h2>ঋণ কার্যক্রম</h2>
              <p className="muted">নির্বাচিত সময়সীমায় issue volume এবং বর্তমান status mix।</p>
            </div>
          </div>
          <AnalyticsRankingList
            items={data.charts.loanVolumeByMonth.map((item) => ({
              key: item.key,
              label: item.labelBn,
              value: item.value,
            }))}
            emptyTitle="ঋণ কার্যক্রম নেই"
            emptyDescription="এই সময়সীমায় কোনো issue transaction পাওয়া যায়নি।"
          />
          <AnalyticsRankingList
            items={data.charts.circulationStatus.map((item) => ({
              key: item.key,
              label: item.labelBn,
              value: item.value,
              sublabel: item.labelEn ?? null,
            }))}
            emptyTitle="Circulation status নেই"
            emptyDescription="বর্তমান loan status breakdown পাওয়া যায়নি।"
          />
        </article>
      </section>

      <section className="content-card section-grid">
        <div className="content-card__header">
          <div>
            <h2>সাম্প্রতিক সংযোজন</h2>
            <p className="muted">নির্বাচিত সময়সীমায় catalog-এ যোগ হওয়া শিরোনাম ও copy snapshot।</p>
          </div>
        </div>
        {data.recentAdditions.length === 0 ? (
          <EmptyState
            title="এই সময়সীমায় নতুন সংযোজন নেই"
            description="ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন।"
          />
        ) : (
          <div className="analytics-card-grid">
            {data.recentAdditions.map((item) => (
              <article className="shell-card" key={item.id}>
                <div className="analytics-card__header">
                  <strong>{item.title}</strong>
                  <span className="muted">{toDhakaDisplay(item.createdAt)}</span>
                </div>
                {item.authors.length > 0 ? <p className="muted">{item.authors.join(', ')}</p> : null}
                <p className="muted">
                  {item.publisherName ?? 'প্রকাশক অনির্ধারিত'} • কপি {item.copyCount} • উপলভ্য{' '}
                  {item.availableCopies}
                </p>
                {item.publicDetailPath ? (
                  <a href={item.publicDetailPath} target="_blank" rel="noreferrer">
                    পাবলিক পাতা দেখুন
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {widgetConfig.some((item) => item.key === 'auditFeed') ? (
        <section className="content-card section-grid">
          <div className="content-card__header">
            <div>
              <h2>সাম্প্রতিক অডিট কার্যক্রম</h2>
              <p className="muted">নির্বাচিত সময়সীমায় auth, settings, user এবং data mutation log।</p>
            </div>
          </div>
          {data.recentActivities.length === 0 ? (
            <EmptyState
              title="এই সময়সীমায় অডিট লগ নেই"
              description="ম্যানেজার পর্যায়ের কার্যক্রম হলে এখানে দেখা যাবে।"
            />
          ) : (
            <div className="section-grid">
              {data.recentActivities.map((entry) => (
                <article className="shell-card" key={entry.id}>
                  <strong>{entry.note ?? entry.actionKey}</strong>
                  <p className="muted">
                    {entry.actorDisplayName} • {entry.actorRoleKey ?? user?.role ?? 'system'} •{' '}
                    {toDhakaDisplay(entry.createdAt)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
