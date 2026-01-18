import { FC } from 'react'
import { CreateEventDialog } from './CreateEventDialog'
import { EventList } from './EventList'
import { CalendarView } from './CalendarView'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEvents } from '../hooks/useEvents'
import { List, CalendarDays, Clock } from 'lucide-react'

interface EventsViewProps {
  groupId?: string
}

export const EventsView: FC<EventsViewProps> = ({ groupId }) => {
  const { syncEvents } = useEvents(groupId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Events</h2>
          <p className="text-muted-foreground">
            {groupId ? 'Group events and gatherings' : 'Public events and gatherings'}
          </p>
        </div>
        <CreateEventDialog groupId={groupId} onEventCreated={syncEvents} />
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList>
          <TabsTrigger value="upcoming" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Upcoming</span>
          </TabsTrigger>
          <TabsTrigger value="all" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">All Events</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">Calendar</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-6">
          <EventList groupId={groupId} showUpcomingOnly />
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          <EventList groupId={groupId} />
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <CalendarView groupId={groupId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
