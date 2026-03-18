import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/ui/EmptyState'

export interface AnalyticsRankingItem {
  key: string
  label: string
  value: number
  sublabel?: string | null
  href?: string | null
}

export function AnalyticsRankingList({
  items,
  emptyTitle,
  emptyDescription,
}: {
  items: AnalyticsRankingItem[]
  emptyTitle: string
  emptyDescription: string
}) {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  const maxValue = Math.max(...items.map((item) => item.value), 1)

  return (
    <div className="analytics-ranking-list">
      {items.map((item) => {
        const ratio = Math.max(8, Math.round((item.value / maxValue) * 100))
        const content = (
          <>
            <div className="analytics-ranking-list__header">
              <div>
                <strong>{item.label}</strong>
                {item.sublabel ? <p className="muted">{item.sublabel}</p> : null}
              </div>
              <strong>{item.value}</strong>
            </div>
            <div className="analytics-bar-track">
              <span className="analytics-bar-fill" style={{ width: `${ratio}%` }} />
            </div>
          </>
        )

        if (item.href) {
          return (
            <Link className="analytics-ranking-item" key={item.key} to={item.href}>
              {content}
            </Link>
          )
        }

        return (
          <article className="analytics-ranking-item" key={item.key}>
            {content}
          </article>
        )
      })}
    </div>
  )
}
