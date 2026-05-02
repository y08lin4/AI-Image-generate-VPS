export type ToastMessage = {
  text: string
  type: 'ok' | 'error' | 'info'
}

interface Props {
  message: ToastMessage | null
  onClose: () => void
}

export function MessageToast({ message, onClose }: Props) {
  if (!message) return null
  return (
    <div className={`toast ${message.type}`}>
      <span>{message.text}</span>
      <button type="button" onClick={onClose}>×</button>
    </div>
  )
}
