import type { PermissionKey } from '@shared/index'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuth } from '@/providers/useAuth'

export function PlaceholderPage({
  title,
  permission,
}: {
  title: string
  permission: PermissionKey
}) {
  const { user } = useAuth()

  if (!user?.permissions.includes(permission)) {
    return (
      <div className="page-stack">
        <EmptyState
          title="এই অংশটি আপনার জন্য উন্মুক্ত নয়"
          description="প্রয়োজন হলে ম্যানেজার বা অ্যাডমিন থেকে অনুমতি যোগ করুন।"
        />
      </div>
    )
  }

  return (
    <div className="page-stack">
      <div className="page-header content-card">
        <h1>{title}</h1>
        <p>এই মডিউলের পূর্ণাঙ্গ কার্যপ্রবাহ পরবর্তী ধাপে যুক্ত করা হবে।</p>
      </div>
      <EmptyState
        title="ভিত্তি প্রস্তুত"
        description="প্রোটেক্টেড রুট, মেনু ভিজিবিলিটি এবং পারমিশন-চেক ইতোমধ্যে সক্রিয় রয়েছে।"
      />
    </div>
  )
}
