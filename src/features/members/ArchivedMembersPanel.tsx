import { useState } from 'react'
import type { ArchivedMemberRecord, ArchivedMembersPayload, Member } from '@shared/index'
import { toDhakaDisplay } from '@shared/index'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { TextInput } from '@/components/ui/FormField'
import { LoadingState } from '@/components/ui/LoadingState'
import { apiPost, apiRequest, errorMessage } from '@/lib/api'

interface RestorePayload {
  member: Member
}

export function ArchivedMembersPanel({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [restoreTarget, setRestoreTarget] = useState<ArchivedMemberRecord | null>(null)

  const archivedQuery = useQuery({
    queryKey: ['members-archived', search, page],
    enabled,
    queryFn: () =>
      apiRequest<ArchivedMembersPayload>(
        `/api/app/members/archived?search=${encodeURIComponent(search)}&page=${page}&pageSize=8`,
      ),
  })

  const restoreMutation = useMutation({
    mutationFn: (memberId: string) =>
      apiPost<RestorePayload>(`/api/app/members/${memberId}/restore`, {}),
    onSuccess: async () => {
      setRestoreTarget(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['members'] }),
        queryClient.invalidateQueries({ queryKey: ['members-archived'] }),
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
          <h2>আর্কাইভ সদস্য পুনরুদ্ধার</h2>
          <p className="muted">Soft delete করা সদস্যদের তালিকা থেকে প্রয়োজনে restore করুন।</p>
        </div>
        <TextInput
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          placeholder="নাম, মোবাইল বা membership ID"
        />
      </div>

      {archivedQuery.isLoading ? (
        <LoadingState label="আর্কাইভ সদস্য লোড হচ্ছে..." />
      ) : archivedQuery.isError ? (
        <EmptyState title="আর্কাইভ সদস্য পাওয়া যায়নি" description={errorMessage(archivedQuery.error)} />
      ) : (
        <>
          <DataTable
            items={archivedQuery.data?.items ?? []}
            empty={
              <EmptyState
                title="কোনও আর্কাইভ সদস্য নেই"
                description="Soft delete হওয়া সদস্য থাকলে এখানে দেখা যাবে।"
              />
            }
            columns={[
              {
                key: 'name',
                header: 'সদস্য',
                render: (item) => (
                  <div>
                    <strong>{item.fullNameBn}</strong>
                    <p className="muted">{item.memberCode}</p>
                  </div>
                ),
              },
              {
                key: 'contact',
                header: 'মোবাইল',
                render: (item) => item.phone,
              },
              {
                key: 'status',
                header: 'স্ট্যাটাস',
                render: (item) => item.memberStatus,
              },
              {
                key: 'deletedAt',
                header: 'আর্কাইভ সময়',
                render: (item) => toDhakaDisplay(item.deletedAt),
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

          <div className="page-actions">
            <Button type="button" variant="ghost" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
              আগের পৃষ্ঠা
            </Button>
            <span className="muted">
              পৃষ্ঠা {page} / {Math.max(1, Math.ceil((archivedQuery.data?.total ?? 0) / (archivedQuery.data?.pageSize ?? 8)))}
            </span>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setPage((current) =>
                  Math.min(
                    Math.max(1, Math.ceil((archivedQuery.data?.total ?? 0) / (archivedQuery.data?.pageSize ?? 8))),
                    current + 1,
                  ),
                )
              }
              disabled={page >= Math.max(1, Math.ceil((archivedQuery.data?.total ?? 0) / (archivedQuery.data?.pageSize ?? 8)))}
            >
              পরের পৃষ্ঠা
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(restoreTarget)}
        title="সদস্য পুনরুদ্ধার করবেন?"
        description="Restore করলে সদস্যটি আবার সক্রিয় তালিকায় ফিরে আসবে।"
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
