export function toNumberOrNull(value: string) {
  const normalized = value.trim()
  if (!normalized) {
    return null
  }

  const converted = Number(normalized)
  return Number.isNaN(converted) ? null : converted
}

export function formatCurrency(value: number | null) {
  if (value == null) {
    return '-'
  }

  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function formatDate(value: string | null) {
  if (!value) {
    return '-'
  }

  return new Date(value).toLocaleDateString('pt-BR')
}

export function categoryInitials(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}