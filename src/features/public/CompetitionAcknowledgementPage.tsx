import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { CompetitionRegistrationAcknowledgement } from '@shared/index'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { apiRequest, errorMessage } from '@/lib/api'

interface AcknowledgementPayload {
  acknowledgement: CompetitionRegistrationAcknowledgement
}

export function CompetitionAcknowledgementPage() {
  const { registrationId } = useParams<{ registrationId: string }>()
  const query = useQuery({
    queryKey: ['competition-acknowledgement', registrationId],
    enabled: Boolean(registrationId),
    queryFn: () =>
      apiRequest<AcknowledgementPayload>(
        `/api/public/competition-acknowledgements/${registrationId}`,
      ),
  })

  const paymentNote = useMemo(() => {
    if (!query.data?.acknowledgement.paymentRequired) {
      return 'এই নিবন্ধনের জন্য অতিরিক্ত ফি প্রযোজ্য নয়।'
    }

    return `এই নিবন্ধনের জন্য ৳${query.data.acknowledgement.feeAmount} ফি প্রযোজ্য। ফি সংগ্রহের ইন্টিগ্রেশন পয়েন্ট তৈরি আছে এবং লাইব্রেরি কর্তৃপক্ষ প্রয়োজনমতো সংগ্রহ সম্পন্ন করবে।`
  }, [query.data])

  if (query.isLoading) {
    return <LoadingState label="নিবন্ধনের স্বীকৃতি প্রস্তুত হচ্ছে..." />
  }

  if (!query.data) {
    return (
      <EmptyState
        title="স্বীকৃতি পাওয়া যায়নি"
        description={errorMessage(query.error)}
      />
    )
  }

  const acknowledgement = query.data.acknowledgement

  return (
    <div className="page-stack">
      <section className="content-card section-grid acknowledgement-card">
        <div className="page-actions">
          <Badge tone={acknowledgement.status === 'confirmed' ? 'success' : 'warning'}>
            {acknowledgement.status === 'confirmed' ? 'নিশ্চিত' : 'পেন্ডিং'}
          </Badge>
          <span className="muted">রেজিস্ট্রেশন আইডি: {acknowledgement.registrationId}</span>
        </div>

        <div>
          <p className="public-hero__eyebrow">নিবন্ধন স্বীকৃতি</p>
          <h1>{acknowledgement.competitionTitleBn}</h1>
          <p>
            {acknowledgement.participantName} এর নিবন্ধন {acknowledgement.submittedAt.slice(0, 10)} তারিখে গ্রহণ করা হয়েছে।
          </p>
        </div>

        <div className="public-detail-grid">
          <article className="stat-card">
            <p className="muted">অংশগ্রহণকারী</p>
            <strong>{acknowledgement.participantName}</strong>
          </article>
          <article className="stat-card">
            <p className="muted">মোবাইল</p>
            <strong>{acknowledgement.phone}</strong>
          </article>
          <article className="stat-card">
            <p className="muted">বিভাগ</p>
            <strong>{acknowledgement.categoryLabel ?? 'প্রযোজ্য নয়'}</strong>
          </article>
          <article className="stat-card">
            <p className="muted">ফি</p>
            <strong>৳{acknowledgement.feeAmount}</strong>
          </article>
        </div>

        <div className="warning-banner">{paymentNote}</div>

        <div className="page-actions">
          {acknowledgement.printable ? (
            <Button type="button" onClick={() => window.print()}>
              প্রিন্ট করুন
            </Button>
          ) : null}
          <Link to={`/competitions/${acknowledgement.competitionSlug}`}>
            <Button type="button" variant="ghost">
              প্রতিযোগিতার পাতায় ফিরুন
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
