import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ROLE_RANK,
  memberSchema,
  type Member,
  type MemberCardPrintJobResult,
  type MemberCardTemplate,
  type MemberListingPayload,
  type MemberProfileDetail,
  toBanglaCurrency,
} from '@shared/index'
import type { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { CheckboxInput, FormField, SelectInput, TextAreaInput, TextInput } from '@/components/ui/FormField'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
import { useLocalStorageState } from '@/hooks/useLocalStorageState'
import { apiDelete, apiForm, apiPatch, apiPost, apiRequest, errorMessage } from '@/lib/api'
import { useAuth } from '@/providers/useAuth'
import { MemberProfilePanel } from './MemberProfilePanel'

type MemberFormValues = z.infer<typeof memberSchema>

interface MemberDetailPayload {
  profile: MemberProfileDetail
}

interface MemberTemplatesPayload {
  templates: MemberCardTemplate[]
}

interface MemberWritePayload {
  member: Member
}

interface MemberPhotoUploadPayload {
  key: string
  url: string
  fileName: string
  contentType: string
}

interface PrintJobPayload {
  job: MemberCardPrintJobResult
}

function StatusBadge({ status }: { status: Member['memberStatus'] }) {
  const tone =
    status === 'active' ? 'success' : status === 'expired' ? 'warning' : 'danger'
  return <Badge tone={tone}>{status}</Badge>
}

function MemberFormModal({
  open,
  mode,
  initialMember,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean
  mode: 'create' | 'edit'
  initialMember?: Member | null
  onClose: () => void
  onSubmit: (
    values: MemberFormValues,
    options: { photoFile: File | null; removePhoto: boolean },
  ) => Promise<void>
  submitting?: boolean
}) {
  const isCreate = mode === 'create'
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const previewUrl = useMemo(() => (photoFile ? URL.createObjectURL(photoFile) : null), [photoFile])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const form = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema) as any,
    defaultValues: {
      memberCode: initialMember?.memberCode ?? '',
      fullNameBn: initialMember?.fullNameBn ?? '',
      fullNameEn: initialMember?.fullNameEn ?? '',
      guardianName: initialMember?.guardianName ?? '',
      email: initialMember?.email ?? '',
      phone: initialMember?.phone ?? '',
      nationalId: initialMember?.nationalId ?? '',
      addressLine: initialMember?.addressLine ?? '',
      area: initialMember?.area ?? '',
      district: (initialMember?.district as any) ?? undefined,
      dateOfBirth: initialMember?.dateOfBirth ?? '',
      joinedAt: initialMember?.joinedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      membershipExpiresAt: initialMember?.membershipExpiresAt?.slice(0, 10) ?? '',
      memberStatus: initialMember?.memberStatus ?? 'active',
      photoKey: initialMember?.photoKey ?? '',
      notes: initialMember?.notes ?? '',
    },
  })

  useEffect(() => {
    form.reset({
      memberCode: initialMember?.memberCode ?? '',
      fullNameBn: initialMember?.fullNameBn ?? '',
      fullNameEn: initialMember?.fullNameEn ?? '',
      guardianName: initialMember?.guardianName ?? '',
      email: initialMember?.email ?? '',
      phone: initialMember?.phone ?? '',
      nationalId: initialMember?.nationalId ?? '',
      addressLine: initialMember?.addressLine ?? '',
      area: initialMember?.area ?? '',
      district: (initialMember?.district as any) ?? undefined,
      dateOfBirth: initialMember?.dateOfBirth ?? '',
      joinedAt: initialMember?.joinedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      membershipExpiresAt: initialMember?.membershipExpiresAt?.slice(0, 10) ?? '',
      memberStatus: initialMember?.memberStatus ?? 'active',
      photoKey: initialMember?.photoKey ?? '',
      notes: initialMember?.notes ?? '',
    })
  }, [form, initialMember, open])

  return (
    <Modal
      open={open}
      title={isCreate ? 'নতুন সদস্য প্রোফাইল' : 'সদস্য প্রোফাইল সম্পাদনা'}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            বাতিল
          </Button>
          <Button type="submit" form={`member-form-${mode}`} disabled={submitting}>
            {isCreate ? 'সংরক্ষণ করুন' : 'হালনাগাদ করুন'}
          </Button>
        </>
      }
    >
      <form
        id={`member-form-${mode}`}
        className="form-grid"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            await onSubmit(values, { photoFile, removePhoto })
          } catch (submitError) {
            form.setError('root', { message: errorMessage(submitError) })
          }
        })}
      >
        {form.formState.errors.root?.message ? (
          <div className="error-banner">{form.formState.errors.root.message}</div>
        ) : null}

        {isCreate ? (
          <FormField
            label="Membership ID"
            hint="খালি রাখলে সিস্টেম স্বয়ংক্রিয়ভাবে তৈরি করবে।"
            error={form.formState.errors.memberCode?.message as string | undefined}
          >
            <TextInput {...form.register('memberCode')} />
          </FormField>
        ) : (
          <div className="shell-card">
            <p className="muted">Membership ID</p>
            <strong>{initialMember?.memberCode}</strong>
          </div>
        )}

        <div className="form-grid form-grid--two">
          <FormField label="নাম (বাংলা)" error={form.formState.errors.fullNameBn?.message}>
            <TextInput {...form.register('fullNameBn')} />
          </FormField>
          <FormField label="নাম (English)" error={form.formState.errors.fullNameEn?.message}>
            <TextInput {...form.register('fullNameEn')} />
          </FormField>
        </div>

        <div className="form-grid form-grid--two">
          <FormField label="মোবাইল" error={form.formState.errors.phone?.message}>
            <TextInput {...form.register('phone')} />
          </FormField>
          <FormField label="ইমেইল" error={form.formState.errors.email?.message as string | undefined}>
            <TextInput {...form.register('email')} />
          </FormField>
        </div>

        <div className="form-grid form-grid--two">
          <FormField label="অভিভাবক / guardian">
            <TextInput {...form.register('guardianName')} />
          </FormField>
          <FormField label="জাতীয় পরিচয়পত্র">
            <TextInput {...form.register('nationalId')} />
          </FormField>
        </div>

        <FormField label="ঠিকানা" error={form.formState.errors.addressLine?.message}>
          <TextAreaInput {...form.register('addressLine')} />
        </FormField>

        <div className="form-grid form-grid--three">
          <FormField label="এলাকা">
            <TextInput {...form.register('area')} />
          </FormField>
          <FormField label="বিভাগ / জেলা">
            <SelectInput {...form.register('district')}>
              <option value="">নির্বাচন করুন</option>
              <option value="Dhaka">Dhaka</option>
              <option value="Chattogram">Chattogram</option>
              <option value="Rajshahi">Rajshahi</option>
              <option value="Khulna">Khulna</option>
              <option value="Barishal">Barishal</option>
              <option value="Sylhet">Sylhet</option>
              <option value="Rangpur">Rangpur</option>
              <option value="Mymensingh">Mymensingh</option>
            </SelectInput>
          </FormField>
          <FormField label="জন্মতারিখ">
            <TextInput type="date" {...form.register('dateOfBirth')} />
          </FormField>
        </div>

        <div className="form-grid form-grid--three">
          <FormField label="যোগদানের তারিখ">
            <TextInput type="date" {...form.register('joinedAt')} />
          </FormField>
          <FormField label="মেয়াদ উত্তীর্ণের তারিখ">
            <TextInput type="date" {...form.register('membershipExpiresAt')} />
          </FormField>
          <FormField label="স্ট্যাটাস">
            <SelectInput {...form.register('memberStatus')}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="suspended">suspended</option>
              <option value="expired">expired</option>
            </SelectInput>
          </FormField>
        </div>

        <div className="content-card section-grid">
          <div className="content-card__header">
            <div>
              <h3>সদস্যের ছবি</h3>
              <p className="muted">মোবাইল ক্যামেরা বা গ্যালারি থেকে ছবি যোগ করুন।</p>
            </div>
            {initialMember?.photoKey && !photoFile ? <Badge tone="info">বর্তমান ছবি আছে</Badge> : null}
          </div>
          <div className="asset-upload-grid">
            <label className="upload-tile">
              <span>গ্যালারি থেকে</span>
              <input type="file" accept="image/*" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} />
            </label>
            <label className="upload-tile">
              <span>ক্যামেরা দিয়ে</span>
              <input type="file" accept="image/*" capture="user" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="asset-preview">
            {previewUrl ? (
              <img src={previewUrl} alt="সদস্য ছবি" />
            ) : initialMember?.photoKey && !removePhoto ? (
              <img src={initialMember.photoKey ? `/files/${encodeURIComponent(initialMember.photoKey)}` : ''} alt={initialMember.fullNameBn} />
            ) : (
              <p className="muted">এখনও কোনো ছবি নির্বাচন করা হয়নি।</p>
            )}
          </div>
          {!isCreate && initialMember?.photoKey ? (
            <CheckboxInput
              label="বর্তমান ছবি সরান"
              checked={removePhoto}
              onChange={(event) => setRemovePhoto(event.target.checked)}
            />
          ) : null}
        </div>

        <FormField label="নোট">
          <TextAreaInput {...form.register('notes')} />
        </FormField>
      </form>
    </Modal>
  )
}

function PrintJobModal({
  open,
  templates,
  memberCount,
  job,
  loading,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean
  templates: MemberCardTemplate[]
  memberCount: number
  job: MemberCardPrintJobResult | null
  loading: boolean
  error?: string | null
  onClose: () => void
  onSubmit: (templateId: string) => Promise<void>
}) {
  const [templateId, setTemplateId] = useState('')
  const defaultTemplateId = templates.find((item) => item.isDefault)?.id ?? templates[0]?.id ?? ''
  const selectedTemplateId = templates.some((item) => item.id === templateId) ? templateId : defaultTemplateId

  return (
    <Modal
      open={open}
      title="আইডি কার্ড প্রিন্ট"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            বন্ধ করুন
          </Button>
          {!job ? (
            <Button
              type="button"
              onClick={() => void onSubmit(selectedTemplateId)}
              disabled={!selectedTemplateId || loading}
            >
              প্রিন্ট ফাইল তৈরি করুন
            </Button>
          ) : null}
        </>
      }
    >
      {job ? (
        <div className="section-grid">
          <div className="warning-banner">
            প্রিন্ট ফাইল প্রস্তুত। নতুন ট্যাবে খুলে প্রিন্ট করতে পারবেন।
          </div>
          <div className="inline-actions">
            <Button type="button" onClick={() => window.open(job.outputUrl, '_blank', 'noopener')}>
              প্রিন্ট প্রিভিউ খুলুন
            </Button>
          </div>
          <iframe className="print-preview-frame" src={job.outputUrl} title="Print preview" />
        </div>
      ) : (
        <div className="section-grid">
          {error ? <div className="error-banner">{error}</div> : null}
          {loading ? <LoadingState label="à¦ªà§à¦°à¦¿à¦¨à§à¦Ÿ à¦«à¦¾à¦‡à¦² à¦¤à§ˆà¦°à¦¿ à¦¹à¦šà§à¦›à§‡..." /> : null}
          <p className="muted">{memberCount} জন সদস্যের জন্য ID card print job তৈরি হবে।</p>
          <FormField label="প্রিন্ট টেমপ্লেট">
            <SelectInput value={selectedTemplateId} onChange={(event) => setTemplateId(event.target.value)}>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.nameBn}
                </option>
              ))}
            </SelectInput>
          </FormField>
        </div>
      )}
    </Modal>
  )
}

export function MembersPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useLocalStorageState('plms-members-filters', {
    search: '',
    status: '',
    page: 1,
    pageSize: 10,
  })
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Member | null>(null)
  const [printMemberIds, setPrintMemberIds] = useState<string[] | null>(null)
  const [printJob, setPrintJob] = useState<MemberCardPrintJobResult | null>(null)

  const selectedMemberId = searchParams.get('member')
  const canEditSensitive = Boolean(user && ROLE_RANK[user.role] >= ROLE_RANK.manager)
  const canPrint = Boolean(user?.permissions.includes('prints.manage'))

  const membersQuery = useQuery({
    queryKey: ['members', filters],
    queryFn: () =>
      apiRequest<MemberListingPayload>(
        `/api/app/members?search=${encodeURIComponent(filters.search)}&status=${encodeURIComponent(filters.status)}&page=${filters.page}&pageSize=${filters.pageSize}`,
      ),
  })

  const detailQuery = useQuery({
    queryKey: ['member-profile', selectedMemberId],
    enabled: Boolean(selectedMemberId),
    queryFn: () => apiRequest<MemberDetailPayload>(`/api/app/members/${selectedMemberId}`),
  })

  const templatesQuery = useQuery({
    queryKey: ['member-card-templates'],
    enabled: canPrint,
    queryFn: () => apiRequest<MemberTemplatesPayload>('/api/app/members/templates/cards'),
  })

  const createMutation = useMutation({
    mutationFn: (values: MemberFormValues) => apiPost<MemberWritePayload>('/api/app/members', values),
    onSuccess: async (result) => {
      setCreateOpen(false)
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('member', result.member.id)
        return next
      })
      await queryClient.invalidateQueries({ queryKey: ['members'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ memberId, values }: { memberId: string; values: MemberFormValues }) =>
      apiPatch<MemberWritePayload>(`/api/app/members/${memberId}`, values),
    onSuccess: async () => {
      setEditingMember(null)
      await queryClient.invalidateQueries({ queryKey: ['members'] })
      await queryClient.invalidateQueries({ queryKey: ['member-profile', selectedMemberId] })
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (memberId: string) => apiDelete(`/api/app/members/${memberId}`),
    onSuccess: async () => {
      setArchiveTarget(null)
      setSelectedIds([])
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('member')
        return next
      })
      await queryClient.invalidateQueries({ queryKey: ['members'] })
    },
  })

  const printMutation = useMutation({
    mutationFn: (payload: { memberIds: string[]; templateId?: string }) =>
      apiPost<PrintJobPayload>('/api/app/members/print-jobs', payload),
    onSuccess: (result) => {
      setPrintJob(result.job)
    },
  })

  async function uploadPhotoIfNeeded(photoFile: File | null) {
    if (!photoFile) {
      return null
    }

    const formData = new FormData()
    formData.set('photo', photoFile)
    const uploaded = await apiForm<MemberPhotoUploadPayload>('/api/app/members/assets/photo', formData)
    return uploaded.key
  }

  async function handleCreateOrUpdate(
    mode: 'create' | 'edit',
    values: MemberFormValues,
    options: { photoFile: File | null; removePhoto: boolean },
  ) {
    const uploadedPhotoKey = await uploadPhotoIfNeeded(options.photoFile)
    const payload: MemberFormValues = {
      ...values,
      photoKey: options.removePhoto ? '' : uploadedPhotoKey ?? values.photoKey ?? '',
    }

    if (mode === 'create') {
      await createMutation.mutateAsync(payload)
      return
    }

    if (!editingMember) {
      return
    }

    await updateMutation.mutateAsync({
      memberId: editingMember.id,
      values: payload,
    })
  }

  const items = membersQuery.data?.items ?? []
  const selectedProfile = detailQuery.data?.profile ?? null
  const defaultTemplateName =
    templatesQuery.data?.templates.find((item) => item.isDefault)?.nameBn ??
    templatesQuery.data?.templates[0]?.nameBn ??
    null
  const totalPages = Math.max(1, Math.ceil((membersQuery.data?.total ?? 0) / filters.pageSize))

  if (membersQuery.isLoading) {
    return <LoadingState label="সদস্য মডিউল লোড হচ্ছে..." />
  }

  if (membersQuery.isError) {
    return (
      <EmptyState
        title="সদস্য তথ্য লোড করা যায়নি"
        description={errorMessage(membersQuery.error)}
      />
    )
  }

  return (
    <div className="page-stack">
      <div className="page-header content-card">
        <h1>সদস্য ব্যবস্থাপনা</h1>
        <p>সদস্য প্রোফাইল, ধার ইতিহাস, জরিমানা সারসংক্ষেপ, এবং আইডি কার্ড প্রিন্ট।</p>
      </div>

      <section className="stats-grid">
        <article className="stat-card">
          <p className="muted">মোট সদস্য</p>
          <div className="stat-card__value">{membersQuery.data?.stats.totalMembers ?? 0}</div>
        </article>
        <article className="stat-card">
          <p className="muted">সক্রিয় সদস্য</p>
          <div className="stat-card__value">{membersQuery.data?.stats.activeMembers ?? 0}</div>
        </article>
        <article className="stat-card">
          <p className="muted">৩০ দিনের মধ্যে মেয়াদ শেষ</p>
          <div className="stat-card__value">{membersQuery.data?.stats.expiringSoon ?? 0}</div>
        </article>
        <article className="stat-card">
          <p className="muted">বকেয়া সদস্য</p>
          <div className="stat-card__value">{membersQuery.data?.stats.membersWithDues ?? 0}</div>
        </article>
      </section>

      <section className="content-card section-grid">
        <div className="content-card__header">
          <div className="filter-bar">
            <TextInput
              value={filters.search}
              onChange={(event) =>
                setFilters({ ...filters, search: event.target.value, page: 1 })
              }
              placeholder="নাম, মোবাইল বা membership ID দিয়ে খুঁজুন"
            />
            <SelectInput
              value={filters.status}
              onChange={(event) =>
                setFilters({ ...filters, status: event.target.value, page: 1 })
              }
            >
              <option value="">সব স্ট্যাটাস</option>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="suspended">suspended</option>
              <option value="expired">expired</option>
            </SelectInput>
          </div>

          <div className="page-actions">
            {canPrint ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSelectedIds(items.map((item) => item.id))}
                >
                  বর্তমান পৃষ্ঠা নির্বাচন
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setPrintJob(null)
                    setPrintMemberIds(selectedIds)
                  }}
                  disabled={selectedIds.length === 0}
                >
                  Bulk ID card
                </Button>
              </>
            ) : null}
            {canEditSensitive ? (
              <Button type="button" onClick={() => setCreateOpen(true)}>
                নতুন সদস্য
              </Button>
            ) : null}
          </div>
        </div>

        <DataTable
          items={items}
          empty={
            <EmptyState
              title="কোনো সদস্য পাওয়া যায়নি"
              description="সার্চ বা ফিল্টার বদলে আবার চেষ্টা করুন।"
            />
          }
          columns={[
            {
              key: 'select',
              header: 'নির্বাচন',
              render: (item) => (
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={(event) =>
                    setSelectedIds((current) =>
                      event.target.checked
                        ? [...new Set([...current, item.id])]
                        : current.filter((value) => value !== item.id),
                    )
                  }
                />
              ),
            },
            {
              key: 'identity',
              header: 'পরিচয়',
              render: (item) => (
                <button
                  className="table-link-button"
                  type="button"
                  onClick={() =>
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev)
                      next.set('member', item.id)
                      return next
                    })
                  }
                >
                  <strong>{item.fullNameBn}</strong>
                  <p className="muted">{item.memberCode}</p>
                </button>
              ),
            },
            {
              key: 'contact',
              header: 'যোগাযোগ',
              render: (item) => (
                <div>
                  <strong>{item.phone}</strong>
                  <p className="muted">{item.email || 'ইমেইল নেই'}</p>
                </div>
              ),
            },
            {
              key: 'activity',
              header: 'ধার / বকেয়া',
              render: (item) => (
                <div>
                  <strong>{item.activeLoanCount} চলমান</strong>
                  <p className="muted">বকেয়া {toBanglaCurrency(item.outstandingDue)}</p>
                </div>
              ),
            },
            {
              key: 'status',
              header: 'স্ট্যাটাস',
              render: (item) => <StatusBadge status={item.memberStatus} />,
            },
            {
              key: 'actions',
              header: 'অ্যাকশন',
              render: (item) => (
                <div className="inline-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setSearchParams((prev) => {
                        const next = new URLSearchParams(prev)
                        next.set('member', item.id)
                        return next
                      })
                    }
                  >
                    প্রোফাইল
                  </Button>
                  {canPrint ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setPrintJob(null)
                        setPrintMemberIds([item.id])
                      }}
                    >
                      ID card
                    </Button>
                  ) : null}
                  {canEditSensitive ? (
                    <Button type="button" variant="ghost" onClick={() => setEditingMember(item)}>
                      সম্পাদনা
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />

        <div className="page-actions">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setFilters({ ...filters, page: Math.max(1, filters.page - 1) })}
            disabled={filters.page === 1}
          >
            আগের পৃষ্ঠা
          </Button>
          <span className="muted">
            পৃষ্ঠা {filters.page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setFilters({ ...filters, page: Math.min(totalPages, filters.page + 1) })}
            disabled={filters.page >= totalPages}
          >
            পরের পৃষ্ঠা
          </Button>
        </div>
      </section>

      {selectedMemberId ? (
        detailQuery.isLoading ? (
          <LoadingState label="সদস্য প্রোফাইল লোড হচ্ছে..." />
        ) : detailQuery.isError || !selectedProfile ? (
          <EmptyState
            title="সদস্য প্রোফাইল পাওয়া যায়নি"
            description={errorMessage(detailQuery.error)}
          />
        ) : (
          <MemberProfilePanel
            profile={selectedProfile}
            showNotes
            cardTemplateName={defaultTemplateName}
            actions={
              <div className="page-actions">
                {canPrint ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setPrintJob(null)
                      setPrintMemberIds([selectedProfile.member.id])
                    }}
                  >
                    ID card print
                  </Button>
                ) : null}
                {canEditSensitive ? (
                  <Button type="button" variant="ghost" onClick={() => setEditingMember(selectedProfile.member)}>
                    তথ্য সম্পাদনা
                  </Button>
                ) : null}
                {canEditSensitive ? (
                  <Button type="button" variant="danger" onClick={() => setArchiveTarget(selectedProfile.member)}>
                    আর্কাইভ
                  </Button>
                ) : null}
              </div>
            }
          />
        )
      ) : (
        <EmptyState
          title="একটি সদস্য নির্বাচন করুন"
          description="তালিকা থেকে সদস্য বেছে নিলে বিস্তারিত প্রোফাইল, ইতিহাস, এবং ID card preview দেখা যাবে।"
        />
      )}

      <MemberFormModal
        key={`create-${Number(createOpen)}`}
        open={createOpen}
        mode="create"
        onClose={() => setCreateOpen(false)}
        onSubmit={(values, options) => handleCreateOrUpdate('create', values, options)}
        submitting={createMutation.isPending}
      />

      <MemberFormModal
        key={`edit-${editingMember?.id ?? 'none'}`}
        open={Boolean(editingMember)}
        mode="edit"
        initialMember={editingMember}
        onClose={() => setEditingMember(null)}
        onSubmit={(values, options) => handleCreateOrUpdate('edit', values, options)}
        submitting={updateMutation.isPending}
      />

      <PrintJobModal
        key={`print-${printMemberIds?.join('-') ?? 'none'}-${printJob?.jobId ?? 'new'}`}
        open={Boolean(printMemberIds)}
        templates={templatesQuery.data?.templates ?? []}
        memberCount={printMemberIds?.length ?? 0}
        job={printJob}
        loading={printMutation.isPending}
        error={printMutation.isError ? errorMessage(printMutation.error) : null}
        onClose={() => {
          setPrintMemberIds(null)
          setPrintJob(null)
        }}
        onSubmit={async (templateId) => {
          if (!printMemberIds) {
            return
          }

          await printMutation.mutateAsync({
            memberIds: printMemberIds,
            templateId,
          })
        }}
      />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="সদস্য আর্কাইভ করবেন?"
        description="এটি soft delete হবে। সক্রিয় ইস্যু থাকলে সিস্টেম আর্কাইভ ব্লক করবে।"
        confirmLabel="আর্কাইভ করুন"
        loading={archiveMutation.isPending}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => {
          if (!archiveTarget) {
            return
          }

          void archiveMutation.mutateAsync(archiveTarget.id)
        }}
      />
    </div>
  )
}
