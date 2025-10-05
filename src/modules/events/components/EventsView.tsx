import { FC } from 'react'
import { CreateEventDialog } from './CreateEventDialog'
import { EventList } from './EventList'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEvents } from '../hooks/useEvents'

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
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="all">All Events</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-6">
          <EventList groupId={groupId} showUpcomingOnly />
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          <EventList groupId={groupId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
