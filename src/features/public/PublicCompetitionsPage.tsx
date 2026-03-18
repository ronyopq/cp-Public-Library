import { Link } from 'react-router-dom'
import type { PublicCompetitionListItem } from '@shared/index'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { apiRequest, errorMessage } from '@/lib/api'
import { useAuth } from '@/providers/useAuth'

interface PublicCompetitionListPayload {
  items: PublicCompetitionListItem[]
}

export function PublicCompetitionsPage() {
  const { featureFlags } = useAuth()
  const query = useQuery({
    queryKey: ['public-competitions'],
    queryFn: () => apiRequest<PublicCompetitionListPayload>('/api/public/competitions'),
  })

  if (!featureFlags?.competitions_module_enabled) {
    return (
      <EmptyState
        title="প্রতিযোগিতা মডিউল বন্ধ আছে"
        description="লাইব্রেরি প্রশাসন এই মুহূর্তে পাবলিক প্রতিযোগিতা সেবা বন্ধ রেখেছে।"
      />
    )
  }

  if (query.isLoading) {
    return <LoadingState label="পাবলিক প্রতিযোগিতার তালিকা লোড হচ্ছে..." />
  }

  if (!query.data) {
    return <EmptyState title="প্রতিযোগিতা পাওয়া যায়নি" description={errorMessage(query.error)} />
  }

  return (
    <div className="page-stack">
      <section className="public-hero">
        <div>
          <p className="public-hero__eyebrow">পাবলিক প্রতিযোগিতা</p>
          <h1>চলমান ও প্রকাশিত প্রতিযোগিতা</h1>
          <p>নিবন্ধন, ইভেন্টের তারিখ, ফি তথ্য এবং ফলাফল এক জায়গায় দেখুন।</p>
        </div>
      </section>

      {query.data.items.length === 0 ? (
        <EmptyState
          title="কোনো পাবলিক প্রতিযোগিতা নেই"
          description="নতুন প্রতিযোগিতা প্রকাশ হলে এখানে দেখা যাবে।"
        />
      ) : (
        <div className="public-competition-grid">
          {query.data.items.map((item) => (
            <article key={item.id} className="content-card section-grid public-competition-card">
              <div className="page-actions">
                <Badge tone={item.registrationOpen ? 'success' : 'warning'}>
                  {item.registrationOpen ? 'নিবন্ধন চলছে' : 'নিবন্ধন বন্ধ'}
                </Badge>
                {item.resultsPublished ? <Badge tone="info">ফলাফল প্রকাশিত</Badge> : null}
              </div>

              <div>
                <h2>{item.titleBn}</h2>
                {item.description ? <p>{item.description}</p> : null}
              </div>

              <div className="public-competition-card__meta">
                {item.eventDate ? <span>ইভেন্ট: {item.eventDate.slice(0, 10)}</span> : null}
                {item.registrationClosesAt ? (
                  <span>নিবন্ধন শেষ: {item.registrationClosesAt.slice(0, 10)}</span>
                ) : null}
                <span>ফি: ৳{item.registrationFeeAmount}</span>
              </div>

              <div className="page-actions">
                <Link to={item.detailPath}>
                  <Button type="button">বিস্তারিত</Button>
                </Link>
                {item.resultsPublished ? (
                  <Link to={item.resultsPath}>
                    <Button type="button" variant="ghost">
                      ফলাফল
                    </Button>
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
