export const formatCurrency = (amount: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount)

export const formatDateTime = (date: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date))

export const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))

export const humanizeSource = (source: string) => {
  const map: Record<string, string> = {
    mic: 'Mic UI',
    script: 'Embedded Script',
    human: 'Human Assisted',
    webhook: 'Webhook Origin',
  }
  return map[source] ?? source
}

export const randomId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`
