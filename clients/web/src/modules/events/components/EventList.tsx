import { FC, useState } from 'react'
import { EventCard } from './EventCard'
import { EventDetail } from './EventDetail'
import { useEvents } from '../hooks/useEvents'

interface EventListProps {
  groupId?: string
  showUpcomingOnly?: boolean
}

export const EventList: FC<EventListProps> = ({ groupId, showUpcomingOnly = false }) => {
  const { events, upcomingEvents, getEventWithRSVPs } = useEvents(groupId)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const displayEvents = showUpcomingOnly ? upcomingEvents : events
  const selectedEventWithRSVPs = selectedEventId
    ? getEventWithRSVPs(selectedEventId) || null
    : null

  if (displayEvents.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {showUpcomingOnly ? 'No upcoming events' : 'No events yet'}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {displayEvents.map((event, i) => (
          <EventCard
            key={event.id + i}
            event={event}
            onClick={() => setSelectedEventId(event.id)}
          />
        ))}
      </div>

      <EventDetail
        event={selectedEventWithRSVPs}
        open={!!selectedEventId}
        onOpenChange={(open) => !open && setSelectedEventId(null)}
        onRSVPChange={() => {
          // Refresh event data
          if (selectedEventId) {
            // This will cause a re-render with updated RSVP counts
            setSelectedEventId(null)
            setTimeout(() => setSelectedEventId(selectedEventId), 0)
          }
        }}
      />
    </>
  )
}
