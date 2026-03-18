import { Link } from 'react-router-dom'
import type { PublicCompetitionListItem } from '@shared/index'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { apiRequest, errorMessage } from '@/lib/api'

interface PublicCompetitionListPayload {
  items: PublicCompetitionListItem[]
}

export function PublicCompetitionResultsPage() {
  const query = useQuery({
    queryKey: ['public-competition-results'],
    queryFn: () => apiRequest<PublicCompetitionListPayload>('/api/public/competitions'),
  })

  if (query.isLoading) {
    return <LoadingState label="প্রকাশিত ফলাফল লোড হচ্ছে..." />
  }

  if (!query.data) {
    return <EmptyState title="ফলাফল পাওয়া যায়নি" description={errorMessage(query.error)} />
  }

  const publishedItems = query.data.items.filter((item) => item.resultsPublished)

  return (
    <div className="page-stack">
      <section className="public-hero">
        <div>
          <p className="public-hero__eyebrow">প্রকাশিত ফলাফল</p>
          <h1>সাম্প্রতিক প্রতিযোগিতার ফলাফল</h1>
          <p>যেসব প্রতিযোগিতার ফলাফল প্রশাসন প্রকাশ করেছে সেগুলো এখান থেকে দেখুন।</p>
        </div>
      </section>

      {publishedItems.length === 0 ? (
        <EmptyState
          title="এখনও কোনো ফলাফল প্রকাশিত হয়নি"
          description="ফলাফল প্রকাশ হলে এখানে লিংক দেখা যাবে।"
        />
      ) : (
        <div className="public-competition-grid">
          {publishedItems.map((item) => (
            <article key={item.id} className="content-card section-grid public-competition-card">
              <div>
                <h2>{item.titleBn}</h2>
                {item.description ? <p>{item.description}</p> : null}
              </div>
              <div className="public-competition-card__meta">
                {item.resultPublishedAt ? <span>প্রকাশ: {item.resultPublishedAt.slice(0, 10)}</span> : null}
                {item.eventDate ? <span>ইভেন্ট: {item.eventDate.slice(0, 10)}</span> : null}
              </div>
              <Link to={item.resultsPath}>
                <Button type="button">ফলাফল দেখুন</Button>
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
