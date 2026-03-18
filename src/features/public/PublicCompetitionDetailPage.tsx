import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { PublicCompetitionDetail } from '@shared/index'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormField, TextAreaInput, TextInput } from '@/components/ui/FormField'
import { LoadingState } from '@/components/ui/LoadingState'
import { apiPost, apiRequest, errorMessage } from '@/lib/api'
import { useAuth } from '@/providers/useAuth'

interface CompetitionDetailPayload {
  detail: PublicCompetitionDetail
}

interface AcknowledgementPayload {
  acknowledgement: {
    acknowledgementPath: string
  }
}

export function PublicCompetitionDetailPage() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const { featureFlags, publicSettings } = useAuth()
  const [form, setForm] = useState({
    participantName: '',
    guardianName: '',
    phone: '',
    email: '',
    category: '',
    note: '',
  })

  const query = useQuery({
    queryKey: ['public-competition-detail', slug],
    enabled: Boolean(slug),
    queryFn: () => apiRequest<CompetitionDetailPayload>(`/api/public/competitions/${slug}`),
  })

  const registerMutation = useMutation({
    mutationFn: () =>
      apiPost<AcknowledgementPayload>(`/api/public/competitions/${slug}/register`, form),
    onSuccess: ({ acknowledgement }) => {
      navigate(acknowledgement.acknowledgementPath)
    },
  })

  const resultItems = useMemo(
    () => query.data?.detail.results ?? [],
    [query.data?.detail.results],
  )

  if (!featureFlags?.competitions_module_enabled) {
    return (
      <EmptyState
        title="প্রতিযোগিতা মডিউল বন্ধ আছে"
        description="এই মুহূর্তে প্রতিযোগিতার পাবলিক পাতা দেখা যাচ্ছে না।"
      />
    )
  }

  if (query.isLoading) {
    return <LoadingState label="প্রতিযোগিতার বিস্তারিত লোড হচ্ছে..." />
  }

  if (!query.data) {
    return (
      <EmptyState
        title="প্রতিযোগিতার বিস্তারিত পাওয়া যায়নি"
        description={errorMessage(query.error)}
      />
    )
  }

  const detail = query.data.detail

  return (
    <div className="page-stack">
      <section className="content-card section-grid">
        <div className="page-actions">
          <Link to="/competitions" className="muted">
            ← প্রতিযোগিতা তালিকায় ফিরুন
          </Link>
          <Badge tone={detail.registrationEnabled ? 'success' : 'warning'}>
            {detail.registrationEnabled ? 'নিবন্ধন চলছে' : 'নিবন্ধন বন্ধ'}
          </Badge>
          {detail.competition.resultsPublished ? <Badge tone="info">ফলাফল প্রকাশিত</Badge> : null}
        </div>

        <div>
          <h1>{detail.competition.titleBn}</h1>
          {detail.competition.description ? <p>{detail.competition.description}</p> : null}
        </div>

        <div className="public-detail-grid">
          {detail.competition.eventDate ? (
            <article className="stat-card">
              <p className="muted">ইভেন্টের তারিখ</p>
              <strong>{detail.competition.eventDate.slice(0, 10)}</strong>
            </article>
          ) : null}
          {detail.competition.registrationClosesAt ? (
            <article className="stat-card">
              <p className="muted">নিবন্ধন শেষ</p>
              <strong>{detail.competition.registrationClosesAt.slice(0, 10)}</strong>
            </article>
          ) : null}
          <article className="stat-card">
            <p className="muted">নিবন্ধন ফি</p>
            <strong>৳{detail.competition.registrationFeeAmount}</strong>
          </article>
        </div>
      </section>

      {detail.registrationEnabled ? (
        <section className="content-card section-grid">
          <div className="content-card__header">
            <div>
              <h2>অনলাইন নিবন্ধন</h2>
              <p className="muted">ফর্ম জমা দেওয়ার পর স্বীকৃতি পাতা ও প্রিন্টযোগ্য রসিদ পাওয়া যাবে।</p>
            </div>
          </div>

          {publicSettings?.competition.showFeeNotice && detail.competition.registrationFeeAmount > 0 ? (
            <div className="warning-banner">
              এই প্রতিযোগিতার জন্য ৳{detail.competition.registrationFeeAmount} ফি প্রযোজ্য। অনলাইন ফর্ম জমার পর
              লাইব্রেরি কর্তৃপক্ষের মাধ্যমে ফি সংগ্রহ ইন্টিগ্রেশন সম্পন্ন হবে।
            </div>
          ) : null}

          {registerMutation.isError ? (
            <div className="error-banner">{errorMessage(registerMutation.error)}</div>
          ) : null}

          <div className="form-grid form-grid--two">
            <FormField label="অংশগ্রহণকারীর নাম">
              <TextInput
                value={form.participantName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, participantName: event.target.value }))
                }
              />
            </FormField>
            <FormField label="অভিভাবকের নাম">
              <TextInput
                value={form.guardianName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, guardianName: event.target.value }))
                }
              />
            </FormField>
            <FormField label="মোবাইল নম্বর">
              <TextInput
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone: event.target.value }))
                }
              />
            </FormField>
            <FormField label="ইমেইল">
              <TextInput
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
              />
            </FormField>
            <FormField label="শ্রেণি/বিভাগ">
              <TextInput
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({ ...current, category: event.target.value }))
                }
              />
            </FormField>
          </div>

          <FormField label="অতিরিক্ত নোট">
            <TextAreaInput
              value={form.note}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            />
          </FormField>

          <div className="page-actions">
            <Button
              type="button"
              onClick={() => void registerMutation.mutate()}
              disabled={
                registerMutation.isPending ||
                form.participantName.trim().length < 2 ||
                form.phone.trim().length < 8
              }
            >
              {registerMutation.isPending ? 'জমা হচ্ছে...' : 'নিবন্ধন জমা দিন'}
            </Button>
          </div>
        </section>
      ) : null}

      {detail.resultVisibilityEnabled && resultItems.length > 0 ? (
        <section className="content-card section-grid">
          <div className="content-card__header">
            <div>
              <h2>প্রকাশিত ফলাফল</h2>
              <p className="muted">প্রকাশিত র‌্যাঙ্ক, স্কোর এবং মন্তব্য</p>
            </div>
          </div>

          <div className="lookup-list">
            {resultItems.map((result) => (
              <article key={`${result.registrationId}-${result.positionLabel}`} className="lookup-list__item">
                <strong>
                  {result.positionRank ? `${result.positionRank}. ` : ''}
                  {result.participantName ?? 'অংশগ্রহণকারী'}
                </strong>
                <span>
                  {result.positionLabel}
                  {result.score !== null && result.score !== undefined ? ` • স্কোর ${result.score}` : ''}
                  {result.categoryLabel ? ` • ${result.categoryLabel}` : ''}
                </span>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
