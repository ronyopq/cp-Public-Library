import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  bookIntakeSaveSchema,
  bookIntakeSeedSchema,
  type BookIntakeDraft,
  type CatalogOptionsPayload,
  type CatalogSaveResult,
  type DuplicateCandidate,
  type IntakeAsset,
} from '@shared/index'
import type { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { CheckboxInput, FormField, SelectInput, TextAreaInput, TextInput } from '@/components/ui/FormField'
import { LoadingState } from '@/components/ui/LoadingState'
import { StringListField } from '@/components/ui/StringListField'
import { apiForm, apiPost, apiRequest, errorMessage, mediaUrl } from '@/lib/api'
import { createProcessedCoverFiles } from './cover-image'

type SeedValues = z.infer<typeof bookIntakeSeedSchema>
type SaveValues = z.infer<typeof bookIntakeSaveSchema>

interface DraftResponse {
  draft: BookIntakeDraft
  uploadedAssets: {
    metadataPage: IntakeAsset | null
  }
}

type StepKey = 'seed' | 'review' | 'success'

function StepBadge({ active, label, index }: { active: boolean; label: string; index: number }) {
  return (
    <div className={`step-chip${active ? ' is-active' : ''}`}>
      <span>{index}</span>
      <strong>{label}</strong>
    </div>
  )
}

function DuplicateCard({
  candidate,
  checked,
  onSelect,
}: {
  candidate: DuplicateCandidate
  checked: boolean
  onSelect: () => void
}) {
  return (
    <button className={`duplicate-card${checked ? ' is-selected' : ''}`} type="button" onClick={onSelect}>
      <div className="content-card__header">
        <div>
          <strong>{candidate.record.titleBn || candidate.record.titleEn}</strong>
          <p className="muted">{candidate.record.publisherName || 'প্রকাশক অজানা'}</p>
        </div>
        <Badge tone={candidate.exactIsbnMatch ? 'danger' : 'warning'}>
          {candidate.exactIsbnMatch
            ? 'ISBN মিলেছে'
            : `মিল ${Math.round(candidate.similarityScore * 100)}%`}
        </Badge>
      </div>
      <p className="muted">{candidate.reason || 'সম্ভাব্য ডুপ্লিকেট।'}</p>
      <div className="duplicate-card__meta">
        {candidate.record.authors.slice(0, 3).map((author) => (
          <span key={author}>{author}</span>
        ))}
      </div>
    </button>
  )
}

export function BookIntakePage() {
  const [step, setStep] = useState<StepKey>('seed')
  const [metadataPageFile, setMetadataPageFile] = useState<File | null>(null)
  const [rawCoverFile, setRawCoverFile] = useState<File | null>(null)
  const [coverZoom, setCoverZoom] = useState(1.12)
  const [coverOffsetX, setCoverOffsetX] = useState(0)
  const [coverOffsetY, setCoverOffsetY] = useState(0)
  const [coverAsset, setCoverAsset] = useState<IntakeAsset | null>(null)
  const [coverThumbnailAsset, setCoverThumbnailAsset] = useState<IntakeAsset | null>(null)
  const [draftState, setDraftState] = useState<DraftResponse | null>(null)
  const [saveState, setSaveState] = useState<CatalogSaveResult | null>(null)
  const [coverProcessingError, setCoverProcessingError] = useState<string | null>(null)

  const optionsQuery = useQuery({
    queryKey: ['catalog-options'],
    queryFn: () => apiRequest<CatalogOptionsPayload>('/api/app/catalog/options'),
  })

  const seedForm = useForm<SeedValues>({
    resolver: zodResolver(bookIntakeSeedSchema) as any,
    defaultValues: {
      isbn: '',
      sourceUrl: '',
      manualTitle: '',
      manualAuthor: '',
      manualPublisher: '',
      metadataPageKey: '',
      notes: '',
    },
  })

  const reviewForm = useForm<SaveValues>({
    resolver: zodResolver(bookIntakeSaveSchema) as any,
    defaultValues: {
      seed: seedForm.getValues(),
      record: {
        recordCode: '',
        isbn10: '',
        isbn13: '',
        titleBn: '',
        titleEn: '',
        subtitleBn: '',
        subtitleEn: '',
        authors: [],
        coAuthors: [],
        editors: [],
        translators: [],
        publisherId: '',
        publisherName: '',
        edition: '',
        languageCode: 'bn',
        publicationYear: undefined,
        pageCount: undefined,
        categoryId: '',
        subcategoryId: '',
        tags: [],
        summary: '',
        notes: '',
        publicVisibility: true,
        coverImageKey: '',
        coverThumbnailKey: '',
        metadataPageKey: '',
        sourceUrl: '',
        sourceNote: '',
        recordStatus: 'draft',
      },
      copies: {
        quantity: 1,
        condition: 'good',
        acquisitionType: 'purchase',
        acquisitionDate: new Date().toISOString().slice(0, 10),
        acquisitionPrice: undefined,
        acquisitionSource: '',
        invoiceReference: '',
        vendorName: '',
        locationRoom: '',
        locationRack: '',
        locationShelf: '',
        notes: '',
      },
      duplicateResolution: {
        strategy: 'create_new_record',
        existingRecordId: '',
      },
    },
  })

  const metadataPreviewUrl = useMemo(
    () => (metadataPageFile ? URL.createObjectURL(metadataPageFile) : null),
    [metadataPageFile],
  )
  const coverPreviewUrl = useMemo(
    () => (rawCoverFile ? URL.createObjectURL(rawCoverFile) : null),
    [rawCoverFile],
  )

  useEffect(() => {
    return () => {
      if (metadataPreviewUrl) {
        URL.revokeObjectURL(metadataPreviewUrl)
      }
    }
  }, [metadataPreviewUrl])

  useEffect(() => {
    return () => {
      if (coverPreviewUrl) {
        URL.revokeObjectURL(coverPreviewUrl)
      }
    }
  }, [coverPreviewUrl])

  const categoryId = useWatch({
    control: reviewForm.control,
    name: 'record.categoryId',
  })
  const subcategoryId = useWatch({
    control: reviewForm.control,
    name: 'record.subcategoryId',
  })
  const publisherId = useWatch({
    control: reviewForm.control,
    name: 'record.publisherId',
  })
  const languageCode = useWatch({
    control: reviewForm.control,
    name: 'record.languageCode',
  })
  const authors = useWatch({
    control: reviewForm.control,
    name: 'record.authors',
  })
  const coAuthors = useWatch({
    control: reviewForm.control,
    name: 'record.coAuthors',
  })
  const editors = useWatch({
    control: reviewForm.control,
    name: 'record.editors',
  })
  const translators = useWatch({
    control: reviewForm.control,
    name: 'record.translators',
  })
  const tags = useWatch({
    control: reviewForm.control,
    name: 'record.tags',
  })
  const publicVisibility = useWatch({
    control: reviewForm.control,
    name: 'record.publicVisibility',
  })
  const duplicateStrategy = useWatch({
    control: reviewForm.control,
    name: 'duplicateResolution.strategy',
  })
  const existingRecordId = useWatch({
    control: reviewForm.control,
    name: 'duplicateResolution.existingRecordId',
  })
  const coverImageKey = useWatch({
    control: reviewForm.control,
    name: 'record.coverImageKey',
  })
  const metadataPageKey = useWatch({
    control: reviewForm.control,
    name: 'record.metadataPageKey',
  })

  const subcategories = useMemo(() => {
    return (optionsQuery.data?.categories ?? []).filter((item) => item.parentId === categoryId)
  }, [categoryId, optionsQuery.data?.categories])

  const selectedDuplicate = useMemo(() => {
    return (
      draftState?.draft.duplicates.find((candidate) => candidate.record.id === existingRecordId) ??
      null
    )
  }, [draftState?.draft.duplicates, existingRecordId])

  const reviewErrors = reviewForm.formState.errors

  function resetProcessedCover() {
    setCoverAsset(null)
    setCoverThumbnailAsset(null)
    reviewForm.setValue('record.coverImageKey', '', { shouldDirty: true })
    reviewForm.setValue('record.coverThumbnailKey', '', { shouldDirty: true })
  }

  function handleMetadataPageSelect(file: File | null) {
    setMetadataPageFile(file)
    seedForm.clearErrors('isbn')
  }

  function handleCoverSelect(file: File | null) {
    setRawCoverFile(file)
    setCoverProcessingError(null)
    resetProcessedCover()
  }

  function handleDuplicateStrategyChange(
    strategy: SaveValues['duplicateResolution']['strategy'],
  ) {
    reviewForm.setValue('duplicateResolution.strategy', strategy, {
      shouldDirty: true,
      shouldValidate: true,
    })

    if (!reviewForm.getValues('duplicateResolution.existingRecordId') && draftState?.draft.duplicates[0]) {
      reviewForm.setValue(
        'duplicateResolution.existingRecordId',
        draftState.draft.duplicates[0].record.id,
        {
          shouldDirty: true,
          shouldValidate: true,
        },
      )
    }

    if (strategy === 'use_existing_record') {
      reviewForm.setValue('copies.quantity', 0, {
        shouldDirty: true,
      })
      return
    }

    const currentQuantity = Number(reviewForm.getValues('copies.quantity') ?? 0)
    if (currentQuantity < 1) {
      reviewForm.setValue('copies.quantity', 1, {
        shouldDirty: true,
      })
    }
  }

  function resetFlow() {
    setStep('seed')
    setSaveState(null)
    setDraftState(null)
    setMetadataPageFile(null)
    setRawCoverFile(null)
    setCoverProcessingError(null)
    setCoverAsset(null)
    setCoverThumbnailAsset(null)
    seedForm.reset()
    reviewForm.reset()
  }

  const draftMutation = useMutation({
    mutationFn: async () => {
      const values = seedForm.getValues()
      const formData = new FormData()
      formData.set('isbn', values.isbn ?? '')
      formData.set('sourceUrl', values.sourceUrl ?? '')
      formData.set('manualTitle', values.manualTitle ?? '')
      formData.set('manualAuthor', values.manualAuthor ?? '')
      formData.set('manualPublisher', values.manualPublisher ?? '')
      formData.set('notes', values.notes ?? '')
      if (metadataPageFile) {
        formData.set('metadataPage', metadataPageFile)
      }
      if (coverAsset?.key) {
        formData.set('coverImageKey', coverAsset.key)
      }
      if (coverThumbnailAsset?.key) {
        formData.set('coverThumbnailKey', coverThumbnailAsset.key)
      }
      return apiForm<DraftResponse>('/api/app/catalog/intake/draft', formData)
    },
    onSuccess: (result) => {
      setDraftState(result)
      const preferredDuplicate = result.draft.duplicates[0]
      reviewForm.reset({
        seed: {
          ...seedForm.getValues(),
          metadataPageKey: result.uploadedAssets.metadataPage?.key ?? '',
        },
        record: {
          recordCode: result.draft.metadata.recordCode ?? '',
          isbn10: result.draft.metadata.isbn10 ?? '',
          isbn13: result.draft.metadata.isbn13 ?? '',
          titleBn: result.draft.metadata.titleBn ?? '',
          titleEn: result.draft.metadata.titleEn ?? '',
          subtitleBn: result.draft.metadata.subtitleBn ?? '',
          subtitleEn: result.draft.metadata.subtitleEn ?? '',
          authors: result.draft.metadata.authors ?? [],
          coAuthors: result.draft.metadata.coAuthors ?? [],
          editors: result.draft.metadata.editors ?? [],
          translators: result.draft.metadata.translators ?? [],
          publisherId: result.draft.metadata.publisherId ?? '',
          publisherName: result.draft.metadata.publisherName ?? '',
          edition: result.draft.metadata.edition ?? '',
          languageCode: result.draft.metadata.languageCode ?? 'bn',
          publicationYear: result.draft.metadata.publicationYear ?? undefined,
          pageCount: result.draft.metadata.pageCount ?? undefined,
          categoryId: result.draft.metadata.categoryId ?? '',
          subcategoryId: result.draft.metadata.subcategoryId ?? '',
          tags: result.draft.metadata.tags ?? [],
          summary: result.draft.metadata.summary ?? '',
          notes: result.draft.metadata.notes ?? '',
          publicVisibility: result.draft.metadata.publicVisibility ?? true,
          coverImageKey: coverAsset?.key ?? result.draft.metadata.coverImageKey ?? '',
          coverThumbnailKey:
            coverThumbnailAsset?.key ?? result.draft.metadata.coverThumbnailKey ?? '',
          metadataPageKey:
            result.uploadedAssets.metadataPage?.key ??
            result.draft.metadata.metadataPageKey ??
            '',
          sourceUrl: result.draft.metadata.sourceUrl ?? seedForm.getValues('sourceUrl') ?? '',
          sourceNote: result.draft.metadata.sourceNote ?? '',
          recordStatus: 'draft',
        },
        copies: {
          quantity: Number(result.draft.copyDefaults?.quantity ?? 1),
          condition:
            (result.draft.copyDefaults?.condition as SaveValues['copies']['condition']) ?? 'good',
          acquisitionType:
            (result.draft.copyDefaults?.acquisitionType as SaveValues['copies']['acquisitionType']) ??
            'purchase',
          acquisitionDate:
            result.draft.copyDefaults?.acquisitionDate ??
            new Date().toISOString().slice(0, 10),
          acquisitionPrice: result.draft.copyDefaults?.acquisitionPrice ?? undefined,
          acquisitionSource: result.draft.copyDefaults?.acquisitionSource ?? '',
          invoiceReference: '',
          vendorName: result.draft.copyDefaults?.vendorName ?? '',
          locationRoom: result.draft.copyDefaults?.locationRoom ?? '',
          locationRack: result.draft.copyDefaults?.locationRack ?? '',
          locationShelf: result.draft.copyDefaults?.locationShelf ?? '',
          notes: result.draft.copyDefaults?.notes ?? '',
        },
        duplicateResolution: {
          strategy: preferredDuplicate ? preferredDuplicate.resolutionHint : 'create_new_record',
          existingRecordId: preferredDuplicate?.record.id ?? '',
        },
      })
      setStep('review')
    },
  })

  const saveMutation = useMutation({
    mutationFn: (values: SaveValues) =>
      apiPost<CatalogSaveResult>('/api/app/catalog/intake/save', values),
    onSuccess: (result) => {
      setSaveState(result)
      setStep('success')
    },
  })

  async function handleProcessCover() {
    if (!rawCoverFile) {
      setCoverProcessingError('আগে একটি কভার ইমেজ নির্বাচন করুন।')
      return
    }

    setCoverProcessingError(null)

    try {
      const processed = await createProcessedCoverFiles(rawCoverFile, {
        zoom: coverZoom,
        offsetX: coverOffsetX,
        offsetY: coverOffsetY,
      })

      const coverForm = new FormData()
      coverForm.set('kind', 'cover')
      coverForm.set('file', processed.cover)

      const thumbnailForm = new FormData()
      thumbnailForm.set('kind', 'cover_thumbnail')
      thumbnailForm.set('file', processed.thumbnail)

      const nextCoverAsset = await apiForm<IntakeAsset>('/api/app/catalog/intake/assets', coverForm)
      const nextThumbnailAsset = await apiForm<IntakeAsset>(
        '/api/app/catalog/intake/assets',
        thumbnailForm,
      )

      setCoverAsset(nextCoverAsset)
      setCoverThumbnailAsset(nextThumbnailAsset)

      reviewForm.setValue('record.coverImageKey', nextCoverAsset.key, {
        shouldDirty: true,
      })
      reviewForm.setValue('record.coverThumbnailKey', nextThumbnailAsset.key, {
        shouldDirty: true,
      })
    } catch (error) {
      setCoverProcessingError(errorMessage(error))
    }
  }

  if (optionsQuery.isLoading) {
    return <LoadingState label="ক্যাটালগ ইনটেক মডিউল লোড হচ্ছে..." />
  }

  if (optionsQuery.isError || !optionsQuery.data) {
    return (
      <EmptyState
        title="ক্যাটালগ সেটআপ লোড করা যায়নি"
        description={errorMessage(optionsQuery.error)}
      />
    )
  }

  return (
    <div className="page-stack">
      <div className="page-header content-card">
        <h1>বই ইনটেক ও ক্যাটালগিং</h1>
        <p>
          ISBN, URL, ম্যানুয়াল ইনপুট, title/copyright page image এবং cover upload
          থেকে draft তৈরি করুন, duplicate যাচাই করুন, তারপর human review শেষে save করুন।
        </p>
      </div>

      <div className="step-chip-row content-card">
        <StepBadge active={step === 'seed'} label="Seed Input" index={1} />
        <StepBadge active={step === 'review'} label="Review ও Duplicate" index={2} />
        <StepBadge active={step === 'success'} label="Save Complete" index={3} />
      </div>

      {step === 'seed' ? (
        <form
          className="page-stack"
          onSubmit={seedForm.handleSubmit(async () => {
            try {
              await draftMutation.mutateAsync()
            } catch (error) {
              seedForm.setError('root', { message: errorMessage(error) })
            }
          })}
        >
          {seedForm.formState.errors.root?.message ? (
            <div className="error-banner">{seedForm.formState.errors.root.message}</div>
          ) : null}

          <section className="split-grid">
            <div className="content-card section-grid">
              <h2>শুরুর তথ্য</h2>
              <div className="form-grid form-grid--two">
                <FormField
                  label="ISBN"
                  error={seedForm.formState.errors.isbn?.message as string | undefined}
                >
                  <TextInput placeholder="978984..." {...seedForm.register('isbn')} />
                </FormField>
                <FormField
                  label="Source / Publisher URL"
                  error={seedForm.formState.errors.sourceUrl?.message as string | undefined}
                >
                  <TextInput placeholder="https://..." {...seedForm.register('sourceUrl')} />
                </FormField>
              </div>

              <div className="form-grid form-grid--two">
                <FormField
                  label="ম্যানুয়াল শিরোনাম"
                  error={seedForm.formState.errors.manualTitle?.message as string | undefined}
                >
                  <TextInput placeholder="বইয়ের নাম" {...seedForm.register('manualTitle')} />
                </FormField>
                <FormField
                  label="ম্যানুয়াল লেখক"
                  error={seedForm.formState.errors.manualAuthor?.message as string | undefined}
                >
                  <TextInput placeholder="লেখকের নাম" {...seedForm.register('manualAuthor')} />
                </FormField>
              </div>

              <FormField
                label="ম্যানুয়াল প্রকাশক"
                error={
                  seedForm.formState.errors.manualPublisher?.message as string | undefined
                }
              >
                <TextInput
                  placeholder="প্রকাশকের নাম"
                  {...seedForm.register('manualPublisher')}
                />
              </FormField>

              <FormField label="ইনটেক নোট">
                <TextAreaInput
                  placeholder="যে সোর্স থেকে বই এসেছে বা intake operator note"
                  {...seedForm.register('notes')}
                />
              </FormField>

              <div className="warning-banner">
                অন্তত একটি seed input দিন: ISBN বা শিরোনাম বা source URL বা metadata page image।
              </div>
            </div>

            <div className="content-card section-grid">
              <h2>Metadata Page Upload</h2>
              <p className="muted">
                ISBN বা URL থেকে তথ্য অসম্পূর্ণ হলে title/copyright page image দিন।
              </p>
              <div className="asset-upload-grid">
                <label className="upload-tile">
                  <span>গ্যালারি থেকে</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleMetadataPageSelect(event.target.files?.[0] ?? null)}
                  />
                </label>
                <label className="upload-tile">
                  <span>ক্যামেরা দিয়ে</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => handleMetadataPageSelect(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              <div className="asset-preview asset-preview--tall">
                {metadataPageFile && metadataPreviewUrl ? (
                  <>
                    <p className="muted">{metadataPageFile.name}</p>
                    <img src={metadataPreviewUrl} alt="" />
                  </>
                ) : (
                  <p className="muted">এখনও কোনো metadata page নির্বাচন করা হয়নি।</p>
                )}
              </div>
            </div>
          </section>

          <section className="content-card section-grid">
            <div className="content-card__header">
              <div>
                <h2>Cover Upload ও Processing</h2>
                <p className="muted">
                  Crop, resize, optimize, compress, এবং thumbnail তৈরি করা হবে।
                </p>
              </div>
              {coverAsset ? (
                <Badge tone="success">প্রসেস সম্পন্ন</Badge>
              ) : (
                <Badge tone="warning">অপেক্ষমাণ</Badge>
              )}
            </div>

            <div className="asset-upload-grid">
              <label className="upload-tile">
                <span>গ্যালারি থেকে</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleCoverSelect(event.target.files?.[0] ?? null)}
                />
              </label>
              <label className="upload-tile">
                <span>ক্যামেরা দিয়ে</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => handleCoverSelect(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div className="cover-editor">
              <div className="cover-preview-frame">
                {coverPreviewUrl ? (
                  <img
                    src={coverPreviewUrl}
                    alt=""
                    style={{
                      transform: `translate(${coverOffsetX}px, ${coverOffsetY}px) scale(${coverZoom})`,
                    }}
                  />
                ) : (
                  <p className="muted">কভার নির্বাচন করলে এখানে preview দেখা যাবে।</p>
                )}
              </div>

              <div className="form-grid">
                <FormField label="Zoom">
                  <input
                    className="range-input"
                    type="range"
                    min="1"
                    max="2.4"
                    step="0.01"
                    value={coverZoom}
                    onChange={(event) => setCoverZoom(Number(event.target.value))}
                  />
                </FormField>
                <FormField label="Horizontal">
                  <input
                    className="range-input"
                    type="range"
                    min="-120"
                    max="120"
                    step="1"
                    value={coverOffsetX}
                    onChange={(event) => setCoverOffsetX(Number(event.target.value))}
                  />
                </FormField>
                <FormField label="Vertical">
                  <input
                    className="range-input"
                    type="range"
                    min="-120"
                    max="120"
                    step="1"
                    value={coverOffsetY}
                    onChange={(event) => setCoverOffsetY(Number(event.target.value))}
                  />
                </FormField>
                {coverProcessingError ? (
                  <div className="error-banner">{coverProcessingError}</div>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleProcessCover()}
                >
                  কভার প্রসেস ও আপলোড করুন
                </Button>
              </div>
            </div>
          </section>

          <div className="page-actions">
            <Button type="submit" disabled={draftMutation.isPending}>
              {draftMutation.isPending ? 'ড্রাফট তৈরি হচ্ছে...' : 'ড্রাফট তৈরি করুন'}
            </Button>
          </div>
        </form>
      ) : null}

      {step === 'review' && draftState ? (
        <form
          className="page-stack"
          onSubmit={reviewForm.handleSubmit(async (values) => {
            try {
              await saveMutation.mutateAsync(values)
            } catch (error) {
              reviewForm.setError('root', { message: errorMessage(error) })
            }
          })}
        >
          {reviewForm.formState.errors.root?.message ? (
            <div className="error-banner">{reviewForm.formState.errors.root.message}</div>
          ) : null}

          <section className="split-grid">
            <div className="content-card section-grid">
              <h2>Lookup Summary</h2>
              <div className="lookup-log-list">
                {draftState.draft.lookupLog.map((entry, index) => (
                  <div
                    className={`lookup-log-item status-${entry.status}`}
                    key={`${entry.source}-${index}`}
                  >
                    <Badge
                      tone={
                        entry.status === 'success'
                          ? 'success'
                          : entry.status === 'failed'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {entry.source}
                    </Badge>
                    <span>{entry.message}</span>
                  </div>
                ))}
              </div>
              {draftState.draft.warnings.length > 0 ? (
                <div className="warning-banner">
                  {draftState.draft.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              ) : null}
              <div className="intake-status-grid">
                <div className="shell-card">
                  <p className="muted">Title</p>
                  <strong>{draftState.draft.completeness.title ? 'পাওয়া গেছে' : 'অপূরণ'}</strong>
                </div>
                <div className="shell-card">
                  <p className="muted">Author</p>
                  <strong>
                    {draftState.draft.completeness.authors ? 'পাওয়া গেছে' : 'অপূরণ'}
                  </strong>
                </div>
                <div className="shell-card">
                  <p className="muted">ISBN</p>
                  <strong>{draftState.draft.completeness.isbn ? 'পাওয়া গেছে' : 'অপূরণ'}</strong>
                </div>
                <div className="shell-card">
                  <p className="muted">Cover</p>
                  <strong>{coverAsset ? 'প্রসেস করা' : 'ঐচ্ছিক'}</strong>
                </div>
              </div>
            </div>

            <div className="content-card section-grid">
              <h2>Assets</h2>
              <div className="asset-preview">
                {coverImageKey ? (
                  <img src={mediaUrl(coverImageKey) ?? ''} alt="" />
                ) : (
                  <p className="muted">কভার নেই</p>
                )}
              </div>
              <div className="asset-preview">
                {metadataPageKey ? (
                  <img src={mediaUrl(metadataPageKey) ?? ''} alt="" />
                ) : (
                  <p className="muted">Metadata page নেই</p>
                )}
              </div>
              {draftState.draft.requiresMetadataPage ? (
                <div className="warning-banner">
                  Draft এখনো অসম্পূর্ণ। চাইলে seed ধাপে ফিরে metadata page যোগ করতে পারেন।
                </div>
              ) : null}
            </div>
          </section>

          {draftState.draft.duplicates.length > 0 ? (
            <section className="content-card section-grid">
              <div className="content-card__header">
                <div>
                  <h2>সম্ভাব্য ডুপ্লিকেট</h2>
                  <p className="muted">
                    নতুন record তৈরি করবেন, নাকি existing record ব্যবহার করবেন, তা নির্বাচন
                    করুন।
                  </p>
                </div>
                <Badge tone="warning">
                  {draftState.draft.duplicates.length}টি সম্ভাব্য match
                </Badge>
              </div>

              <div className="duplicate-action-grid">
                <label className="choice-card">
                  <input
                    type="radio"
                    checked={duplicateStrategy === 'create_new_record'}
                    onChange={() => handleDuplicateStrategyChange('create_new_record')}
                  />
                  <span>নতুন bibliographic record তৈরি করুন</span>
                </label>
                <label className="choice-card">
                  <input
                    type="radio"
                    checked={duplicateStrategy === 'use_existing_record'}
                    onChange={() => handleDuplicateStrategyChange('use_existing_record')}
                  />
                  <span>existing bibliographic record ব্যবহার করুন</span>
                </label>
                <label className="choice-card">
                  <input
                    type="radio"
                    checked={duplicateStrategy === 'add_copy_to_existing_record'}
                    onChange={() => handleDuplicateStrategyChange('add_copy_to_existing_record')}
                  />
                  <span>existing record-এর অধীনে নতুন copy যোগ করুন</span>
                </label>
              </div>

              <div className="duplicate-grid">
                {draftState.draft.duplicates.map((candidate) => (
                  <DuplicateCard
                    key={candidate.record.id}
                    candidate={candidate}
                    checked={existingRecordId === candidate.record.id}
                    onSelect={() =>
                      reviewForm.setValue(
                        'duplicateResolution.existingRecordId',
                        candidate.record.id,
                        {
                          shouldDirty: true,
                          shouldValidate: true,
                        },
                      )
                    }
                  />
                ))}
              </div>

              {reviewErrors.duplicateResolution?.existingRecordId?.message ? (
                <div className="error-banner">
                  {reviewErrors.duplicateResolution.existingRecordId.message as string}
                </div>
              ) : null}

              {selectedDuplicate ? (
                <div className="shell-card">
                  <p className="muted">নির্বাচিত existing record</p>
                  <strong>
                    {selectedDuplicate.record.titleBn || selectedDuplicate.record.titleEn}
                  </strong>
                  <p className="muted">
                    {selectedDuplicate.record.authors.join(', ') || 'লেখক অজানা'}
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="content-card section-grid">
            <div className="content-card__header">
              <div>
                <h2>Bibliographic Review</h2>
                <p className="muted">
                  AI/lookup draft যাচাই করে edit করুন। save না করা পর্যন্ত কিছুই final নয়।
                </p>
              </div>
              {duplicateStrategy !== 'create_new_record' ? (
                <Badge tone="info">Existing record mode</Badge>
              ) : null}
            </div>

            <div className="form-grid form-grid--two">
              <FormField label="শিরোনাম (বাংলা)">
                <TextInput
                  disabled={duplicateStrategy !== 'create_new_record'}
                  {...reviewForm.register('record.titleBn')}
                />
              </FormField>
              <FormField label="শিরোনাম (English)">
                <TextInput
                  disabled={duplicateStrategy !== 'create_new_record'}
                  {...reviewForm.register('record.titleEn')}
                />
              </FormField>
            </div>

            <div className="form-grid form-grid--two">
              <FormField label="উপশিরোনাম (বাংলা)">
                <TextInput
                  disabled={duplicateStrategy !== 'create_new_record'}
                  {...reviewForm.register('record.subtitleBn')}
                />
              </FormField>
              <FormField label="উপশিরোনাম (English)">
                <TextInput
                  disabled={duplicateStrategy !== 'create_new_record'}
                  {...reviewForm.register('record.subtitleEn')}
                />
              </FormField>
            </div>

            <div className="form-grid form-grid--two">
              <StringListField
                label="লেখক"
                values={authors ?? []}
                placeholder="লেখকের নাম"
                onChange={(values) =>
                  reviewForm.setValue('record.authors', values, { shouldDirty: true })
                }
              />
              <StringListField
                label="সহ-লেখক"
                values={coAuthors ?? []}
                placeholder="সহ-লেখক"
                onChange={(values) =>
                  reviewForm.setValue('record.coAuthors', values, { shouldDirty: true })
                }
              />
            </div>

            <div className="form-grid form-grid--two">
              <StringListField
                label="সম্পাদক"
                values={editors ?? []}
                placeholder="সম্পাদকের নাম"
                onChange={(values) =>
                  reviewForm.setValue('record.editors', values, { shouldDirty: true })
                }
              />
              <StringListField
                label="অনুবাদক"
                values={translators ?? []}
                placeholder="অনুবাদকের নাম"
                onChange={(values) =>
                  reviewForm.setValue('record.translators', values, { shouldDirty: true })
                }
              />
            </div>

            <div className="form-grid form-grid--two">
              <FormField label="প্রকাশক (তালিকা)">
                <SelectInput
                  disabled={duplicateStrategy !== 'create_new_record'}
                  value={publisherId ?? ''}
                  onChange={(event) =>
                    reviewForm.setValue('record.publisherId', event.target.value, {
                      shouldDirty: true,
                    })
                  }
                >
                  <option value="">নির্বাচন করুন</option>
                  {optionsQuery.data.publishers.map((publisher) => (
                    <option key={publisher.id} value={publisher.id}>
                      {publisher.labelBn}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <FormField label="কাস্টম প্রকাশক">
                <TextInput
                  disabled={duplicateStrategy !== 'create_new_record'}
                  {...reviewForm.register('record.publisherName')}
                />
              </FormField>
            </div>

            <div className="form-grid form-grid--two">
              <FormField label="Edition">
                <TextInput
                  disabled={duplicateStrategy !== 'create_new_record'}
                  {...reviewForm.register('record.edition')}
                />
              </FormField>
              <FormField label="ভাষা">
                <SelectInput
                  disabled={duplicateStrategy !== 'create_new_record'}
                  value={languageCode ?? 'bn'}
                  onChange={(event) =>
                    reviewForm.setValue('record.languageCode', event.target.value, {
                      shouldDirty: true,
                    })
                  }
                >
                  {optionsQuery.data.languages.map((language) => (
                    <option
                      key={language.id}
                      value={language.code ?? 'bn'}
                    >
                      {language.labelBn}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
            </div>
            <div className="form-grid form-grid--two">
              <FormField label="ISBN-10">
                <TextInput
                  disabled={duplicateStrategy !== 'create_new_record'}
                  {...reviewForm.register('record.isbn10')}
                />
              </FormField>
              <FormField label="ISBN-13">
                <TextInput
                  disabled={duplicateStrategy !== 'create_new_record'}
                  {...reviewForm.register('record.isbn13')}
                />
              </FormField>
            </div>

            <div className="form-grid form-grid--two">
              <FormField label="Publication Year">
                <TextInput
                  type="number"
                  disabled={duplicateStrategy !== 'create_new_record'}
                  {...reviewForm.register('record.publicationYear', {
                    valueAsNumber: true,
                  })}
                />
              </FormField>
              <FormField label="পৃষ্ঠা সংখ্যা">
                <TextInput
                  type="number"
                  disabled={duplicateStrategy !== 'create_new_record'}
                  {...reviewForm.register('record.pageCount', {
                    valueAsNumber: true,
                  })}
                />
              </FormField>
            </div>

            <div className="form-grid form-grid--two">
              <FormField label="Category">
                <SelectInput
                  disabled={duplicateStrategy !== 'create_new_record'}
                  value={categoryId ?? ''}
                  onChange={(event) => {
                    reviewForm.setValue('record.categoryId', event.target.value, {
                      shouldDirty: true,
                    })
                    reviewForm.setValue('record.subcategoryId', '', {
                      shouldDirty: true,
                    })
                  }}
                >
                  <option value="">নির্বাচন করুন</option>
                  {optionsQuery.data.categories
                    .filter((item) => !item.parentId)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.labelBn}
                      </option>
                    ))}
                </SelectInput>
              </FormField>
              <FormField label="Subcategory">
                <SelectInput
                  disabled={duplicateStrategy !== 'create_new_record' || !categoryId}
                  value={subcategoryId ?? ''}
                  onChange={(event) =>
                    reviewForm.setValue('record.subcategoryId', event.target.value, {
                      shouldDirty: true,
                    })
                  }
                >
                  <option value="">নির্বাচন করুন</option>
                  {subcategories.map((subcategory) => (
                    <option key={subcategory.id} value={subcategory.id}>
                      {subcategory.labelBn}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
            </div>

            <StringListField
              label="Tags"
              values={tags ?? []}
              placeholder="tag লিখে Enter চাপুন"
              onChange={(values) =>
                reviewForm.setValue('record.tags', values, { shouldDirty: true })
              }
            />

            <FormField label="Summary">
              <TextAreaInput
                disabled={duplicateStrategy !== 'create_new_record'}
                {...reviewForm.register('record.summary')}
              />
            </FormField>
            <FormField label="Notes">
              <TextAreaInput
                disabled={duplicateStrategy !== 'create_new_record'}
                {...reviewForm.register('record.notes')}
              />
            </FormField>
            <FormField label="Source URL">
              <TextInput
                disabled={duplicateStrategy !== 'create_new_record'}
                {...reviewForm.register('record.sourceUrl')}
              />
            </FormField>
            <FormField label="Source Note">
              <TextAreaInput
                disabled={duplicateStrategy !== 'create_new_record'}
                {...reviewForm.register('record.sourceNote')}
              />
            </FormField>
            <CheckboxInput
              label="Public catalog-এ দেখানো যাবে"
              checked={publicVisibility ?? true}
              onChange={(event) =>
                reviewForm.setValue('record.publicVisibility', event.target.checked, {
                  shouldDirty: true,
                })
              }
            />
          </section>

          <section className="content-card section-grid">
            <h2>Copy / Acquisition</h2>
            <div className="form-grid form-grid--two">
              <FormField label="কপি সংখ্যা">
                <TextInput
                  type="number"
                  min="0"
                  {...reviewForm.register('copies.quantity', { valueAsNumber: true })}
                />
              </FormField>
              <FormField label="Condition">
                <SelectInput {...reviewForm.register('copies.condition')}>
                  <option value="new">new</option>
                  <option value="good">good</option>
                  <option value="worn">worn</option>
                  <option value="damaged">damaged</option>
                  <option value="repair">repair</option>
                </SelectInput>
              </FormField>
            </div>

            <div className="form-grid form-grid--two">
              <FormField label="Acquisition Type">
                <SelectInput {...reviewForm.register('copies.acquisitionType')}>
                  <option value="purchase">purchase</option>
                  <option value="gift">gift</option>
                  <option value="donation">donation</option>
                  <option value="replacement">replacement</option>
                  <option value="other">other</option>
                </SelectInput>
              </FormField>
              <FormField label="Acquisition Date">
                <TextInput type="date" {...reviewForm.register('copies.acquisitionDate')} />
              </FormField>
            </div>

            <div className="form-grid form-grid--two">
              <FormField label="মূল্য">
                <TextInput
                  type="number"
                  min="0"
                  step="0.01"
                  {...reviewForm.register('copies.acquisitionPrice', {
                    valueAsNumber: true,
                  })}
                />
              </FormField>
              <FormField label="Source / Vendor">
                <TextInput {...reviewForm.register('copies.acquisitionSource')} />
              </FormField>
            </div>

            <div className="form-grid form-grid--two">
              <FormField label="Invoice / Ref">
                <TextInput {...reviewForm.register('copies.invoiceReference')} />
              </FormField>
              <FormField label="Vendor Name">
                <TextInput {...reviewForm.register('copies.vendorName')} />
              </FormField>
            </div>

            <div className="form-grid form-grid--three">
              <FormField label="Room">
                <TextInput {...reviewForm.register('copies.locationRoom')} />
              </FormField>
              <FormField label="Rack">
                <TextInput {...reviewForm.register('copies.locationRack')} />
              </FormField>
              <FormField label="Shelf">
                <TextInput {...reviewForm.register('copies.locationShelf')} />
              </FormField>
            </div>

            <FormField label="Copy Note">
              <TextAreaInput {...reviewForm.register('copies.notes')} />
            </FormField>
          </section>

          <div className="page-actions">
            <Button type="button" variant="ghost" onClick={() => setStep('seed')}>
              Seed ধাপে ফিরে যান
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'সংরক্ষণ হচ্ছে...' : 'Review সম্পন্ন, Save করুন'}
            </Button>
          </div>
        </form>
      ) : null}

      {step === 'success' && saveState ? (
        <div className="page-stack">
          <section className="content-card section-grid">
            <Badge tone="success">সংরক্ষণ সম্পন্ন</Badge>
            <h2>
              {saveState.bibliographicRecord.titleBn || saveState.bibliographicRecord.titleEn}
            </h2>
            <p className="muted">
              Strategy: {saveState.duplicateStrategy} | নতুন কপি:{' '}
              {saveState.createdCopyIds.length}
            </p>
            <div className="intake-status-grid">
              <div className="shell-card">
                <p className="muted">Record Code</p>
                <strong>{saveState.bibliographicRecord.recordCode || 'Auto'}</strong>
              </div>
              <div className="shell-card">
                <p className="muted">Barcode</p>
                <strong>{saveState.createdBarcodeValues[0] || 'কপি তৈরি হয়নি'}</strong>
              </div>
              <div className="shell-card">
                <p className="muted">QR Links</p>
                <strong>{saveState.createdQrCodes.length}</strong>
              </div>
            </div>
            <div className="page-actions">
              <Button
                type="button"
                onClick={() => {
                  resetFlow()
                }}
              >
                আরেকটি বই যোগ করুন
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
