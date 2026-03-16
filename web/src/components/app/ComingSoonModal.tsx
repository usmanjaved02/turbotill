import { Button } from '../common/Button'
import { Modal } from '../common/Modal'

interface ComingSoonModalProps {
  open: boolean
  feature: string
  onClose: () => void
}

export const ComingSoonModal = ({ open, feature, onClose }: ComingSoonModalProps) => (
  <Modal
    open={open}
    onClose={onClose}
    title={`${feature} is coming soon`}
    footer={
      <Button onClick={onClose}>
        Got it
      </Button>
    }
  >
    <p>
      We are actively building this integration. Join the waitlist and we will notify you once it is production-ready.
    </p>
    <div className="row gap-sm">
      <input className="input" placeholder="you@business.com" />
      <Button variant="secondary">Join waitlist</Button>
    </div>
  </Modal>
)
