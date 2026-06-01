const EMPTY_VALUE = '-'

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return EMPTY_VALUE
  }

  const datePart = value.split('T')[0]
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart)

  if (!match) {
    return value
  }

  return `${match[3]}/${match[2]}/${match[1]}`
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return EMPTY_VALUE
  }

  const [datePart, timePart = ''] = value.split('T')
  const date = formatDate(datePart)
  const time = formatHourMinute(timePart)

  return time === EMPTY_VALUE ? date : `${date} ${time}`
}

export function formatHourMinute(value: string | null | undefined) {
  if (!value) {
    return EMPTY_VALUE
  }

  const match = /^(\d{2}):(\d{2})/.exec(value)
  return match ? `${match[1]}:${match[2]}` : value
}

export function formatMinutes(minutos: number) {
  const sign = minutos < 0 ? '-' : ''
  const absolute = Math.abs(minutos)
  const horas = Math.floor(absolute / 60)
  const resto = absolute % 60
  return `${sign}${horas}:${String(resto).padStart(2, '0')} hs`
}
