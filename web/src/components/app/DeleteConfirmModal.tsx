import { Button } from '../common/Button'
import { Modal } from '../common/Modal'

interface DeleteConfirmModalProps {
  open: boolean
  title?: string
  description: string
  onClose: () => void
  onConfirm: () => void
}

export const DeleteConfirmModal = ({
  open,
  title = 'Confirm delete',
  description,
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) => (
  <Modal
    open={open}
    onClose={onClose}
    title={title}
    footer={
      <>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          Delete
        </Button>
      </>
    }
  >
    <p>{description}</p>
  </Modal>
)
