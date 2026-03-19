import { useDeferredValue, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ROLE_RANK,
  toBanglaCurrency,
  toDhakaDisplay,
  type AccountingDashboardPayload,
  type AccountingExportResult,
  type AccountingMemberLedgerPayload,
  type AccountingPaymentRecord,
  type AccountingReceiptDetail,
  type AccountingReportPayload,
  type DueMonthOption,
  type FeeTypeDefinition,
  type LookupOption,
} from '@shared/index'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
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
import { useLocalStorageState } from '@/hooks/useLocalStorageState'
import { apiDelete, apiPatch, apiPost, apiRequest, errorMessage } from '@/lib/api'
import { useAuth } from '@/providers/useAuth'
import { ArchivedFeeTypesPanel } from './ArchivedFeeTypesPanel'

interface LookupPayload {
  items: LookupOption[]
}

interface LedgerPayload {
  ledger: AccountingMemberLedgerPayload
}

interface FeeTypeMutationPayload {
  feeType: FeeTypeDefinition
}

interface ReceiptMutationPayload {
  receipt: AccountingReceiptDetail
}

interface ReportPayload {
  report: AccountingReportPayload
}

interface ExportPayload {
  export?: AccountingExportResult
  preview?: AccountingExportResult
}

function todayToken() {
  return new Date().toISOString().slice(0, 10)
}

function firstDayOfMonthToken() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function PaymentStatusBadge({ payment }: { payment: AccountingPaymentRecord }) {
  if (payment.isVoided) {
    return <Badge tone="danger">বাতিল</Badge>
  }
  return (
    <Badge tone={payment.status === 'completed' ? 'success' : 'warning'}>
      {payment.status}
    </Badge>
  )
}

function FeeTypeFormModal({
  open,
  initialValue,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean
  initialValue: FeeTypeDefinition | null
  onClose: () => void
  onSubmit: (payload: {
    feeCode: string
    nameBn: string
    nameEn: string
    descriptionBn: string
    descriptionEn: string
    collectionMode: FeeTypeDefinition['collectionMode']
    defaultAmount: number
    allowCustomAmount: boolean
    allowMultiMonth: boolean
    incomeAccountId: string
    active: boolean
    sortOrder: number
  }) => Promise<void>
  loading: boolean
}) {
  const initialForm = {
    feeCode: initialValue?.feeCode ?? '',
    nameBn: initialValue?.nameBn ?? '',
    nameEn: initialValue?.nameEn ?? '',
    descriptionBn: initialValue?.descriptionBn ?? '',
    descriptionEn: initialValue?.descriptionEn ?? '',
    collectionMode: initialValue?.collectionMode ?? ('one_time' as FeeTypeDefinition['collectionMode']),
    defaultAmount: String(initialValue?.defaultAmount ?? 0),
    allowCustomAmount: initialValue?.allowCustomAmount ?? true,
    allowMultiMonth: initialValue?.allowMultiMonth ?? false,
    incomeAccountId: initialValue?.incomeAccountId ?? '',
    active: initialValue?.active ?? true,
    sortOrder: String(initialValue?.sortOrder ?? 50),
  }
  const [form, setForm] = useState({
    ...initialForm,
  })
  const [formError, setFormError] = useState<string | null>(null)

  return (
    <Modal
      open={open}
      title={initialValue ? 'ফি টাইপ সম্পাদনা' : 'নতুন ফি টাইপ'}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            বাতিল
          </Button>
          <Button
            type="button"
            onClick={() =>
              void onSubmit({
                feeCode: form.feeCode,
                nameBn: form.nameBn,
                nameEn: form.nameEn,
                descriptionBn: form.descriptionBn,
                descriptionEn: form.descriptionEn,
                collectionMode: form.collectionMode,
                defaultAmount: Number(form.defaultAmount) || 0,
                allowCustomAmount: form.allowCustomAmount,
                allowMultiMonth: form.allowMultiMonth,
                incomeAccountId: form.incomeAccountId,
                active: form.active,
                sortOrder: Number(form.sortOrder) || 50,
              }).catch((submitError) => setFormError(errorMessage(submitError)))
            }
            disabled={loading}
          >
            {initialValue ? 'আপডেট করুন' : 'তৈরি করুন'}
          </Button>
        </>
      }
    >
      <div className="section-grid">
        {formError ? <div className="error-banner">{formError}</div> : null}
        <div className="form-grid form-grid--two">
          <FormField label="কোড">
            <TextInput
              value={form.feeCode}
              onChange={(event) =>
                setForm((current) => ({ ...current, feeCode: event.target.value }))
              }
            />
          </FormField>
          <FormField label="বাংলা নাম">
            <TextInput
              value={form.nameBn}
              onChange={(event) =>
                setForm((current) => ({ ...current, nameBn: event.target.value }))
              }
            />
          </FormField>
          <FormField label="ইংরেজি নাম">
            <TextInput
              value={form.nameEn}
              onChange={(event) =>
                setForm((current) => ({ ...current, nameEn: event.target.value }))
              }
            />
          </FormField>
          <FormField label="সংগ্রহ মোড">
            <SelectInput
              value={form.collectionMode}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  collectionMode: event.target.value as FeeTypeDefinition['collectionMode'],
                }))
              }
            >
              <option value="one_time">এককালীন</option>
              <option value="monthly">মাসিক</option>
            </SelectInput>
          </FormField>
          <FormField label="ডিফল্ট পরিমাণ">
            <TextInput
              type="number"
              value={form.defaultAmount}
              onChange={(event) =>
                setForm((current) => ({ ...current, defaultAmount: event.target.value }))
              }
            />
          </FormField>
          <FormField label="ইনকাম অ্যাকাউন্ট আইডি">
            <TextInput
              value={form.incomeAccountId}
              onChange={(event) =>
                setForm((current) => ({ ...current, incomeAccountId: event.target.value }))
              }
              placeholder="acct_membership_income"
            />
          </FormField>
          <FormField label="সাজানোর ক্রম">
            <TextInput
              type="number"
              value={form.sortOrder}
              onChange={(event) =>
                setForm((current) => ({ ...current, sortOrder: event.target.value }))
              }
            />
          </FormField>
        </div>
        <FormField label="বাংলা বিবরণ">
          <TextAreaInput
            value={form.descriptionBn}
            onChange={(event) =>
              setForm((current) => ({ ...current, descriptionBn: event.target.value }))
            }
          />
        </FormField>
        <FormField label="ইংরেজি বিবরণ">
          <TextAreaInput
            value={form.descriptionEn}
            onChange={(event) =>
              setForm((current) => ({ ...current, descriptionEn: event.target.value }))
            }
          />
        </FormField>
        <div className="form-grid form-grid--two">
          <CheckboxInput
            label="কাস্টম পরিমাণ অনুমোদন"
            checked={form.allowCustomAmount}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                allowCustomAmount: event.target.checked,
              }))
            }
          />
          <CheckboxInput
            label="একাধিক মাস একসাথে"
            checked={form.allowMultiMonth}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                allowMultiMonth: event.target.checked,
              }))
            }
          />
          <CheckboxInput
            label="সক্রিয়"
            checked={form.active}
            onChange={(event) =>
              setForm((current) => ({ ...current, active: event.target.checked }))
            }
          />
        </div>
      </div>
    </Modal>
  )
}

export function AccountsPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const roleRank = user ? ROLE_RANK[user.role] : 0
  const canManageCollections = user?.permissions.includes('accounts.manage') ?? false
  const canManageReports = user?.permissions.includes('reports.view') ?? false
  const canManageFeeTypes = roleRank >= ROLE_RANK.admin
  const canVoidPayments = roleRank >= ROLE_RANK.manager

  const [memberSearch, setMemberSearch] = useState('')
  const [selectedMember, setSelectedMember] = useState<LookupOption | null>(null)
  const [selectedFeeTypeId, setSelectedFeeTypeId] = useState('')
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [amount, setAmount] = useState('0')
  const [paymentMethodCode, setPaymentMethodCode] = useState('cash')
  const [referenceNo, setReferenceNo] = useState('')
  const [note, setNote] = useState('')
  const [feeTypeModalOpen, setFeeTypeModalOpen] = useState(false)
  const [editingFeeType, setEditingFeeType] = useState<FeeTypeDefinition | null>(null)
  const [feeTypeToDelete, setFeeTypeToDelete] = useState<FeeTypeDefinition | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [voidTarget, setVoidTarget] = useState<AccountingPaymentRecord | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [reportFilters, setReportFilters] = useLocalStorageState(
    'plms-accounts-report-filters',
    {
      preset: 'monthly',
      startDate: firstDayOfMonthToken(),
      endDate: todayToken(),
      feeTypeId: '',
      paymentMethodCode: '',
      memberId: '',
    },
  )

  const deferredMemberSearch = useDeferredValue(memberSearch)

  const dashboardQuery = useQuery({
    queryKey: ['accounts-dashboard'],
    queryFn: () => apiRequest<AccountingDashboardPayload>('/api/app/accounts/dashboard'),
  })

  const memberLookupQuery = useQuery({
    queryKey: ['accounts-member-search', deferredMemberSearch],
    enabled: deferredMemberSearch.trim().length >= 2,
    queryFn: () =>
      apiRequest<LookupPayload>(
        `/api/app/accounts/members/search?query=${encodeURIComponent(deferredMemberSearch)}`,
      ),
  })

  const memberLedgerQuery = useQuery({
    queryKey: ['accounts-member-ledger', selectedMember?.id],
    enabled: Boolean(selectedMember?.id),
    queryFn: () =>
      apiRequest<LedgerPayload>(`/api/app/accounts/members/${selectedMember?.id}/ledger`),
  })

  const reportQuery = useQuery({
    queryKey: ['accounts-report', reportFilters],
    enabled: canManageReports,
    queryFn: () =>
      apiRequest<ReportPayload>(
        `/api/app/accounts/reports?preset=${encodeURIComponent(reportFilters.preset)}&startDate=${encodeURIComponent(reportFilters.startDate)}&endDate=${encodeURIComponent(reportFilters.endDate)}&feeTypeId=${encodeURIComponent(reportFilters.feeTypeId)}&paymentMethodCode=${encodeURIComponent(reportFilters.paymentMethodCode)}&memberId=${encodeURIComponent(reportFilters.memberId)}`,
      ),
  })

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['accounts-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['accounts-member-ledger'] }),
      queryClient.invalidateQueries({ queryKey: ['accounts-report'] }),
    ])
  }

  const collectMutation = useMutation({
    mutationFn: () =>
      apiPost('/api/app/accounts/collect', {
        memberId: selectedMember?.id ?? '',
        feeTypeId: resolvedFeeTypeId,
        months: effectiveSelectedMonths,
        amount: Number(effectiveAmount) || 0,
        paymentMethodCode: effectivePaymentMethodCode,
        referenceNo,
        note,
      }),
    onSuccess: async (payload: any) => {
      setReferenceNo('')
      setNote('')
      await refreshAll()
      if (payload.receipt?.fileUrl) {
        window.open(payload.receipt.fileUrl, '_blank', 'noopener')
      }
    },
  })

  const feeTypeMutation = useMutation({
    mutationFn: (payload: any) => {
      if (editingFeeType) {
        return apiPatch<FeeTypeMutationPayload>(
          `/api/app/accounts/fee-types/${editingFeeType.id}`,
          payload,
        )
      }
      return apiPost<FeeTypeMutationPayload>('/api/app/accounts/fee-types', payload)
    },
    onSuccess: async () => {
      setFeeTypeModalOpen(false)
      setEditingFeeType(null)
      await refreshAll()
    },
  })

  const archiveFeeTypeMutation = useMutation({
    mutationFn: (feeTypeId: string) => apiDelete(`/api/app/accounts/fee-types/${feeTypeId}`),
    onSuccess: async () => {
      setFeeTypeToDelete(null)
      await refreshAll()
    },
  })

  const reprintReceiptMutation = useMutation({
    mutationFn: (receiptId: string) =>
      apiPost<ReceiptMutationPayload>(`/api/app/accounts/receipts/${receiptId}/reprint`, {}),
    onSuccess: (payload) => {
      if (payload.receipt.fileUrl) {
        window.open(payload.receipt.fileUrl, '_blank', 'noopener')
      }
    },
  })

  const previewReportMutation = useMutation({
    mutationFn: () =>
      apiPost<ExportPayload>('/api/app/accounts/reports/preview', {
        ...reportFilters,
      }),
    onSuccess: (payload) => {
      setPreviewUrl(payload.preview?.outputUrl ?? null)
    },
  })

  const exportReportMutation = useMutation({
    mutationFn: (format: 'csv' | 'html') =>
      apiPost<ExportPayload>('/api/app/accounts/reports/export', {
        ...reportFilters,
        format,
      }),
    onSuccess: (payload) => {
      const url = payload.export?.outputUrl
      if (url) {
        window.open(url, '_blank', 'noopener')
      }
    },
  })

  const voidPaymentMutation = useMutation({
    mutationFn: () =>
      apiPost(`/api/app/accounts/payments/${voidTarget?.id}/void`, {
        reason: voidReason,
      }),
    onSuccess: async () => {
      setVoidTarget(null)
      setVoidReason('')
      await refreshAll()
    },
  })

  const feeTypes = useMemo(() => dashboardQuery.data?.feeTypes ?? [], [dashboardQuery.data?.feeTypes])
  const paymentMethods = useMemo(
    () => dashboardQuery.data?.paymentMethods ?? [],
    [dashboardQuery.data?.paymentMethods],
  )
  const resolvedFeeTypeId = selectedFeeTypeId || feeTypes[0]?.id || ''
  const selectedFeeType = feeTypes.find((item) => item.id === resolvedFeeTypeId) ?? null
  const memberLedger = memberLedgerQuery.data?.ledger
  const monthOptions = useMemo(() => {
    if (!selectedFeeType || selectedFeeType.collectionMode !== 'monthly') {
      return [] as DueMonthOption[]
    }
    return memberLedger?.dueMonthOptions[selectedFeeType.id] ?? []
  }, [memberLedger?.dueMonthOptions, selectedFeeType])
  const recommendedMonth =
    monthOptions.find((item) => !item.isAdvance && item.outstandingAmount > 0)?.month ??
    monthOptions.find((item) => item.outstandingAmount > 0)?.month ??
    null
  const effectiveSelectedMonths =
    selectedFeeType?.collectionMode === 'monthly' &&
    selectedMonths.length === 0 &&
    recommendedMonth
      ? [recommendedMonth]
      : selectedMonths
  const suggestedAmount = !selectedFeeType
    ? 0
    : selectedFeeType.collectionMode !== 'monthly'
      ? Number(selectedFeeType.defaultAmount || 0)
      : effectiveSelectedMonths.reduce((sum, month) => {
          const option = monthOptions.find((item) => item.month === month)
          return sum + Number(option?.outstandingAmount ?? option?.expectedAmount ?? 0)
        }, 0)
  const effectiveAmount = amount === '' ? String(suggestedAmount) : amount
  const effectivePaymentMethodCode =
    paymentMethods.find((item) => item.code === paymentMethodCode)?.code ??
    paymentMethods[0]?.code ??
    'cash'

  if (dashboardQuery.isLoading) {
    return <LoadingState label="হিসাব মডিউল লোড হচ্ছে..." />
  }

  if (!dashboardQuery.data) {
    return (
      <EmptyState
        title="হিসাব তথ্য লোড করা যায়নি"
        description={errorMessage(dashboardQuery.error)}
      />
    )
  }

  return (
    <div className="page-stack">
      <div className="page-header content-card">
        <h1>হিসাব ও পেমেন্ট মডিউল</h1>
        <p>চাঁদা আদায়, রিসিট, সদস্য লেজার, রিপোর্ট, এক্সপোর্ট এবং সংবেদনশীল হিসাব নিয়ন্ত্রণ এক জায়গায়।</p>
      </div>

      <section className="stats-grid">
        <article className="stat-card"><p className="muted">আজকের আদায়</p><div className="stat-card__value">{toBanglaCurrency(dashboardQuery.data.stats.todayCollections)}</div></article>
        <article className="stat-card"><p className="muted">চলতি মাস</p><div className="stat-card__value">{toBanglaCurrency(dashboardQuery.data.stats.monthCollections)}</div></article>
        <article className="stat-card"><p className="muted">বকেয়া</p><div className="stat-card__value">{toBanglaCurrency(dashboardQuery.data.stats.outstandingDues)}</div></article>
        <article className="stat-card"><p className="muted">অ্যাডভান্স</p><div className="stat-card__value">{toBanglaCurrency(dashboardQuery.data.stats.advanceBalances)}</div></article>
      </section>

      <section className="split-grid split-grid--accounts">
        <article className="content-card section-grid">
          <div className="content-card__header">
            <div>
              <h2>ফি/চাঁদা সংগ্রহ</h2>
              <p className="muted">মাসিক সাবস্ক্রিপশন, ফাইন, ডোনেশন বা অন্য ফি সংগ্রহ করুন।</p>
            </div>
          </div>
          {collectMutation.isError ? <div className="error-banner">{errorMessage(collectMutation.error)}</div> : null}
          <FormField label="সদস্য খোঁজ">
            <TextInput value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="নাম, মোবাইল, বা সদস্য আইডি" />
          </FormField>
          {selectedMember ? <div className="shell-card"><strong>{selectedMember.label}</strong><p className="muted">{selectedMember.sublabel}</p></div> : null}
          {(memberLookupQuery.data?.items ?? []).length > 0 ? (
            <div className="lookup-list">
              {(memberLookupQuery.data?.items ?? []).map((item) => (
                <button key={item.id} className="lookup-list__item" type="button" onClick={() => { setSelectedMember(item); setMemberSearch(item.label); setReportFilters({ ...reportFilters, memberId: item.id }) }}>
                  <strong>{item.label}</strong>
                  <span>{item.sublabel}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="form-grid form-grid--two">
            <FormField label="ফি টাইপ">
              <SelectInput value={resolvedFeeTypeId} onChange={(event) => { setSelectedFeeTypeId(event.target.value); setSelectedMonths([]); setAmount('') }}>
                {feeTypes.map((feeType) => <option key={feeType.id} value={feeType.id}>{feeType.nameBn}</option>)}
              </SelectInput>
            </FormField>
            <FormField label="পেমেন্ট মেথড">
              <SelectInput value={effectivePaymentMethodCode} onChange={(event) => setPaymentMethodCode(event.target.value)}>
                {paymentMethods.map((method) => <option key={method.id} value={method.code}>{method.nameBn}</option>)}
              </SelectInput>
            </FormField>
          </div>

          {selectedFeeType?.collectionMode === 'monthly' ? (
            <div className="section-grid">
              <h3>মাস নির্বাচন</h3>
              {monthOptions.length === 0 ? (
                <EmptyState title="মাস পাওয়া যায়নি" description="সদস্য নির্বাচন করুন অথবা মাসিক ফি টাইপ বেছে নিন।" />
              ) : (
                <div className="month-selection-grid">
                  {monthOptions.map((option) => (
                    <label key={option.month} className={`month-option${selectedMonths.includes(option.month) ? ' is-selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={effectiveSelectedMonths.includes(option.month)}
                        onChange={(event) => {
                          setSelectedMonths((current) =>
                            event.target.checked
                              ? [...current, option.month].sort()
                              : current.filter((item) => item !== option.month),
                          )
                          setAmount('')
                        }}
                      />
                      <div>
                        <strong>{option.labelBn}</strong>
                        <p className="muted">{option.isAdvance ? 'অ্যাডভান্স' : 'বকেয়া'} • {toBanglaCurrency(option.outstandingAmount || option.expectedAmount)}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div className="form-grid form-grid--two">
            <FormField label="গ্রহণকৃত টাকা">
              <TextInput type="number" value={effectiveAmount} onChange={(event) => setAmount(event.target.value)} />
            </FormField>
            <FormField label="রেফারেন্স নম্বর">
              <TextInput value={referenceNo} onChange={(event) => setReferenceNo(event.target.value)} placeholder="বিকাশ/ব্যাংক রেফারেন্স" />
            </FormField>
          </div>
          <FormField label="নোট">
            <TextAreaInput value={note} onChange={(event) => setNote(event.target.value)} />
          </FormField>
          <div className="page-actions">
            <Button
              type="button"
              onClick={() => void collectMutation.mutate()}
              disabled={!canManageCollections || !resolvedFeeTypeId || Number(effectiveAmount) <= 0 || (selectedFeeType?.collectionMode === 'monthly' && !selectedMember?.id)}
            >
              টাকা গ্রহণ করুন
            </Button>
          </div>
        </article>

        <article className="content-card section-grid">
          <div className="content-card__header">
            <div>
              <h2>সদস্য লেজার</h2>
              <p className="muted">বকেয়া, অ্যাডভান্স, পেমেন্ট এবং রিসিট ইতিহাস দেখুন।</p>
            </div>
          </div>
          {!selectedMember ? (
            <EmptyState title="সদস্য নির্বাচন করুন" description="হিসাব লেজার দেখতে বাম পাশ থেকে সদস্য নির্বাচন করুন।" />
          ) : memberLedgerQuery.isLoading ? (
            <LoadingState label="সদস্য লেজার লোড হচ্ছে..." />
          ) : memberLedger ? (
            <>
              <div className="member-summary-grid">
                <article className="stat-card"><p className="muted">মোট নির্ধারিত</p><div className="stat-card__value">{toBanglaCurrency(memberLedger.summary.totalAssessed)}</div></article>
                <article className="stat-card"><p className="muted">মোট পরিশোধ</p><div className="stat-card__value">{toBanglaCurrency(memberLedger.summary.totalPaid)}</div></article>
                <article className="stat-card"><p className="muted">বকেয়া</p><div className="stat-card__value">{toBanglaCurrency(memberLedger.summary.outstanding)}</div></article>
                <article className="stat-card"><p className="muted">অ্যাডভান্স</p><div className="stat-card__value">{toBanglaCurrency(memberLedger.summary.advanceBalance)}</div></article>
              </div>

              <DataTable
                items={memberLedger.dueLines.slice(0, 12)}
                empty={<EmptyState title="কোনও বকেয়া লাইন নেই" description="সদস্যের মাসিক লেজার এখানে দেখাবে।" />}
                columns={[
                  { key: 'month', header: 'মাস', render: (item) => <div><strong>{item.feeTypeNameBn}</strong><p className="muted">{item.month}</p></div> },
                  { key: 'amounts', header: 'হিসাব', render: (item) => <div><strong>বকেয়া {toBanglaCurrency(item.outstandingAmount)}</strong><p className="muted">ধরা {toBanglaCurrency(item.expectedAmount)} • পরিশোধ {toBanglaCurrency(item.paidAmount)}</p></div> },
                  { key: 'status', header: 'স্ট্যাটাস', render: (item) => <Badge tone={item.status === 'paid' ? 'success' : item.status === 'partial' ? 'warning' : 'info'}>{item.status}</Badge> },
                ]}
              />
            </>
          ) : (
            <EmptyState title="লেজার পাওয়া যায়নি" description={errorMessage(memberLedgerQuery.error)} />
          )}
        </article>
      </section>

      {memberLedger ? (
        <section className="content-card section-grid">
          <div className="content-card__header">
            <div>
              <h2>রিসিট ও পেমেন্ট ইতিহাস</h2>
              <p className="muted">ঐতিহাসিক রিসিট রিপ্রিন্ট এবং প্রয়োজন হলে ম্যানেজার পর্যায়ে পেমেন্ট বাতিল।</p>
            </div>
          </div>
          <DataTable
            items={memberLedger.payments.slice(0, 10)}
            empty={<EmptyState title="কোনও পেমেন্ট নেই" description="এই সদস্যের পেমেন্ট ইতিহাস পরে দেখাবে।" />}
            columns={[
              { key: 'paidAt', header: 'তারিখ', render: (item) => <strong>{toDhakaDisplay(item.paidAt)}</strong> },
              { key: 'fee', header: 'ফি', render: (item) => <div><strong>{item.feeTypeNameBn}</strong><p className="muted">{item.paymentMethodNameBn}</p></div> },
              { key: 'amount', header: 'পরিমাণ', render: (item) => <strong>{toBanglaCurrency(item.amount)}</strong> },
              { key: 'status', header: 'স্ট্যাটাস', render: (item) => <PaymentStatusBadge payment={item} /> },
              { key: 'actions', header: 'অ্যাকশন', render: (item) => <div className="inline-actions">{item.receiptId ? <Button type="button" variant="ghost" onClick={() => void reprintReceiptMutation.mutate(item.receiptId!)}>রিসিট</Button> : null}{canVoidPayments && item.canVoid ? <Button type="button" variant="ghost" onClick={() => { setVoidTarget(item); setVoidReason('ভুল এন্ট্রি') }}>বাতিল</Button> : null}</div> },
            ]}
          />
        </section>
      ) : null}

      {canManageFeeTypes ? (
        <section className="content-card section-grid">
          <div className="content-card__header">
            <div>
              <h2>ফি টাইপ কনফিগারেশন</h2>
              <p className="muted">Admin এবং Super Admin এখান থেকে ফি টাইপ, ডিফল্ট এমাউন্ট এবং আচরণ নিয়ন্ত্রণ করতে পারবেন।</p>
            </div>
            <Button type="button" onClick={() => { setEditingFeeType(null); setFeeTypeModalOpen(true) }}>
              নতুন ফি টাইপ
            </Button>
          </div>
          <DataTable
            items={feeTypes}
            columns={[
              { key: 'name', header: 'ফি', render: (item) => <div><strong>{item.nameBn}</strong><p className="muted">{item.feeCode}</p></div> },
              { key: 'mode', header: 'মোড', render: (item) => <Badge tone={item.collectionMode === 'monthly' ? 'info' : 'neutral'}>{item.collectionMode}</Badge> },
              { key: 'amount', header: 'ডিফল্ট', render: (item) => <strong>{toBanglaCurrency(item.defaultAmount)}</strong> },
              { key: 'status', header: 'স্ট্যাটাস', render: (item) => <Badge tone={item.active ? 'success' : 'warning'}>{item.active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</Badge> },
              { key: 'actions', header: 'অ্যাকশন', render: (item) => <div className="inline-actions"><Button type="button" variant="ghost" onClick={() => { setEditingFeeType(item); setFeeTypeModalOpen(true) }}>সম্পাদনা</Button>{!item.isSystem ? <Button type="button" variant="ghost" onClick={() => setFeeTypeToDelete(item)}>আর্কাইভ</Button> : null}</div> },
            ]}
          />
        </section>
      ) : null}

      <ArchivedFeeTypesPanel enabled={canManageFeeTypes} />

      {canManageReports ? (
        <section className="content-card section-grid">
          <div className="content-card__header">
            <div>
              <h2>রিপোর্ট, এক্সপোর্ট ও প্রিন্ট প্রিভিউ</h2>
              <p className="muted">দৈনিক, মাসিক, বা কাস্টম তারিখে হিসাব রিপোর্ট দেখুন এবং CSV বা প্রিন্ট ভিউ নিন।</p>
            </div>
          </div>
          <div className="form-grid form-grid--three">
            <FormField label="রিপোর্ট টাইপ">
              <SelectInput value={reportFilters.preset} onChange={(event) => setReportFilters({ ...reportFilters, preset: event.target.value })}>
                <option value="daily">দৈনিক</option>
                <option value="monthly">মাসিক</option>
                <option value="yearly">বার্ষিক</option>
                <option value="custom">কাস্টম</option>
              </SelectInput>
            </FormField>
            <FormField label="শুরু তারিখ">
              <TextInput type="date" value={reportFilters.startDate} onChange={(event) => setReportFilters({ ...reportFilters, startDate: event.target.value })} />
            </FormField>
            <FormField label="শেষ তারিখ">
              <TextInput type="date" value={reportFilters.endDate} onChange={(event) => setReportFilters({ ...reportFilters, endDate: event.target.value })} />
            </FormField>
            <FormField label="ফি টাইপ">
              <SelectInput value={reportFilters.feeTypeId} onChange={(event) => setReportFilters({ ...reportFilters, feeTypeId: event.target.value })}>
                <option value="">সব</option>
                {feeTypes.map((feeType) => <option key={feeType.id} value={feeType.id}>{feeType.nameBn}</option>)}
              </SelectInput>
            </FormField>
            <FormField label="পেমেন্ট মেথড">
              <SelectInput value={reportFilters.paymentMethodCode} onChange={(event) => setReportFilters({ ...reportFilters, paymentMethodCode: event.target.value })}>
                <option value="">সব</option>
                {paymentMethods.map((method) => <option key={method.id} value={method.code}>{method.nameBn}</option>)}
              </SelectInput>
            </FormField>
          </div>
          <div className="page-actions">
            <Button type="button" variant="ghost" onClick={() => void previewReportMutation.mutate()} disabled={previewReportMutation.isPending}>প্রিন্ট প্রিভিউ</Button>
            <Button type="button" variant="ghost" onClick={() => void exportReportMutation.mutate('csv')} disabled={exportReportMutation.isPending}>CSV এক্সপোর্ট</Button>
            <Button type="button" variant="ghost" onClick={() => void exportReportMutation.mutate('html')} disabled={exportReportMutation.isPending}>HTML রিপোর্ট</Button>
          </div>

          {reportQuery.isLoading ? (
            <LoadingState label="রিপোর্ট লোড হচ্ছে..." />
          ) : reportQuery.data ? (
            <>
              <div className="stats-grid">
                <article className="stat-card"><p className="muted">আদায়</p><div className="stat-card__value">{toBanglaCurrency(reportQuery.data.report.summary.totalCollected)}</div></article>
                <article className="stat-card"><p className="muted">ট্রানজ্যাকশন</p><div className="stat-card__value">{reportQuery.data.report.summary.transactionCount}</div></article>
                <article className="stat-card"><p className="muted">বকেয়া</p><div className="stat-card__value">{toBanglaCurrency(reportQuery.data.report.summary.outstandingDues)}</div></article>
                <article className="stat-card"><p className="muted">অ্যাডভান্স</p><div className="stat-card__value">{toBanglaCurrency(reportQuery.data.report.summary.advanceBalances)}</div></article>
              </div>

              <DataTable
                items={reportQuery.data.report.payments.slice(0, 20)}
                empty={<EmptyState title="কোনও পেমেন্ট পাওয়া যায়নি" description="ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন।" />}
                columns={[
                  { key: 'member', header: 'সদস্য', render: (item) => <div><strong>{item.memberNameBn ?? 'সাধারণ'}</strong><p className="muted">{item.memberCode ?? item.paymentMethodNameBn}</p></div> },
                  { key: 'fee', header: 'ফি', render: (item) => <div><strong>{item.feeTypeNameBn}</strong><p className="muted">{toDhakaDisplay(item.paidAt)}</p></div> },
                  { key: 'amount', header: 'পরিমাণ', render: (item) => <strong>{toBanglaCurrency(item.amount)}</strong> },
                  { key: 'method', header: 'মেথড', render: (item) => <div><strong>{item.paymentMethodNameBn}</strong><p className="muted">{item.referenceNo ?? 'রেফারেন্স নেই'}</p></div> },
                  { key: 'status', header: 'স্ট্যাটাস', render: (item) => <PaymentStatusBadge payment={item} /> },
                  { key: 'actions', header: 'অ্যাকশন', render: (item) => <div className="inline-actions">{item.receiptId ? <Button type="button" variant="ghost" onClick={() => void reprintReceiptMutation.mutate(item.receiptId!)}>রিসিট</Button> : null}{canVoidPayments && item.canVoid ? <Button type="button" variant="ghost" onClick={() => { setVoidTarget(item); setVoidReason('ভুল এন্ট্রি') }}>বাতিল</Button> : null}</div> },
                ]}
              />
            </>
          ) : (
            <EmptyState title="রিপোর্ট লোড করা যায়নি" description={errorMessage(reportQuery.error)} />
          )}

          {previewUrl ? <iframe className="print-preview-frame" src={previewUrl} title="রিপোর্ট প্রিন্ট প্রিভিউ" /> : null}
        </section>
      ) : null}

      <FeeTypeFormModal
        key={`${editingFeeType?.id ?? 'new'}-${feeTypeModalOpen ? 'open' : 'closed'}`}
        open={feeTypeModalOpen}
        initialValue={editingFeeType}
        onClose={() => { setFeeTypeModalOpen(false); setEditingFeeType(null) }}
        onSubmit={async (payload) => {
          await feeTypeMutation.mutateAsync(payload)
        }}
        loading={feeTypeMutation.isPending}
      />

      <ConfirmDialog
        open={Boolean(feeTypeToDelete)}
        title="ফি টাইপ আর্কাইভ করবেন?"
        description="আর্কাইভ করলে এটি নতুন পেমেন্টে আর ব্যবহার করা যাবে না।"
        confirmLabel="আর্কাইভ করুন"
        loading={archiveFeeTypeMutation.isPending}
        onCancel={() => setFeeTypeToDelete(null)}
        onConfirm={() => {
          if (!feeTypeToDelete) {
            return
          }
          void archiveFeeTypeMutation.mutateAsync(feeTypeToDelete.id)
        }}
      />

      <Modal
        open={Boolean(voidTarget)}
        title="পেমেন্ট বাতিল"
        onClose={() => { setVoidTarget(null); setVoidReason('') }}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => { setVoidTarget(null); setVoidReason('') }}>
              বাতিল
            </Button>
            <Button type="button" variant="danger" onClick={() => void voidPaymentMutation.mutate()} disabled={voidPaymentMutation.isPending || voidReason.trim().length < 4}>
              পেমেন্ট বাতিল করুন
            </Button>
          </>
        }
      >
        <div className="section-grid">
          {voidPaymentMutation.isError ? <div className="error-banner">{errorMessage(voidPaymentMutation.error)}</div> : null}
          <p>শুধু Manager এবং তার উপরের ভূমিকায় এই কাজ করা যাবে।</p>
          <FormField label="কারণ">
            <TextAreaInput value={voidReason} onChange={(event) => setVoidReason(event.target.value)} />
          </FormField>
        </div>
      </Modal>
    </div>
  )
}
