import { Link, useParams } from 'react-router-dom'
import type { PublicBookDetail } from '@shared/index'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { apiRequest, errorMessage } from '@/lib/api'

export function PublicBookPage() {
  const { recordId } = useParams<{ recordId: string }>()
  const query = useQuery({
    queryKey: ['public-book', recordId],
    enabled: Boolean(recordId),
    queryFn: () => apiRequest<PublicBookDetail>(`/api/public/catalog/${recordId}`),
  })

  if (query.isLoading) {
    return <LoadingState label="বইয়ের বিস্তারিত লোড হচ্ছে..." />
  }

  if (!query.data) {
    return (
      <EmptyState
        title="বইয়ের তথ্য পাওয়া যায়নি"
        description={errorMessage(query.error)}
      />
    )
  }

  const { book, relatedBooks } = query.data

  return (
    <div className="page-stack">
      <section className="content-card public-book-detail">
        <div className="public-book-detail__cover">
          {book.coverImageUrl || book.coverThumbnailUrl ? (
            <img src={book.coverImageUrl ?? book.coverThumbnailUrl ?? ''} alt={book.title} />
          ) : (
            <div className="public-book-card__placeholder is-large">বইয়ের কভার</div>
          )}
        </div>

        <div className="section-grid">
          <div className="page-actions">
            <Link to="/catalog" className="muted">
              ← ক্যাটালগে ফিরুন
            </Link>
            {book.categoryName ? <Badge tone="info">{book.categoryName}</Badge> : null}
            <Badge tone={book.availableCopies && book.availableCopies > 0 ? 'success' : 'warning'}>
              {book.availabilityLabelBn}
            </Badge>
          </div>

          <div>
            <h1>{book.title}</h1>
            {book.subtitle ? <p className="muted">{book.subtitle}</p> : null}
            {book.authors.length > 0 ? <p>{book.authors.join(', ')}</p> : null}
          </div>

          <div className="public-detail-grid">
            {book.publisherName ? (
              <article className="stat-card">
                <p className="muted">প্রকাশক</p>
                <strong>{book.publisherName}</strong>
              </article>
            ) : null}
            {book.publicationYear ? (
              <article className="stat-card">
                <p className="muted">প্রকাশ সাল</p>
                <strong>{book.publicationYear}</strong>
              </article>
            ) : null}
            {book.languageName ? (
              <article className="stat-card">
                <p className="muted">ভাষা</p>
                <strong>{book.languageName}</strong>
              </article>
            ) : null}
            {book.pageCount ? (
              <article className="stat-card">
                <p className="muted">পৃষ্ঠা</p>
                <strong>{book.pageCount}</strong>
              </article>
            ) : null}
            {book.totalCopies !== undefined ? (
              <article className="stat-card">
                <p className="muted">মোট কপি</p>
                <strong>{book.totalCopies}</strong>
              </article>
            ) : null}
            {book.availableCopies !== undefined ? (
              <article className="stat-card">
                <p className="muted">এখন পাওয়া যাচ্ছে</p>
                <strong>{book.availableCopies}</strong>
              </article>
            ) : null}
          </div>

          {book.summary ? (
            <article className="content-card section-grid">
              <h2>সারসংক্ষেপ</h2>
              <p>{book.summary}</p>
            </article>
          ) : null}

          {book.tags.length > 0 ? (
            <div className="duplicate-card__meta">
              {book.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="content-card section-grid">
        <div className="content-card__header">
          <div>
            <h2>সম্পর্কিত বই</h2>
            <p className="muted">একই বিভাগ বা প্রকাশকের আরও বই</p>
          </div>
        </div>

        {relatedBooks.length === 0 ? (
          <EmptyState
            title="আরও সম্পর্কিত বই নেই"
            description="পরবর্তীতে আরও পাবলিক ক্যাটালগ তথ্য যোগ হলে এখানে দেখা যাবে।"
          />
        ) : (
          <div className="public-book-grid">
            {relatedBooks.map((item) => (
              <Link key={item.id} to={item.detailPath} className="public-book-card">
                <div className="public-book-card__body">
                  <h3>{item.title}</h3>
                  {item.authors.length > 0 ? <p className="muted">{item.authors.join(', ')}</p> : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
