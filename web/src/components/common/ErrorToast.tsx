interface ErrorToastProps {
  title: string
  message: string
}

export const ErrorToast = ({ title, message }: ErrorToastProps) => (
  <article className="toast toast-error">
    <strong>{title}</strong>
    <p>{message}</p>
  </article>
)
