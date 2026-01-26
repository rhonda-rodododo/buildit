import { Event } from '../types'
import { format } from 'date-fns'

/**
 * Generate iCal (ICS) format string from an event
 */
export function generateICalEvent(event: Event): string {
  const formatICalDate = (timestamp: number): string => {
    const date = new Date(timestamp)
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
    `DTSTAMP:${formatICalDate(Date.now())}`,
    `DTSTART:${formatICalDate(event.startTime)}`,
  ]

  if (event.endTime) {
    lines.push(`DTEND:${formatICalDate(event.endTime)}`)
  }

  lines.push(
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`
  )

  // Include location if available
  if (event.location) {
    lines.push(`LOCATION:${escapeText(event.location)}`)
  }

  // Add categories from tags
  if (event.tags.length > 0) {
    lines.push(`CATEGORIES:${event.tags.map(escapeText).join(',')}`)
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
export function downloadEventAsICS(event: Event): void {
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
export function generateICalCalendar(events: Event[]): string {
  const formatICalDate = (timestamp: number): string => {
    const date = new Date(timestamp)
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
      `DTSTAMP:${formatICalDate(Date.now())}`,
      `DTSTART:${formatICalDate(event.startTime)}`
    )

    if (event.endTime) {
      lines.push(`DTEND:${formatICalDate(event.endTime)}`)
    }

    lines.push(
      `SUMMARY:${escapeText(event.title)}`,
      `DESCRIPTION:${escapeText(event.description)}`
    )

    if (event.location) {
      lines.push(`LOCATION:${escapeText(event.location)}`)
    }

    if (event.tags.length > 0) {
      lines.push(`CATEGORIES:${event.tags.map(escapeText).join(',')}`)
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
export function downloadCalendarAsICS(events: Event[], filename = 'calendar.ics'): void {
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
