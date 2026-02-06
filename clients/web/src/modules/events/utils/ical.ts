import { AppEvent } from '../types'
import { format } from 'date-fns'

/**
 * Generate iCal (ICS) format string from an event
 */
export function generateICalEvent(event: AppEvent): string {
  const formatICalDate = (unixSeconds: number): string => {
    const date = new Date(unixSeconds * 1000)
    return format(date, "yyyyMMdd'T'HHmmss")
  }

  const escapeText = (text: string): string => {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Social Action Network//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@buildit.network`,
    `DTSTAMP:${formatICalDate(Math.floor(Date.now() / 1000))}`,
    `DTSTART:${formatICalDate(event.startAt)}`,
  ]

  if (event.endAt) {
    lines.push(`DTEND:${formatICalDate(event.endAt)}`)
  }

  lines.push(
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description ?? '')}`
  )

  // Include location if available
  const locationStr = event.location?.name ?? event.location?.address
  if (locationStr) {
    lines.push(`LOCATION:${escapeText(locationStr)}`)
  }

  // Add categories from tags
  const tags = event.tags ?? []
  if (tags.length > 0) {
    lines.push(`CATEGORIES:${tags.map(escapeText).join(',')}`)
  }

  // Add organizer
  lines.push(
    `ORGANIZER:npub:${event.createdBy}`,
    `STATUS:CONFIRMED`,
    `SEQUENCE:0`,
    'END:VEVENT',
    'END:VCALENDAR'
  )

  return lines.join('\r\n')
}

/**
 * Download an event as an ICS file
 */
export function downloadEventAsICS(event: AppEvent): void {
  const icalString = generateICalEvent(event)
  const blob = new Blob([icalString], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Generate ICS file for multiple events
 */
export function generateICalCalendar(events: AppEvent[]): string {
  const formatICalDate = (unixSeconds: number): string => {
    const date = new Date(unixSeconds * 1000)
    return format(date, "yyyyMMdd'T'HHmmss")
  }

  const escapeText = (text: string): string => {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Social Action Network//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Social Action Network Events',
    'X-WR-TIMEZONE:UTC',
  ]

  events.forEach((event) => {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@buildit.network`,
      `DTSTAMP:${formatICalDate(Math.floor(Date.now() / 1000))}`,
      `DTSTART:${formatICalDate(event.startAt)}`
    )

    if (event.endAt) {
      lines.push(`DTEND:${formatICalDate(event.endAt)}`)
    }

    lines.push(
      `SUMMARY:${escapeText(event.title)}`,
      `DESCRIPTION:${escapeText(event.description ?? '')}`
    )

    const locationStr = event.location?.name ?? event.location?.address
    if (locationStr) {
      lines.push(`LOCATION:${escapeText(locationStr)}`)
    }

    const tags = event.tags ?? []
    if (tags.length > 0) {
      lines.push(`CATEGORIES:${tags.map(escapeText).join(',')}`)
    }

    lines.push(
      `ORGANIZER:npub:${event.createdBy}`,
      `STATUS:CONFIRMED`,
      `SEQUENCE:0`,
      'END:VEVENT'
    )
  })

  lines.push('END:VCALENDAR')

  return lines.join('\r\n')
}

/**
 * Download multiple events as an ICS file
 */
export function downloadCalendarAsICS(events: AppEvent[], filename = 'calendar.ics'): void {
  const icalString = generateICalCalendar(events)
  const blob = new Blob([icalString], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
