import clsx from 'clsx'

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
}) {
  return <span className={clsx('ui-badge', `ui-badge--${tone}`)}>{children}</span>
}
