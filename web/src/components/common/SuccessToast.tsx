interface SuccessToastProps {
  title: string
  message: string
}

export const SuccessToast = ({ title, message }: SuccessToastProps) => (
  <article className="toast toast-success">
    <strong>{title}</strong>
    <p>{message}</p>
  </article>
)
