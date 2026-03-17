import { useDeferredValue, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  COPY_CONDITIONS,
  LOAN_RESOLUTION_CODES,
  REMINDER_CHANNELS,
  ROLE_RANK,
  toBanglaCurrency,
  toDhakaDisplay,
  type CirculationDashboardPayload,
  type CirculationLoanListPayload,
  type CirculationSettings,
  type LoanListItem,
  type LookupOption,
  type ReminderRuleDefinition,
  type ReminderTemplateDefinition,
  type ReservationRecord,
} from '@shared/index'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { CheckboxInput, FormField, SelectInput, TextAreaInput, TextInput } from '@/components/ui/FormField'
import { LoadingState } from '@/components/ui/LoadingState'
import { useLocalStorageState } from '@/hooks/useLocalStorageState'
import { apiPost, apiPut, apiRequest, errorMessage } from '@/lib/api'
import { useAuth } from '@/providers/useAuth'

interface LookupPayload {
  items: LookupOption[]
}

interface CopyLookupPayload {
  copy: any
}

function LoanStatusBadge({ status }: { status: LoanListItem['status'] }) {
  const tone =
    status === 'overdue'
      ? 'danger'
      : status === 'returned'
        ? 'success'
        : status === 'lost'
          ? 'warning'
          : 'info'

  return <Badge tone={tone}>{status}</Badge>
}

function ReservationStatusBadge({ status }: { status: ReservationRecord['status'] }) {
  const tone =
    status === 'ready'
      ? 'warning'
      : status === 'fulfilled'
        ? 'success'
        : status === 'cancelled' || status === 'expired'
          ? 'danger'
          : 'info'

  return <Badge tone={tone}>{status}</Badge>
}

function LookupList({
  title,
  items,
  onPick,
}: {
  title: string
  items: LookupOption[]
  onPick: (item: LookupOption) => void
}) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className="lookup-list">
      <p className="lookup-list__title">{title}</p>
      {items.map((item) => (
        <button
          key={item.id}
          className="lookup-list__item"
          type="button"
          onClick={() => onPick(item)}
        >
          <strong>{item.label}</strong>
          {item.sublabel ? <span>{item.sublabel}</span> : null}
        </button>
      ))}
    </div>
  )
}

function ReminderSettingsPanel({
  initialSettings,
  loading,
  onSave,
}: {
  initialSettings: CirculationSettings
  loading: boolean
  onSave: (settings: CirculationSettings) => Promise<void>
}) {
  const [draft, setDraft] = useState(initialSettings)
  const [error, setError] = useState<string | null>(null)

  function updateRule(nextRule: ReminderRuleDefinition) {
    setDraft((current) => ({
      ...current,
      reminderRules: current.reminderRules.map((rule) =>
        rule.key === nextRule.key ? nextRule : rule,
      ),
    }))
  }

  function updateTemplate(nextTemplate: ReminderTemplateDefinition) {
    setDraft((current) => ({
      ...current,
      reminderTemplates: current.reminderTemplates.map((template) =>
        template.key === nextTemplate.key ? nextTemplate : template,
      ),
    }))
  }

  return (
    <section className="content-card section-grid">
      <div className="content-card__header">
        <div>
          <h2>রিমাইন্ডার ও ফাইন সেটিংস</h2>
          <p className="muted">ম্যানেজার এবং ঊর্ধ্বতন ভূমিকা থেকে circulation policy ও reminder rules নিয়ন্ত্রণ করুন।</p>
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="form-grid form-grid--three">
        <FormField label="Default loan days">
          <TextInput
            type="number"
            value={draft.policy.defaultLoanDays}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                policy: { ...current.policy, defaultLoanDays: Number(event.target.value) || 1 },
              }))
            }
          />
        </FormField>
        <FormField label="Default renew days">
          <TextInput
            type="number"
            value={draft.policy.defaultRenewDays}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                policy: { ...current.policy, defaultRenewDays: Number(event.target.value) || 1 },
              }))
            }
          />
        </FormField>
        <FormField label="Max renewals">
          <TextInput
            type="number"
            value={draft.policy.maxRenewals}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                policy: { ...current.policy, maxRenewals: Number(event.target.value) || 0 },
              }))
            }
          />
        </FormField>
      </div>

      <div className="form-grid form-grid--three">
        <FormField label="Grace days">
          <TextInput
            type="number"
            value={draft.policy.graceDays}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                policy: { ...current.policy, graceDays: Number(event.target.value) || 0 },
              }))
            }
          />
        </FormField>
        <FormField label="Fine per day">
          <TextInput
            type="number"
            value={draft.policy.overdueFinePerDay}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                policy: {
                  ...current.policy,
                  overdueFinePerDay: Number(event.target.value) || 0,
                },
              }))
            }
          />
        </FormField>
        <FormField label="Max fine amount">
          <TextInput
            type="number"
            value={draft.policy.maxFineAmount}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                policy: { ...current.policy, maxFineAmount: Number(event.target.value) || 0 },
              }))
            }
          />
        </FormField>
      </div>

      <div className="form-grid form-grid--two">
        <CheckboxInput
          label="Allow renew when overdue"
          checked={draft.policy.allowRenewWhenOverdue}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              policy: { ...current.policy, allowRenewWhenOverdue: event.target.checked },
            }))
          }
        />
        <CheckboxInput
          label="Allow reservations"
          checked={draft.policy.allowReservations}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              policy: { ...current.policy, allowReservations: event.target.checked },
            }))
          }
        />
        <CheckboxInput
          label="Auto hold returned copies for queue"
          checked={draft.policy.autoReserveReturnedCopy}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              policy: { ...current.policy, autoReserveReturnedCopy: event.target.checked },
            }))
          }
        />
        <CheckboxInput
          label="Enable reminder cron"
          checked={draft.policy.reminderCronEnabled}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              policy: { ...current.policy, reminderCronEnabled: event.target.checked },
            }))
          }
        />
      </div>

      <div className="section-grid">
        <h3>Provider keys</h3>
        <div className="form-grid form-grid--three">
          {(['whatsapp', 'sms', 'email'] as const).map((channel) => (
            <FormField key={channel} label={`${channel} provider`}>
              <SelectInput
                value={draft.reminderProviders[channel]}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    reminderProviders: {
                      ...current.reminderProviders,
                      [channel]: event.target.value,
                    },
                  }))
                }
              >
                <option value={`${channel}_stub`}>{`${channel}_stub`}</option>
              </SelectInput>
            </FormField>
          ))}
        </div>
      </div>

      <div className="section-grid">
        <h3>Reminder rules</h3>
        {draft.reminderRules.map((rule) => (
          <div className="shell-card section-grid" key={rule.key}>
            <div className="form-grid form-grid--three">
              <FormField label="Rule name">
                <TextInput
                  value={rule.nameBn}
                  onChange={(event) =>
                    updateRule({ ...rule, nameBn: event.target.value, nameEn: event.target.value })
                  }
                />
              </FormField>
              <FormField label="Channel">
                <SelectInput
                  value={rule.channel}
                  onChange={(event) => updateRule({ ...rule, channel: event.target.value as any })}
                >
                  {REMINDER_CHANNELS.map((channel) => (
                    <option key={channel} value={channel}>
                      {channel}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <FormField label="Offset days">
                <TextInput
                  type="number"
                  value={rule.offsetDays}
                  onChange={(event) =>
                    updateRule({ ...rule, offsetDays: Number(event.target.value) || 0 })
                  }
                />
              </FormField>
            </div>
            <div className="form-grid form-grid--three">
              <FormField label="Template">
                <SelectInput
                  value={rule.templateKey}
                  onChange={(event) => updateRule({ ...rule, templateKey: event.target.value })}
                >
                  {draft.reminderTemplates.map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.nameBn}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <FormField label="Max retries">
                <TextInput
                  type="number"
                  value={rule.maxRetries}
                  onChange={(event) =>
                    updateRule({ ...rule, maxRetries: Number(event.target.value) || 0 })
                  }
                />
              </FormField>
              <FormField label="Retry delay (minutes)">
                <TextInput
                  type="number"
                  value={rule.retryDelayMinutes}
                  onChange={(event) =>
                    updateRule({ ...rule, retryDelayMinutes: Number(event.target.value) || 1 })
                  }
                />
              </FormField>
            </div>
            <CheckboxInput
              label="Rule enabled"
              checked={rule.enabled}
              onChange={(event) => updateRule({ ...rule, enabled: event.target.checked })}
            />
          </div>
        ))}
      </div>

      <div className="section-grid">
        <h3>Reminder templates</h3>
        {draft.reminderTemplates.map((template) => (
          <div className="shell-card section-grid" key={template.key}>
            <div className="form-grid form-grid--three">
              <FormField label="Template name">
                <TextInput
                  value={template.nameBn}
                  onChange={(event) =>
                    updateTemplate({
                      ...template,
                      nameBn: event.target.value,
                      nameEn: event.target.value,
                    })
                  }
                />
              </FormField>
              <FormField label="Channel">
                <SelectInput
                  value={template.channel}
                  onChange={(event) =>
                    updateTemplate({ ...template, channel: event.target.value as any })
                  }
                >
                  {REMINDER_CHANNELS.map((channel) => (
                    <option key={channel} value={channel}>
                      {channel}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <CheckboxInput
                label="Template enabled"
                checked={template.enabled}
                onChange={(event) =>
                  updateTemplate({ ...template, enabled: event.target.checked })
                }
              />
            </div>
            <FormField label="Bangla body">
              <TextAreaInput
                value={template.bodyTemplateBn}
                onChange={(event) =>
                  updateTemplate({ ...template, bodyTemplateBn: event.target.value })
                }
              />
            </FormField>
            <FormField label="English body">
              <TextAreaInput
                value={template.bodyTemplateEn ?? ''}
                onChange={(event) =>
                  updateTemplate({ ...template, bodyTemplateEn: event.target.value })
                }
              />
            </FormField>
          </div>
        ))}
      </div>

      <div className="page-actions">
        <Button
          type="button"
          onClick={() =>
            void onSave(draft).catch((saveError) => setError(errorMessage(saveError)))
          }
          disabled={loading}
        >
          Save circulation settings
        </Button>
      </div>
    </section>
  )
}

export function CirculationPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [loanFilters, setLoanFilters] = useLocalStorageState('plms-circulation-loans', {
    bucket: 'active',
    search: '',
    page: 1,
    pageSize: 10,
  })
  const [issueMemberSearch, setIssueMemberSearch] = useState('')
  const [issueMember, setIssueMember] = useState<LookupOption | null>(null)
  const [issueBarcode, setIssueBarcode] = useState('')
  const [issueDueAt, setIssueDueAt] = useState('')
  const [issueExpectedReturnAt, setIssueExpectedReturnAt] = useState('')
  const [issueRemarks, setIssueRemarks] = useState('')
  const [returnBarcode, setReturnBarcode] = useState('')
  const [returnOutcome, setReturnOutcome] = useState<(typeof LOAN_RESOLUTION_CODES)[number]>('returned')
  const [returnCondition, setReturnCondition] = useState<(typeof COPY_CONDITIONS)[number]>('good')
  const [returnFinePaid, setReturnFinePaid] = useState('0')
  const [returnPaymentTypeCode, setReturnPaymentTypeCode] = useState('cash')
  const [returnWaiveFine, setReturnWaiveFine] = useState(false)
  const [returnRemarks, setReturnRemarks] = useState('')
  const [reservationMemberSearch, setReservationMemberSearch] = useState('')
  const [reservationMember, setReservationMember] = useState<LookupOption | null>(null)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [selectedTitle, setSelectedTitle] = useState<LookupOption | null>(null)
  const [reservationNote, setReservationNote] = useState('')
  const [reservationToCancel, setReservationToCancel] = useState<ReservationRecord | null>(null)

  const deferredLoanSearch = useDeferredValue(loanFilters.search)
  const deferredIssueMemberSearch = useDeferredValue(issueMemberSearch)
  const deferredReservationMemberSearch = useDeferredValue(reservationMemberSearch)
  const deferredCatalogSearch = useDeferredValue(catalogSearch)
  const deferredIssueBarcode = useDeferredValue(issueBarcode)
  const deferredReturnBarcode = useDeferredValue(returnBarcode)

  const dashboardQuery = useQuery({
    queryKey: ['circulation-dashboard'],
    queryFn: () => apiRequest<CirculationDashboardPayload>('/api/app/circulation/dashboard'),
  })

  const loansQuery = useQuery({
    queryKey: ['circulation-loans', loanFilters.bucket, deferredLoanSearch, loanFilters.page, loanFilters.pageSize],
    queryFn: () =>
      apiRequest<CirculationLoanListPayload>(
        `/api/app/circulation/loans?bucket=${encodeURIComponent(loanFilters.bucket)}&search=${encodeURIComponent(deferredLoanSearch)}&page=${loanFilters.page}&pageSize=${loanFilters.pageSize}`,
      ),
  })

  const issueMemberQuery = useQuery({
    queryKey: ['circulation-members-search', deferredIssueMemberSearch],
    enabled: deferredIssueMemberSearch.trim().length >= 2,
    queryFn: () =>
      apiRequest<LookupPayload>(
        `/api/app/circulation/members/search?query=${encodeURIComponent(deferredIssueMemberSearch)}`,
      ),
  })

  const reservationMemberQuery = useQuery({
    queryKey: ['circulation-reservation-members-search', deferredReservationMemberSearch],
    enabled: deferredReservationMemberSearch.trim().length >= 2,
    queryFn: () =>
      apiRequest<LookupPayload>(
        `/api/app/circulation/members/search?query=${encodeURIComponent(deferredReservationMemberSearch)}`,
      ),
  })

  const catalogQuery = useQuery({
    queryKey: ['circulation-catalog-search', deferredCatalogSearch],
    enabled: deferredCatalogSearch.trim().length >= 2,
    queryFn: () =>
      apiRequest<LookupPayload>(
        `/api/app/circulation/catalog/search?query=${encodeURIComponent(deferredCatalogSearch)}`,
      ),
  })

  const issueCopyQuery = useQuery({
    queryKey: ['circulation-copy-lookup', deferredIssueBarcode],
    enabled: deferredIssueBarcode.trim().length >= 2,
    queryFn: () =>
      apiRequest<CopyLookupPayload>(
        `/api/app/circulation/copies/lookup?barcode=${encodeURIComponent(deferredIssueBarcode)}`,
      ),
  })

  const returnCopyQuery = useQuery({
    queryKey: ['circulation-return-lookup', deferredReturnBarcode],
    enabled: deferredReturnBarcode.trim().length >= 2,
    queryFn: () =>
      apiRequest<CopyLookupPayload>(
        `/api/app/circulation/copies/lookup?barcode=${encodeURIComponent(deferredReturnBarcode)}`,
      ),
  })

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['circulation-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['circulation-loans'] }),
    ])
  }

  const issueMutation = useMutation({
    mutationFn: () =>
      apiPost('/api/app/circulation/issue', {
        memberId: issueMember?.id,
        copyBarcode: issueBarcode,
        dueAt: issueDueAt,
        expectedReturnAt: issueExpectedReturnAt,
        remarks: issueRemarks,
      }),
    onSuccess: async () => {
      setIssueBarcode('')
      setIssueRemarks('')
      setIssueDueAt('')
      setIssueExpectedReturnAt('')
      await refreshAll()
    },
  })

  const returnMutation = useMutation({
    mutationFn: () =>
      apiPost('/api/app/circulation/return', {
        copyBarcode: returnBarcode,
        outcome: returnOutcome,
        condition: returnCondition,
        waiveFine: returnWaiveFine,
        finePaid: Number(returnFinePaid) || 0,
        paymentTypeCode: returnPaymentTypeCode,
        remarks: returnRemarks,
      }),
    onSuccess: async () => {
      setReturnBarcode('')
      setReturnRemarks('')
      setReturnFinePaid('0')
      setReturnWaiveFine(false)
      setReturnOutcome('returned')
      setReturnCondition('good')
      await refreshAll()
    },
  })

  const renewMutation = useMutation({
    mutationFn: (loanId: string) => apiPost('/api/app/circulation/renew', { loanId }),
    onSuccess: async () => {
      await refreshAll()
    },
  })

  const reservationMutation = useMutation({
    mutationFn: () =>
      apiPost('/api/app/circulation/reservations', {
        memberId: reservationMember?.id,
        bibliographicRecordId: selectedTitle?.id,
        note: reservationNote,
      }),
    onSuccess: async () => {
      setReservationNote('')
      setSelectedTitle(null)
      await refreshAll()
    },
  })

  const reservationCancelMutation = useMutation({
    mutationFn: (reservation: ReservationRecord) =>
      apiRequest(`/api/app/circulation/reservations/${reservation.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      }),
    onSuccess: async () => {
      setReservationToCancel(null)
      await refreshAll()
    },
  })

  const settingsMutation = useMutation({
    mutationFn: (settings: CirculationSettings) =>
      apiPut('/api/app/circulation/settings', settings),
    onSuccess: async () => {
      await refreshAll()
    },
  })

  const roleRank = user ? ROLE_RANK[user.role] : 0
  const canManageSettings = roleRank >= ROLE_RANK.manager
  const loanItems = loansQuery.data?.items ?? []
  const totalPages = Math.max(1, Math.ceil((loansQuery.data?.total ?? 0) / loanFilters.pageSize))
  const reminderLogs = dashboardQuery.data?.reminderLogs ?? []
  const reservations = dashboardQuery.data?.reservations ?? []
  const paymentTypes = dashboardQuery.data?.paymentTypes ?? []
  const settingsHash = useMemo(
    () => JSON.stringify(dashboardQuery.data?.settings ?? {}),
    [dashboardQuery.data?.settings],
  )

  if (dashboardQuery.isLoading) {
    return <LoadingState label="Circulation module loading..." />
  }

  if (!dashboardQuery.data) {
    return (
      <EmptyState
        title="Circulation data could not be loaded"
        description={errorMessage(dashboardQuery.error)}
      />
    )
  }

  return (
    <div className="page-stack">
      <div className="page-header content-card">
        <h1>সার্কুলেশন মডিউল</h1>
        <p>Issue, return, renew, due list, overdue fines, reservations, and reminder operations in one workspace.</p>
      </div>

      <section className="stats-grid">
        <article className="stat-card"><p className="muted">Active loans</p><div className="stat-card__value">{dashboardQuery.data.stats.activeLoans}</div></article>
        <article className="stat-card"><p className="muted">Due today</p><div className="stat-card__value">{dashboardQuery.data.stats.dueToday}</div></article>
        <article className="stat-card"><p className="muted">Overdue</p><div className="stat-card__value">{dashboardQuery.data.stats.overdueLoans}</div></article>
        <article className="stat-card"><p className="muted">Open fines</p><div className="stat-card__value">{dashboardQuery.data.stats.openFines}</div></article>
      </section>

      <section className="split-grid split-grid--circulation">
        <article className="content-card section-grid">
          <div className="content-card__header"><div><h2>Issue by barcode</h2><p className="muted">Scan copy barcode first, then choose the member.</p></div></div>
          {issueMutation.isError ? <div className="error-banner">{errorMessage(issueMutation.error)}</div> : null}
          <FormField label="Member search"><TextInput value={issueMemberSearch} onChange={(event) => setIssueMemberSearch(event.target.value)} placeholder="Name, mobile, or membership ID" /></FormField>
          {issueMember ? <div className="shell-card"><strong>{issueMember.label}</strong><p className="muted">{issueMember.sublabel}</p></div> : null}
          <LookupList title="Select member" items={issueMemberQuery.data?.items ?? []} onPick={(item) => { setIssueMember(item); setIssueMemberSearch(item.label) }} />
          <FormField label="Copy barcode / accession"><TextInput value={issueBarcode} onChange={(event) => setIssueBarcode(event.target.value)} placeholder="Scan barcode" /></FormField>
          {issueCopyQuery.data?.copy ? <div className="shell-card"><strong>{issueCopyQuery.data.copy.title}</strong><p className="muted">{issueCopyQuery.data.copy.accessionCode} • {issueCopyQuery.data.copy.availability}</p></div> : null}
          <div className="form-grid form-grid--two">
            <FormField label="Due date"><TextInput type="date" value={issueDueAt} onChange={(event) => setIssueDueAt(event.target.value)} /></FormField>
            <FormField label="Expected return"><TextInput type="date" value={issueExpectedReturnAt} onChange={(event) => setIssueExpectedReturnAt(event.target.value)} /></FormField>
          </div>
          <FormField label="Remarks"><TextAreaInput value={issueRemarks} onChange={(event) => setIssueRemarks(event.target.value)} /></FormField>
          <div className="page-actions"><Button type="button" onClick={() => void issueMutation.mutate()} disabled={!issueMember?.id || !issueBarcode.trim() || issueMutation.isPending}>Issue copy</Button></div>
        </article>

        <article className="content-card section-grid">
          <div className="content-card__header"><div><h2>Return by barcode</h2><p className="muted">Scan the copy barcode to process return, damage, loss, or withdrawal.</p></div></div>
          {returnMutation.isError ? <div className="error-banner">{errorMessage(returnMutation.error)}</div> : null}
          <FormField label="Copy barcode / accession"><TextInput value={returnBarcode} onChange={(event) => setReturnBarcode(event.target.value)} placeholder="Scan barcode" /></FormField>
          {returnCopyQuery.data?.copy?.activeLoan ? <div className="shell-card"><strong>{returnCopyQuery.data.copy.title}</strong><p className="muted">Borrower: {returnCopyQuery.data.copy.activeLoan.memberNameBn} • Due {toDhakaDisplay(returnCopyQuery.data.copy.activeLoan.dueAt)}</p></div> : null}
          <div className="form-grid form-grid--two">
            <FormField label="Outcome"><SelectInput value={returnOutcome} onChange={(event) => setReturnOutcome(event.target.value as any)}>{LOAN_RESOLUTION_CODES.map((code) => <option key={code} value={code}>{code}</option>)}</SelectInput></FormField>
            <FormField label="Copy condition"><SelectInput value={returnCondition} onChange={(event) => setReturnCondition(event.target.value as any)}>{COPY_CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}</SelectInput></FormField>
          </div>
          <div className="form-grid form-grid--two">
            <FormField label="Fine paid now"><TextInput type="number" value={returnFinePaid} onChange={(event) => setReturnFinePaid(event.target.value)} /></FormField>
            <FormField label="Payment method"><SelectInput value={returnPaymentTypeCode} onChange={(event) => setReturnPaymentTypeCode(event.target.value)}>{paymentTypes.map((paymentType) => <option key={paymentType.id} value={paymentType.code}>{paymentType.nameBn}</option>)}</SelectInput></FormField>
          </div>
          <CheckboxInput label="Waive remaining fine" checked={returnWaiveFine} onChange={(event) => setReturnWaiveFine(event.target.checked)} />
          <FormField label="Remarks"><TextAreaInput value={returnRemarks} onChange={(event) => setReturnRemarks(event.target.value)} /></FormField>
          <div className="page-actions"><Button type="button" onClick={() => void returnMutation.mutate()} disabled={!returnBarcode.trim() || returnMutation.isPending}>Complete return</Button></div>
        </article>
      </section>

      <section className="content-card section-grid">
        <div className="content-card__header"><div><h2>Loan lists</h2><p className="muted">Due, overdue, active, returned, and quick renew workflows.</p></div><div className="filter-bar">{['active', 'due', 'overdue', 'returned'].map((bucket) => <Button key={bucket} type="button" variant={loanFilters.bucket === bucket ? 'primary' : 'ghost'} onClick={() => setLoanFilters({ ...loanFilters, bucket, page: 1 })}>{bucket}</Button>)}</div></div>
        <div className="filter-bar"><TextInput value={loanFilters.search} onChange={(event) => setLoanFilters({ ...loanFilters, search: event.target.value, page: 1 })} placeholder="Search by member, title, barcode, accession" /></div>
        {loansQuery.isLoading ? <LoadingState label="Loading loan list..." /> : loansQuery.isError ? <EmptyState title="Loan list unavailable" description={errorMessage(loansQuery.error)} /> : <DataTable items={loanItems} empty={<EmptyState title="No loans found" description="Try another bucket or search term." />} columns={[{ key: 'title', header: 'Title', render: (item) => <div><strong>{item.title}</strong><p className="muted">{item.accessionCode}</p></div> }, { key: 'member', header: 'Member', render: (item) => <div><strong>{item.memberNameBn}</strong><p className="muted">{item.memberCode}</p></div> }, { key: 'dates', header: 'Dates', render: (item) => <div><strong>Due {toDhakaDisplay(item.dueDate)}</strong><p className="muted">Issued {toDhakaDisplay(item.issueDate)}</p></div> }, { key: 'fine', header: 'Overdue / fine', render: (item) => <div><strong>{item.overdueDays} days</strong><p className="muted">{toBanglaCurrency(item.fineAmount)}</p></div> }, { key: 'status', header: 'Status', render: (item) => <LoanStatusBadge status={item.status} /> }, { key: 'actions', header: 'Actions', render: (item) => <div className="inline-actions">{item.status !== 'returned' && item.status !== 'lost' ? <Button type="button" variant="ghost" onClick={() => void renewMutation.mutate(item.id)} disabled={renewMutation.isPending}>Quick renew</Button> : null}{item.status !== 'returned' && item.status !== 'lost' ? <Button type="button" variant="ghost" onClick={() => setReturnBarcode(item.barcodeValue)}>Return</Button> : null}</div> }]} />}
        <div className="page-actions"><Button type="button" variant="ghost" onClick={() => setLoanFilters({ ...loanFilters, page: Math.max(1, loanFilters.page - 1) })} disabled={loanFilters.page === 1}>Previous</Button><span className="muted">Page {loanFilters.page} / {totalPages}</span><Button type="button" variant="ghost" onClick={() => setLoanFilters({ ...loanFilters, page: Math.min(totalPages, loanFilters.page + 1) })} disabled={loanFilters.page >= totalPages}>Next</Button></div>
      </section>

      <section className="split-grid split-grid--circulation">
        <article className="content-card section-grid">
          <div className="content-card__header"><div><h2>Reservations</h2><p className="muted">Optional waiting list support for high-demand titles.</p></div></div>
          {reservationMutation.isError ? <div className="error-banner">{errorMessage(reservationMutation.error)}</div> : null}
          <FormField label="Member search"><TextInput value={reservationMemberSearch} onChange={(event) => setReservationMemberSearch(event.target.value)} placeholder="Name, mobile, or membership ID" /></FormField>
          {reservationMember ? <div className="shell-card"><strong>{reservationMember.label}</strong><p className="muted">{reservationMember.sublabel}</p></div> : null}
          <LookupList title="Select member" items={reservationMemberQuery.data?.items ?? []} onPick={(item) => { setReservationMember(item); setReservationMemberSearch(item.label) }} />
          <FormField label="Title search"><TextInput value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Title or ISBN" /></FormField>
          {selectedTitle ? <div className="shell-card"><strong>{selectedTitle.label}</strong><p className="muted">{selectedTitle.sublabel}</p></div> : null}
          <LookupList title="Select title" items={catalogQuery.data?.items ?? []} onPick={(item) => { setSelectedTitle(item); setCatalogSearch(item.label) }} />
          <FormField label="Note"><TextAreaInput value={reservationNote} onChange={(event) => setReservationNote(event.target.value)} /></FormField>
          <div className="page-actions"><Button type="button" onClick={() => void reservationMutation.mutate()} disabled={!reservationMember?.id || !selectedTitle?.id || reservationMutation.isPending}>Create reservation</Button></div>
          <div className="section-grid">{reservations.length === 0 ? <EmptyState title="No reservations" description="Waiting list entries will appear here." /> : reservations.map((reservation) => <article className="shell-card" key={reservation.id}><div className="inline-actions"><div><strong>{reservation.title}</strong><p className="muted">{reservation.memberNameBn} • Queue {reservation.queuePosition}</p></div><ReservationStatusBadge status={reservation.status} /></div><div className="page-actions"><Button type="button" variant="ghost" onClick={() => setReservationToCancel(reservation)}>Cancel</Button></div></article>)}</div>
        </article>

        <article className="content-card section-grid">
          <div className="content-card__header"><div><h2>Reminder logs</h2><p className="muted">Queued, sent, failed, and retried reminder deliveries.</p></div></div>
          {reminderLogs.length === 0 ? <EmptyState title="No reminder logs yet" description="Queue and cron activity will appear here." /> : reminderLogs.map((log) => <article className="shell-card" key={log.id}><div className="inline-actions"><div><strong>{log.title ?? log.reminderType}</strong><p className="muted">{log.memberNameBn} • {log.channel} • {toDhakaDisplay(log.scheduledFor)}</p></div><Badge tone={log.status === 'sent' ? 'success' : log.status === 'failed' ? 'danger' : 'warning'}>{log.status}</Badge></div>{log.lastError ? <p className="muted">{log.lastError}</p> : null}</article>)}
        </article>
      </section>

      {canManageSettings ? <ReminderSettingsPanel key={settingsHash} initialSettings={dashboardQuery.data.settings} loading={settingsMutation.isPending} onSave={async (settings) => { await settingsMutation.mutateAsync(settings) }} /> : null}

      <ConfirmDialog open={Boolean(reservationToCancel)} title="Cancel reservation?" description="This will remove the member from the current waiting list position." confirmLabel="Cancel reservation" loading={reservationCancelMutation.isPending} onCancel={() => setReservationToCancel(null)} onConfirm={() => { if (!reservationToCancel) { return } void reservationCancelMutation.mutateAsync(reservationToCancel) }} />
    </div>
  )
}
