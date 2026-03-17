import type { ReactNode } from 'react'

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  if (!open) {
    return null
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-card__header">
          <h3>{title}</h3>
          <button className="icon-button" onClick={onClose} type="button">
            ×
          </button>
        </div>
        <div className="modal-card__body">{children}</div>
        {footer ? <div className="modal-card__footer">{footer}</div> : null}
      </div>
    </div>
  )
}
