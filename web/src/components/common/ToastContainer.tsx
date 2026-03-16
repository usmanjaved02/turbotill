import { useApp } from '../../context/AppContext'
import { ErrorToast } from './ErrorToast'
import { SuccessToast } from './SuccessToast'

export const ToastContainer = () => {
  const { toasts, dismissToast } = useApp()

  if (toasts.length === 0) return null

  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <button key={toast.id} className="toast-btn" onClick={() => dismissToast(toast.id)}>
          {toast.type === 'success' ? (
            <SuccessToast title={toast.title} message={toast.message} />
          ) : (
            <ErrorToast title={toast.title} message={toast.message} />
          )}
        </button>
      ))}
    </div>
  )
}
