import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useEvents } from '../hooks/useEvents'
import { Event } from '../types'
import { Download } from 'lucide-react'
import { downloadCalendarAsICS, downloadEventAsICS } from '../utils/ical'
import { format, isSameDay } from 'date-fns'

interface CalendarViewProps {
  groupId?: string
}

export const CalendarView: FC<CalendarViewProps> = ({ groupId }) => {
  const { t } = useTranslation()
  const { events } = useEvents(groupId)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  // Get events for selected date
  const eventsOnSelectedDate = events.filter((event) =>
    isSameDay(new Date(event.startTime), selectedDate)
  )

  // Get dates that have events
  const datesWithEvents = events.map((event) => new Date(event.startTime))

  const handleDownloadAll = () => {
    downloadCalendarAsICS(
      events,
      groupId ? `group-${groupId}-events.ics` : 'social-action-events.ics'
    )
  }

  const handleDownloadEvent = (event: Event) => {
    downloadEventAsICS(event)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('eventsCalendarView.title')}</CardTitle>
          <Button size="sm" variant="outline" onClick={handleDownloadAll}>
            <Download className="h-4 w-4 mr-2" />
            {t('eventsCalendarView.exportAll')}
          </Button>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            modifiers={{
              hasEvent: datesWithEvents,
            }}
            modifiersStyles={{
              hasEvent: {
                fontWeight: 'bold',
                textDecoration: 'underline',
              },
            }}
            className="rounded-md border"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {t('eventsCalendarView.eventsOn', { date: format(selectedDate, 'MMMM d, yyyy') })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {eventsOnSelectedDate.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t('eventsCalendarView.noEvents')}
            </p>
          ) : (
            <div className="space-y-4">
              {eventsOnSelectedDate.map((event) => (
                <Card key={event.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold">{event.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {format(new Date(event.startTime), 'p')}
                          {event.endTime &&
                            ` - ${format(new Date(event.endTime), 'p')}`}
                        </p>
                        {event.location && (
                          <p className="text-sm text-muted-foreground mt-1">
                            📍 {event.location}
                          </p>
                        )}
                        {event.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {event.tags.map((tag: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownloadEvent(event)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
