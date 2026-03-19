import type { ArchivedFeeTypesPayload, FeeTypeDefinition } from '@shared/index'
import { toBanglaCurrency, toDhakaDisplay } from '@shared/index'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { useState } from 'react'
import { apiPost, apiRequest, errorMessage } from '@/lib/api'

interface RestorePayload {
  feeType: FeeTypeDefinition
}

export function ArchivedFeeTypesPanel({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient()
  const [restoreTarget, setRestoreTarget] = useState<FeeTypeDefinition | null>(null)

  const archivedQuery = useQuery({
    queryKey: ['fee-types-archived'],
    enabled,
    queryFn: () => apiRequest<ArchivedFeeTypesPayload>('/api/app/accounts/fee-types/archived'),
  })

  const restoreMutation = useMutation({
    mutationFn: (feeTypeId: string) =>
      apiPost<RestorePayload>(`/api/app/accounts/fee-types/${feeTypeId}/restore`, {}),
    onSuccess: async () => {
      setRestoreTarget(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['accounts-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['fee-types-archived'] }),
      ])
    },
  })

  if (!enabled) {
    return null
  }

  return (
    <section className="content-card section-grid">
      <div className="content-card__header">
        <div>
          <h2>আর্কাইভ ফি টাইপ</h2>
          <p className="muted">সংবেদনশীল accounting configuration প্রয়োজন হলে restore করুন।</p>
        </div>
      </div>

      {archivedQuery.isLoading ? (
        <LoadingState label="আর্কাইভ ফি টাইপ লোড হচ্ছে..." />
      ) : archivedQuery.isError ? (
        <EmptyState title="আর্কাইভ ফি টাইপ পাওয়া যায়নি" description={errorMessage(archivedQuery.error)} />
      ) : (
        <DataTable
          items={archivedQuery.data?.items ?? []}
          empty={
            <EmptyState title="কোনও আর্কাইভ ফি টাইপ নেই" description="Archive করা fee type থাকলে এখানে দেখা যাবে।" />
          }
          columns={[
            {
              key: 'name',
              header: 'ফি টাইপ',
              render: (item) => (
                <div>
                  <strong>{item.nameBn}</strong>
                  <p className="muted">{item.feeCode}</p>
                </div>
              ),
            },
            {
              key: 'mode',
              header: 'মোড',
              render: (item) => item.collectionMode,
            },
            {
              key: 'amount',
              header: 'ডিফল্ট',
              render: (item) => toBanglaCurrency(item.defaultAmount),
            },
            {
              key: 'deletedAt',
              header: 'আর্কাইভ সময়',
              render: (item) => toDhakaDisplay(item.deletedAt ?? null),
            },
            {
              key: 'actions',
              header: 'অ্যাকশন',
              render: (item) => (
                <Button type="button" variant="ghost" onClick={() => setRestoreTarget(item)}>
                  Restore
                </Button>
              ),
            },
          ]}
        />
      )}

      <ConfirmDialog
        open={Boolean(restoreTarget)}
        title="ফি টাইপ restore করবেন?"
        description="Restore করলে এটি আবার নতুন collection workflow-এ ব্যবহার করা যাবে।"
        confirmLabel="Restore"
        loading={restoreMutation.isPending}
        onCancel={() => setRestoreTarget(null)}
        onConfirm={() => {
          if (!restoreTarget) {
            return
          }
          void restoreMutation.mutateAsync(restoreTarget.id)
        }}
      />
    </section>
  )
}
