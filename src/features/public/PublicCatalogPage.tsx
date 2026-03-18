import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { PublicCatalogPayload } from '@shared/index'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormField, SelectInput, TextInput } from '@/components/ui/FormField'
import { LoadingState } from '@/components/ui/LoadingState'
import { apiRequest, errorMessage } from '@/lib/api'
import { useAuth } from '@/providers/useAuth'

function buildCatalogUrl(searchParams: URLSearchParams) {
  const query = searchParams.toString()
  return `/api/public/catalog${query ? `?${query}` : ''}`
}

export function PublicCatalogPage() {
  const { featureFlags, profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const query = useQuery({
    queryKey: ['public-catalog', searchParams.toString()],
    queryFn: () => apiRequest<PublicCatalogPayload>(buildCatalogUrl(searchParams)),
  })

  const currentPage = Number(searchParams.get('page') ?? 1)
  const canGoNext =
    query.data ? query.data.page * query.data.pageSize < query.data.total : false

  const emptyDescription = useMemo(() => {
    if (query.error) {
      return errorMessage(query.error)
    }

    return 'ফিল্টার বা সার্চ পরিবর্তন করে আবার চেষ্টা করুন।'
  }, [query.error])

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    next.delete('page')
    setSearchParams(next)
  }

  function changePage(page: number) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    setSearchParams(next)
  }

  if (!featureFlags?.public_catalog_enabled) {
    return (
      <EmptyState
        title="পাবলিক ক্যাটালগ বন্ধ আছে"
        description="লাইব্রেরি প্রশাসন এই মুহূর্তে পাবলিক ক্যাটালগ দৃশ্যমান রাখেনি।"
      />
    )
  }

  if (query.isLoading) {
    return <LoadingState label="পাবলিক ক্যাটালগ লোড হচ্ছে..." />
  }

  if (!query.data) {
    return <EmptyState title="ক্যাটালগ পাওয়া যায়নি" description={emptyDescription} />
  }

  const payload = query.data

  return (
    <div className="page-stack">
      <section className="public-hero">
        <div>
          <p className="public-hero__eyebrow">অনলাইন পাবলিক ক্যাটালগ</p>
          <h1>{profile?.siteNameBn ?? 'কমিউনিটি লাইব্রেরি'} বই খুঁজুন</h1>
          <p>
            লেখক, বিভাগ, প্রকাশক, ভাষা, উপলভ্যতা এবং জনপ্রিয়তার ভিত্তিতে বই খুঁজে নিন।
          </p>
        </div>
        <div className="public-hero__stats">
          <article className="stat-card">
            <p className="muted">মোট ফলাফল</p>
            <div className="stat-card__value">{payload.total}</div>
          </article>
          <article className="stat-card">
            <p className="muted">এই পৃষ্ঠায়</p>
            <div className="stat-card__value">{payload.items.length}</div>
          </article>
        </div>
      </section>

      <section className="public-catalog-layout">
        <aside className="content-card section-grid public-filters">
          <FormField label="সার্চ">
            <TextInput
              value={searchParams.get('search') ?? ''}
              placeholder="বইয়ের নাম, লেখক বা কীওয়ার্ড"
              onChange={(event) => updateParam('search', event.target.value)}
            />
          </FormField>

          <FormField label="বিভাগ">
            <SelectInput
              value={searchParams.get('categoryId') ?? ''}
              onChange={(event) => updateParam('categoryId', event.target.value)}
            >
              <option value="">সব বিভাগ</option>
              {payload.filters.categories.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.labelBn} ({item.total})
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField label="লেখক">
            <SelectInput
              value={searchParams.get('author') ?? ''}
              onChange={(event) => updateParam('author', event.target.value)}
            >
              <option value="">সব লেখক</option>
              {payload.filters.authors.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.labelBn} ({item.total})
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField label="প্রকাশক">
            <SelectInput
              value={searchParams.get('publisherId') ?? ''}
              onChange={(event) => updateParam('publisherId', event.target.value)}
            >
              <option value="">সব প্রকাশক</option>
              {payload.filters.publishers.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.labelBn} ({item.total})
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField label="ভাষা">
            <SelectInput
              value={searchParams.get('languageCode') ?? ''}
              onChange={(event) => updateParam('languageCode', event.target.value)}
            >
              <option value="">সব ভাষা</option>
              {payload.filters.languages.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.labelBn} ({item.total})
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField label="উপলভ্যতা">
            <SelectInput
              value={searchParams.get('availability') ?? 'all'}
              onChange={(event) => updateParam('availability', event.target.value)}
            >
              <option value="all">সব</option>
              <option value="available">শুধু পাওয়া যাচ্ছে</option>
              <option value="unavailable">এখন নেই</option>
            </SelectInput>
          </FormField>

          <FormField label="সাজান">
            <SelectInput
              value={searchParams.get('sort') ?? 'newest'}
              onChange={(event) => updateParam('sort', event.target.value)}
            >
              <option value="newest">নতুন যোগ</option>
              <option value="popular">জনপ্রিয়</option>
            </SelectInput>
          </FormField>
        </aside>

        <div className="section-grid">
          {payload.items.length === 0 ? (
            <EmptyState title="কোনো বই পাওয়া যায়নি" description={emptyDescription} />
          ) : (
            <div className="public-book-grid">
              {payload.items.map((item) => (
                <Link key={item.id} to={item.detailPath} className="public-book-card">
                  <div className="public-book-card__cover">
                    {item.coverThumbnailUrl || item.coverImageUrl ? (
                      <img
                        src={item.coverThumbnailUrl ?? item.coverImageUrl ?? ''}
                        alt={item.title}
                      />
                    ) : (
                      <div className="public-book-card__placeholder">বই</div>
                    )}
                  </div>

                  <div className="public-book-card__body">
                    <div className="public-book-card__badges">
                      {item.categoryName ? <Badge tone="info">{item.categoryName}</Badge> : null}
                      {item.availableCopies !== undefined ? (
                        <Badge tone={item.availableCopies > 0 ? 'success' : 'warning'}>
                          {item.availableCopies > 0 ? 'পাওয়া যাচ্ছে' : 'ইস্যু আছে'}
                        </Badge>
                      ) : null}
                    </div>
                    <h2>{item.title}</h2>
                    {item.subtitle ? <p className="muted">{item.subtitle}</p> : null}
                    {item.authors.length > 0 ? (
                      <p className="muted">{item.authors.join(', ')}</p>
                    ) : null}
                    <div className="public-book-card__meta">
                      {item.publisherName ? <span>{item.publisherName}</span> : null}
                      {item.publicationYear ? <span>{item.publicationYear}</span> : null}
                      {item.languageName ? <span>{item.languageName}</span> : null}
                    </div>
                    {item.summary ? <p>{item.summary}</p> : null}
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="page-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => changePage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
            >
              আগের পাতা
            </Button>
            <span className="muted">পৃষ্ঠা {currentPage}</span>
            <Button
              type="button"
              variant="ghost"
              onClick={() => changePage(currentPage + 1)}
              disabled={!canGoNext}
            >
              পরের পাতা
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
