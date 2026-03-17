import { Button } from './Button'
import { Modal } from './Modal'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'নিশ্চিত করুন',
  cancelLabel = 'বাতিল',
  onCancel,
  onConfirm,
  loading = false,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onCancel: () => void
  onConfirm: () => void
  loading?: boolean
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'অপেক্ষা করুন...' : confirmLabel}
          </Button>
        </>
      }
    >
      <p>{description}</p>
    </Modal>
  )
}
