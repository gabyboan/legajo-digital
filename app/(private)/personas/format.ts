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
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return `${horas}:${String(resto).padStart(2, '0')} hs`
}
