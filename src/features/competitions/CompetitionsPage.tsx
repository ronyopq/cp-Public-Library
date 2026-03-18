import { useMemo, useState } from 'react'
import type {
  CompetitionAdminDashboardPayload,
  CompetitionAdminDetail,
  CompetitionAdminRecord,
  PublicSiteSettings,
} from '@shared/index'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  CheckboxInput,
  FormField,
  SelectInput,
  TextAreaInput,
  TextInput,
} from '@/components/ui/FormField'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
import { apiPatch, apiPost, apiPut, apiRequest, errorMessage } from '@/lib/api'

interface CompetitionDetailPayload {
  detail: CompetitionAdminDetail
}

const blankCompetitionForm = {
  slug: '',
  titleBn: '',
  titleEn: '',
  description: '',
  registrationFeeAmount: '0',
  registrationOpensAt: '',
  registrationClosesAt: '',
  eventDate: '',
  resultPublishedAt: '',
  status: 'draft' as CompetitionAdminRecord['status'],
  visibleToPublic: true,
}

function toDateTimeLocal(value?: string | null) {
  if (!value) {
    return ''
  }

  return value.slice(0, 16)
}

function fromDateTimeLocal(value: string) {
  return value ? new Date(value).toISOString() : ''
}

export function CompetitionsPage() {
  const queryClient = useQueryClient()
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCompetition, setEditingCompetition] = useState<CompetitionAdminRecord | null>(null)
  const [competitionForm, setCompetitionForm] = useState(blankCompetitionForm)
  const [publicSettingsDraft, setPublicSettingsDraft] = useState<PublicSiteSettings | null>(null)
  const [resultsDraft, setResultsDraft] = useState<
    | Array<{
        registrationId: string
        positionRank: string
        positionLabel: string
        score: string
        publishedNote: string
      }>
    | null
  >(null)
  const [resultsCompetitionId, setResultsCompetitionId] = useState<string>('')

  const activeCompetitionId =
    selectedCompetitionId || dashboardQuery.data?.competitions[0]?.id || ''
  const detailQuery = useQuery({
    queryKey: ['competition-detail', activeCompetitionId],
    enabled: Boolean(activeCompetitionId),
    queryFn: () =>
      apiRequest<CompetitionDetailPayload>(`/api/app/competitions/${activeCompetitionId}`),
  })

  const publicSettings = publicSettingsDraft ?? dashboardQuery.data?.publicSettings ?? null
  const selectedDetail = detailQuery.data?.detail ?? null
  const effectiveResultsDraft =
    resultsCompetitionId === activeCompetitionId && resultsDraft
      ? resultsDraft
      : (selectedDetail?.results.map((item) => ({
          registrationId: item.registrationId ?? '',
          positionRank: item.positionRank ? String(item.positionRank) : '',
          positionLabel: item.positionLabel,
          score: item.score !== null && item.score !== undefined ? String(item.score) : '',
          publishedNote: item.publishedNote ?? '',
        })) ?? [])

  const registrationOptions = useMemo(
    () =>
      selectedDetail?.registrations.map((item) => ({
        value: item.id,
        label: `${item.participantName} • ${item.phone}`,
      })) ?? [],
    [selectedDetail?.registrations],
  )

  const dashboardQuery = useQuery({
    queryKey: ['competitions-dashboard'],
    queryFn: () => apiRequest<CompetitionAdminDashboardPayload>('/api/app/competitions/dashboard'),
  })

  const competitionMutation = useMutation({
    mutationFn: () => {
      const payload = {
        slug: competitionForm.slug,
        titleBn: competitionForm.titleBn,
        titleEn: competitionForm.titleEn,
        description: competitionForm.description,
        registrationFeeAmount: Number(competitionForm.registrationFeeAmount) || 0,
        registrationOpensAt: fromDateTimeLocal(competitionForm.registrationOpensAt),
        registrationClosesAt: fromDateTimeLocal(competitionForm.registrationClosesAt),
        eventDate: fromDateTimeLocal(competitionForm.eventDate),
        resultPublishedAt: fromDateTimeLocal(competitionForm.resultPublishedAt),
        status: competitionForm.status,
        visibleToPublic: competitionForm.visibleToPublic,
      }

      if (editingCompetition) {
        return apiPatch(`/api/app/competitions/${editingCompetition.id}`, payload)
      }

      return apiPost('/api/app/competitions', payload)
    },
    onSuccess: async () => {
      setModalOpen(false)
      setEditingCompetition(null)
      setCompetitionForm(blankCompetitionForm)
      await queryClient.invalidateQueries({ queryKey: ['competitions-dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['competition-detail'] })
    },
  })

  const resultsMutation = useMutation({
    mutationFn: () =>
      apiPut(`/api/app/competitions/${activeCompetitionId}/results`, {
        results: effectiveResultsDraft
          .filter((item) => item.registrationId && item.positionLabel.trim())
          .map((item) => ({
            registrationId: item.registrationId,
            positionRank: item.positionRank ? Number(item.positionRank) : undefined,
            positionLabel: item.positionLabel,
            score: item.score ? Number(item.score) : undefined,
            publishedNote: item.publishedNote,
          })),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['competition-detail', activeCompetitionId] })
      await queryClient.invalidateQueries({ queryKey: ['competitions-dashboard'] })
    },
  })

  const publicSettingsMutation = useMutation({
    mutationFn: () => apiPut('/api/app/competitions/public-settings', publicSettings),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['competitions-dashboard'] })
    },
  })

  function openCreateModal() {
    setEditingCompetition(null)
    setCompetitionForm(blankCompetitionForm)
    setModalOpen(true)
  }

  function openEditModal(competition: CompetitionAdminRecord) {
    setEditingCompetition(competition)
    setCompetitionForm({
      slug: competition.slug,
      titleBn: competition.titleBn,
      titleEn: competition.titleEn ?? '',
      description: competition.description ?? '',
      registrationFeeAmount: String(competition.registrationFeeAmount ?? 0),
      registrationOpensAt: toDateTimeLocal(competition.registrationOpensAt),
      registrationClosesAt: toDateTimeLocal(competition.registrationClosesAt),
      eventDate: toDateTimeLocal(competition.eventDate),
      resultPublishedAt: toDateTimeLocal(competition.resultPublishedAt),
      status: competition.status,
      visibleToPublic: competition.visibleToPublic,
    })
    setModalOpen(true)
  }

  if (dashboardQuery.isLoading) {
    return <LoadingState label="প্রতিযোগিতা মডিউল লোড হচ্ছে..." />
  }

  if (!dashboardQuery.data) {
    return (
      <EmptyState
        title="প্রতিযোগিতা ড্যাশবোর্ড পাওয়া যায়নি"
        description={errorMessage(dashboardQuery.error)}
      />
    )
  }

  return (
    <div className="page-stack">
      <div className="page-header content-card">
        <h1>প্রতিযোগিতা ব্যবস্থাপনা</h1>
        <p>পাবলিক প্রতিযোগিতা, অনলাইন নিবন্ধন, ফলাফল প্রকাশ এবং দৃশ্যমানতা নিয়ন্ত্রণ এক জায়গায়।</p>
      </div>

      <section className="split-grid">
        <article className="content-card section-grid">
          <div className="content-card__header">
            <div>
              <h2>প্রতিযোগিতার তালিকা</h2>
              <p className="muted">তৈরি, সম্পাদনা, খোলা/বন্ধ এবং ফলাফল প্রকাশ করুন।</p>
            </div>
            <Button type="button" onClick={openCreateModal}>
              নতুন প্রতিযোগিতা
            </Button>
          </div>

          <DataTable
            items={dashboardQuery.data.competitions}
            empty={
              <EmptyState
                title="কোনো প্রতিযোগিতা নেই"
                description="নতুন প্রতিযোগিতা তৈরি করে পাবলিক নিবন্ধন চালু করুন।"
              />
            }
            columns={[
              {
                key: 'name',
                header: 'প্রতিযোগিতা',
                render: (item) => (
                  <button
                    type="button"
                    className="table-link-button"
                    onClick={() => {
                      setSelectedCompetitionId(item.id)
                      setResultsDraft(null)
                      setResultsCompetitionId(item.id)
                    }}
                  >
                    <strong>{item.titleBn}</strong>
                    <span className="muted">{item.slug}</span>
                  </button>
                ),
              },
              {
                key: 'status',
                header: 'স্ট্যাটাস',
                render: (item) => (
                  <Badge tone={item.status === 'published' ? 'success' : item.status === 'open' ? 'info' : 'warning'}>
                    {item.status}
                  </Badge>
                ),
              },
              {
                key: 'metrics',
                header: 'রেজিস্ট্রেশন',
                render: (item) => (
                  <div>
                    <strong>{item.registrationCount}</strong>
                    <p className="muted">ফলাফল {item.resultCount}</p>
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'অ্যাকশন',
                render: (item) => (
                  <Button type="button" variant="ghost" onClick={() => openEditModal(item)}>
                    সম্পাদনা
                  </Button>
                ),
              },
            ]}
          />
        </article>

        <article className="content-card section-grid">
          <div className="content-card__header">
            <div>
              <h2>পাবলিক দৃশ্যমানতা নিয়ন্ত্রণ</h2>
              <p className="muted">পাবলিক মেনু, ক্যাটালগের নিরাপদ ফিল্ড এবং ফলাফল দৃশ্যমানতা নিয়ন্ত্রণ করুন।</p>
            </div>
          </div>

          {publicSettings ? (
            <>
              <div className="form-grid form-grid--two">
                <CheckboxInput
                  label="ক্যাটালগ মেনু দেখান"
                  checked={publicSettings.menu.catalog}
                  onChange={(event) =>
                    setPublicSettings((current) =>
                      current
                        ? { ...current, menu: { ...current.menu, catalog: event.target.checked } }
                        : current,
                    )
                  }
                />
                <CheckboxInput
                  label="প্রতিযোগিতা মেনু দেখান"
                  checked={publicSettings.menu.competitions}
                  onChange={(event) =>
                    setPublicSettings((current) =>
                      current
                        ? {
                            ...current,
                            menu: { ...current.menu, competitions: event.target.checked },
                          }
                        : current,
                    )
                  }
                />
                <CheckboxInput
                  label="ফলাফল মেনু দেখান"
                  checked={publicSettings.menu.results}
                  onChange={(event) =>
                    setPublicSettings((current) =>
                      current
                        ? { ...current, menu: { ...current.menu, results: event.target.checked } }
                        : current,
                    )
                  }
                />
                <CheckboxInput
                  label="পাবলিক ফলাফল দৃশ্যমান"
                  checked={publicSettings.competition.resultsVisible}
                  onChange={(event) =>
                    setPublicSettings((current) =>
                      current
                        ? {
                            ...current,
                            competition: {
                              ...current.competition,
                              resultsVisible: event.target.checked,
                            },
                          }
                        : current,
                    )
                  }
                />
                <CheckboxInput
                  label="ফি নোটিশ দেখান"
                  checked={publicSettings.competition.showFeeNotice}
                  onChange={(event) =>
                    setPublicSettings((current) =>
                      current
                        ? {
                            ...current,
                            competition: {
                              ...current.competition,
                              showFeeNotice: event.target.checked,
                            },
                          }
                        : current,
                    )
                  }
                />
                <CheckboxInput
                  label="প্রিন্টযোগ্য স্বীকৃতি"
                  checked={publicSettings.competition.printableAcknowledgement}
                  onChange={(event) =>
                    setPublicSettings((current) =>
                      current
                        ? {
                            ...current,
                            competition: {
                              ...current.competition,
                              printableAcknowledgement: event.target.checked,
                            },
                          }
                        : current,
                    )
                  }
                />
              </div>

              <div className="form-grid form-grid--three">
                {Object.entries(publicSettings.catalogFields).map(([key, value]) => (
                  <CheckboxInput
                    key={key}
                    label={key}
                    checked={Boolean(value)}
                    onChange={(event) =>
                      setPublicSettings((current) =>
                        current
                          ? {
                              ...current,
                              catalogFields: {
                                ...current.catalogFields,
                                [key]: event.target.checked,
                              },
                            }
                          : current,
                      )
                    }
                  />
                ))}
              </div>

              <div className="page-actions">
                <Button
                  type="button"
                  onClick={() => void publicSettingsMutation.mutate()}
                  disabled={publicSettingsMutation.isPending}
                >
                  পাবলিক সেটিংস সংরক্ষণ
                </Button>
              </div>
            </>
          ) : null}
        </article>
      </section>

      <section className="split-grid">
        <article className="content-card section-grid">
          <div className="content-card__header">
            <div>
              <h2>নিবন্ধন তালিকা</h2>
              <p className="muted">নির্বাচিত প্রতিযোগিতার পাবলিক নিবন্ধন দেখুন।</p>
            </div>
          </div>

          {detailQuery.isLoading ? (
            <LoadingState label="নিবন্ধন তালিকা লোড হচ্ছে..." />
          ) : !selectedDetail ? (
            <EmptyState title="একটি প্রতিযোগিতা নির্বাচন করুন" description="বাম দিক থেকে একটি প্রতিযোগিতা নির্বাচন করলে নিবন্ধন তালিকা এখানে দেখা যাবে।" />
          ) : (
            <DataTable
              items={selectedDetail.registrations}
              empty={<EmptyState title="কোনো নিবন্ধন নেই" description="পাবলিক নিবন্ধন শুরু হলে অংশগ্রহণকারীরা এখানে দেখা যাবে।" />}
              columns={[
                {
                  key: 'participant',
                  header: 'অংশগ্রহণকারী',
                  render: (item) => (
                    <div>
                      <strong>{item.participantName}</strong>
                      <p className="muted">{item.phone}</p>
                    </div>
                  ),
                },
                {
                  key: 'category',
                  header: 'বিভাগ',
                  render: (item) => <span>{item.categoryLabel ?? 'প্রযোজ্য নয়'}</span>,
                },
                {
                  key: 'status',
                  header: 'স্ট্যাটাস',
                  render: (item) => (
                    <Badge tone={item.status === 'confirmed' ? 'success' : 'warning'}>
                      {item.status}
                    </Badge>
                  ),
                },
              ]}
            />
          )}
        </article>

        <article className="content-card section-grid">
          <div className="content-card__header">
            <div>
              <h2>ফলাফল এন্ট্রি ও প্রকাশ</h2>
              <p className="muted">নির্বাচিত নিবন্ধন থেকে র‌্যাঙ্ক, স্কোর এবং নোট যোগ করুন।</p>
            </div>
          </div>

          {!selectedDetail ? (
            <EmptyState title="প্রথমে একটি প্রতিযোগিতা নির্বাচন করুন" description="প্রতিযোগিতা নির্বাচনের পর ফলাফল এন্ট্রি ফর্ম সক্রিয় হবে।" />
          ) : (
            <>
              <div className="lookup-list">
                {effectiveResultsDraft.map((item, index) => (
                  <div className="lookup-list__item" key={`${item.registrationId}-${index}`}>
                    <div className="form-grid form-grid--three">
                      <FormField label="নিবন্ধন">
                        <SelectInput
                          value={item.registrationId}
                          onChange={(event) =>
                            setResultsDraft((current) =>
                              (current ?? effectiveResultsDraft).map((entry, entryIndex) =>
                                entryIndex === index
                                  ? { ...entry, registrationId: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                        >
                          <option value="">একটি নিবন্ধন বাছাই করুন</option>
                          {registrationOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </SelectInput>
                      </FormField>
                      <FormField label="র‌্যাঙ্ক">
                        <TextInput
                          type="number"
                          value={item.positionRank}
                          onChange={(event) =>
                            setResultsDraft((current) =>
                              (current ?? effectiveResultsDraft).map((entry, entryIndex) =>
                                entryIndex === index
                                  ? { ...entry, positionRank: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                        />
                      </FormField>
                      <FormField label="পদবি">
                        <TextInput
                          value={item.positionLabel}
                          onChange={(event) =>
                            setResultsDraft((current) =>
                              (current ?? effectiveResultsDraft).map((entry, entryIndex) =>
                                entryIndex === index
                                  ? { ...entry, positionLabel: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                        />
                      </FormField>
                      <FormField label="স্কোর">
                        <TextInput
                          type="number"
                          value={item.score}
                          onChange={(event) =>
                            setResultsDraft((current) =>
                              (current ?? effectiveResultsDraft).map((entry, entryIndex) =>
                                entryIndex === index
                                  ? { ...entry, score: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                        />
                      </FormField>
                      <FormField label="নোট">
                        <TextAreaInput
                          value={item.publishedNote}
                          onChange={(event) =>
                            setResultsDraft((current) =>
                              (current ?? effectiveResultsDraft).map((entry, entryIndex) =>
                                entryIndex === index
                                  ? { ...entry, publishedNote: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                        />
                      </FormField>
                    </div>
                  </div>
                ))}
              </div>

              <div className="page-actions">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setResultsCompetitionId(activeCompetitionId)
                    setResultsDraft((current) => [
                      ...(current ?? effectiveResultsDraft),
                      {
                        registrationId: '',
                        positionRank: '',
                        positionLabel: '',
                        score: '',
                        publishedNote: '',
                      },
                    ])
                  }}
                >
                  ফলাফল সারি যোগ করুন
                </Button>
                <Button
                  type="button"
                  onClick={() => void resultsMutation.mutate()}
                  disabled={resultsMutation.isPending}
                >
                  ফলাফল সংরক্ষণ
                </Button>
              </div>
            </>
          )}
        </article>
      </section>

      <Modal
        open={modalOpen}
        title={editingCompetition ? 'প্রতিযোগিতা সম্পাদনা' : 'নতুন প্রতিযোগিতা'}
        onClose={() => {
          setModalOpen(false)
          setEditingCompetition(null)
          setCompetitionForm(blankCompetitionForm)
        }}
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setModalOpen(false)
                setEditingCompetition(null)
                setCompetitionForm(blankCompetitionForm)
              }}
            >
              বাতিল
            </Button>
            <Button
              type="button"
              onClick={() => void competitionMutation.mutate()}
              disabled={competitionMutation.isPending || competitionForm.titleBn.trim().length < 2}
            >
              সংরক্ষণ
            </Button>
          </>
        }
      >
        <div className="section-grid">
          {competitionMutation.isError ? (
            <div className="error-banner">{errorMessage(competitionMutation.error)}</div>
          ) : null}

          <div className="form-grid form-grid--two">
            <FormField label="বাংলা নাম">
              <TextInput
                value={competitionForm.titleBn}
                onChange={(event) =>
                  setCompetitionForm((current) => ({ ...current, titleBn: event.target.value }))
                }
              />
            </FormField>
            <FormField label="Slug">
              <TextInput
                value={competitionForm.slug}
                onChange={(event) =>
                  setCompetitionForm((current) => ({ ...current, slug: event.target.value }))
                }
              />
            </FormField>
            <FormField label="English name">
              <TextInput
                value={competitionForm.titleEn}
                onChange={(event) =>
                  setCompetitionForm((current) => ({ ...current, titleEn: event.target.value }))
                }
              />
            </FormField>
            <FormField label="ফি">
              <TextInput
                type="number"
                value={competitionForm.registrationFeeAmount}
                onChange={(event) =>
                  setCompetitionForm((current) => ({
                    ...current,
                    registrationFeeAmount: event.target.value,
                  }))
                }
              />
            </FormField>
            <FormField label="নিবন্ধন শুরু">
              <TextInput
                type="datetime-local"
                value={competitionForm.registrationOpensAt}
                onChange={(event) =>
                  setCompetitionForm((current) => ({
                    ...current,
                    registrationOpensAt: event.target.value,
                  }))
                }
              />
            </FormField>
            <FormField label="নিবন্ধন শেষ">
              <TextInput
                type="datetime-local"
                value={competitionForm.registrationClosesAt}
                onChange={(event) =>
                  setCompetitionForm((current) => ({
                    ...current,
                    registrationClosesAt: event.target.value,
                  }))
                }
              />
            </FormField>
            <FormField label="ইভেন্ট তারিখ">
              <TextInput
                type="datetime-local"
                value={competitionForm.eventDate}
                onChange={(event) =>
                  setCompetitionForm((current) => ({ ...current, eventDate: event.target.value }))
                }
              />
            </FormField>
            <FormField label="ফলাফল প্রকাশ">
              <TextInput
                type="datetime-local"
                value={competitionForm.resultPublishedAt}
                onChange={(event) =>
                  setCompetitionForm((current) => ({
                    ...current,
                    resultPublishedAt: event.target.value,
                  }))
                }
              />
            </FormField>
            <FormField label="স্ট্যাটাস">
              <SelectInput
                value={competitionForm.status}
                onChange={(event) =>
                  setCompetitionForm((current) => ({
                    ...current,
                    status: event.target.value as CompetitionAdminRecord['status'],
                  }))
                }
              >
                <option value="draft">draft</option>
                <option value="open">open</option>
                <option value="closed">closed</option>
                <option value="published">published</option>
              </SelectInput>
            </FormField>
          </div>

          <FormField label="বিবরণ">
            <TextAreaInput
              value={competitionForm.description}
              onChange={(event) =>
                setCompetitionForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </FormField>

          <CheckboxInput
            label="পাবলিকভাবে দেখান"
            checked={competitionForm.visibleToPublic}
            onChange={(event) =>
              setCompetitionForm((current) => ({
                ...current,
                visibleToPublic: event.target.checked,
              }))
            }
          />
        </div>
      </Modal>
    </div>
  )
}
