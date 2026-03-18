import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { PublicAnalyticsPayload } from '@shared/index'
import { toDhakaDisplay } from '@shared/index'
import { useQuery } from '@tanstack/react-query'
import { AnalyticsFilterBar } from '@/components/analytics/AnalyticsFilterBar'
import { AnalyticsRankingList } from '@/components/analytics/AnalyticsRankingList'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { apiRequest, errorMessage } from '@/lib/api'
import {
  analyticsFilterDraftFromSearchParams,
  buildAnalyticsSearchParams,
  createDefaultAnalyticsFilterDraft,
  type AnalyticsFilterDraft,
} from '@/lib/analytics'
import { useAuth } from '@/providers/useAuth'

function buildAnalyticsUrl(searchParams: URLSearchParams) {
  const query = searchParams.toString()
  return `/api/public/analytics${query ? `?${query}` : ''}`
}

export function PublicAnalyticsPage() {
  const { publicSettings, profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [draft, setDraft] = useState<AnalyticsFilterDraft>(() =>
    analyticsFilterDraftFromSearchParams(searchParams),
  )

  useEffect(() => {
    setDraft(analyticsFilterDraftFromSearchParams(searchParams))
  }, [searchParams])

  const query = useQuery({
    queryKey: ['public-analytics', searchParams.toString()],
    queryFn: () => apiRequest<PublicAnalyticsPayload>(buildAnalyticsUrl(searchParams)),
    enabled: publicSettings?.menu.analytics !== false,
  })

  function applyFilters() {
    setSearchParams(buildAnalyticsSearchParams(draft))
  }

  function resetFilters() {
    const next = createDefaultAnalyticsFilterDraft()
    setDraft(next)
    setSearchParams(buildAnalyticsSearchParams(next))
  }

  if (publicSettings?.menu.analytics === false) {
    return (
      <EmptyState
        title="পাবলিক অ্যানালিটিক্স এখন বন্ধ"
        description="লাইব্রেরি প্রশাসন এই aggregate analytics page আপাতত দৃশ্যমান রাখেননি।"
      />
    )
  }

  if (query.isLoading) {
    return <LoadingState label="পাবলিক অ্যানালিটিক্স লোড হচ্ছে..." />
  }

  if (!query.data) {
    return (
      <EmptyState
        title="অ্যানালিটিক্স পাওয়া যাচ্ছে না"
        description={errorMessage(query.error)}
      />
    )
  }

  const data = query.data

  return (
    <div className="page-stack">
      <section className="public-hero">
        <div>
          <p className="public-hero__eyebrow">পাঠক অ্যানালিটিক্স</p>
          <h1>{profile?.siteNameBn ?? 'কমিউনিটি লাইব্রেরি'} পাঠপ্রবণতার সারাংশ</h1>
          <p>
            শুধুই aggregate, privacy-safe ডেটা ব্যবহার করে কোন বই, লেখক, বিভাগ ও প্রকাশক বেশি
            পড়া হচ্ছে তা দেখুন।
          </p>
          <p className="muted">
            সময়সীমা: {data.filters.rangeLabelBn} • হালনাগাদ: {toDhakaDisplay(data.generatedAt)}
          </p>
        </div>

        <div className="public-hero__stats public-hero__stats--four">
          <article className="stat-card">
            <p className="muted">পাবলিক টাইটেল</p>
            <div className="stat-card__value">{data.summary.totalPublicTitles}</div>
          </article>
          <article className="stat-card">
            <p className="muted">পাবলিক কপি</p>
            <div className="stat-card__value">{data.summary.totalPublicCopies}</div>
          </article>
          <article className="stat-card">
            <p className="muted">মোট ইস্যু</p>
            <div className="stat-card__value">{data.summary.totalLoans}</div>
          </article>
          <article className="stat-card">
            <p className="muted">স্বতন্ত্র পাঠক</p>
            <div className="stat-card__value">{data.summary.distinctReaders}</div>
          </article>
        </div>
      </section>

      <AnalyticsFilterBar
        draft={draft}
        onChange={setDraft}
        onApply={applyFilters}
        onReset={resetFilters}
        busy={query.isFetching}
      />

      <section className="analytics-grid">
        <article className="content-card section-grid">
          <div className="content-card__header">
            <div>
              <h2>শীর্ষ পাঠক</h2>
              <p className="muted">ব্যক্তিগত পরিচয় গোপন রেখে aggregate ranking দেখানো হচ্ছে।</p>
            </div>
          </div>
          <AnalyticsRankingList
            items={data.topReaders.map((item) => ({
              key: String(item.rank),
              label: item.labelBn,
              value: item.totalLoans,
            }))}
            emptyTitle="যথেষ্ট anonymized data নেই"
            emptyDescription="কমপক্ষে তিনজন স্বতন্ত্র পাঠক না থাকলে top readers লুকানো থাকে।"
          />
        </article>

        <article className="content-card section-grid">
          <div className="content-card__header">
            <div>
              <h2>সবচেয়ে বেশি পড়া বই</h2>
              <p className="muted">নির্বাচিত সময়সীমায় issue count অনুযায়ী ranking।</p>
            </div>
          </div>
          <AnalyticsRankingList
            items={data.mostReadBooks.map((item) => ({
              key: item.recordId,
              label: item.title,
              value: item.totalLoans,
              sublabel: item.authors.join(', '),
              href: item.detailPath,
            }))}
            emptyTitle="এখনও ranking তৈরি হয়নি"
            emptyDescription="এই সময়সীমায় পর্যাপ্ত issue data পাওয়া যায়নি।"
          />
        </article>
      </section>

      <section className="analytics-grid">
        <article className="content-card section-grid">
          <div className="content-card__header">
            <div>
              <h2>জনপ্রিয় লেখক</h2>
              <p className="muted">Public titles-এর issue aggregation।</p>
            </div>
          </div>
          <AnalyticsRankingList
            items={data.popularAuthors.map((item) => ({
              key: item.key,
              label: item.labelBn,
              value: item.totalLoans,
            }))}
            emptyTitle="লেখক ranking নেই"
            emptyDescription="এই সময়সীমায় public loan data পাওয়া যায়নি।"
          />
        </article>

        <article className="content-card section-grid">
          <div className="content-card__header">
            <div>
              <h2>জনপ্রিয় বিভাগ</h2>
              <p className="muted">Category share chart-ready breakdown।</p>
            </div>
          </div>
          <AnalyticsRankingList
            items={data.popularCategories.map((item) => ({
              key: item.key,
              label: item.labelBn,
              value: item.totalLoans,
            }))}
            emptyTitle="বিভাগীয় breakdown নেই"
            emptyDescription="Category-level aggregation পাওয়া যায়নি।"
          />
        </article>
      </section>

      <section className="analytics-grid">
        <article className="content-card section-grid">
          <div className="content-card__header">
            <div>
              <h2>জনপ্রিয় প্রকাশক</h2>
              <p className="muted">Issue-based publisher popularity।</p>
            </div>
          </div>
          <AnalyticsRankingList
            items={data.popularPublishers.map((item) => ({
              key: item.key,
              label: item.labelBn,
              value: item.totalLoans,
            }))}
            emptyTitle="প্রকাশক ranking নেই"
            emptyDescription="এই সময়সীমায় publisher-based loan aggregate পাওয়া যায়নি।"
          />
        </article>

        <article className="content-card section-grid">
          <div className="content-card__header">
            <div>
              <h2>সময়ভিত্তিক পাঠ প্রবণতা</h2>
              <p className="muted">Month-ready public loan series।</p>
            </div>
          </div>
          <AnalyticsRankingList
            items={data.charts.loansByMonth.map((item) => ({
              key: item.key,
              label: item.labelBn,
              value: item.value,
            }))}
            emptyTitle="Time series নেই"
            emptyDescription="এই সময়সীমায় public loan volume পাওয়া যায়নি।"
          />
          <AnalyticsRankingList
            items={data.charts.categoryShare.map((item) => ({
              key: item.key,
              label: item.labelBn,
              value: item.value,
            }))}
            emptyTitle="Category share নেই"
            emptyDescription="Public category mix chart তৈরি করা যায়নি।"
          />
        </article>
      </section>
    </div>
  )
}
