import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EventWithRSVPs } from '../types'
import { Calendar, MapPin, Users, Clock, Globe, Lock, Info, Pencil } from 'lucide-react'
import { format } from 'date-fns'
import { RSVPButton } from './RSVPButton'
import { AttendeeList } from './AttendeeList'
import { EditEventDialog } from './EditEventDialog'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/authStore'

interface EventDetailProps {
  event: EventWithRSVPs | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRSVPChange?: () => void
}

export const EventDetail: FC<EventDetailProps> = ({
  event,
  open,
  onOpenChange,
  onRSVPChange,
}) => {
  const { t } = useTranslation()
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const { currentIdentity } = useAuthStore()
  const isCreator = currentIdentity?.publicKey === event?.createdBy

  if (!event) return null

  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp), 'PPPp')
  }


  const getPrivacyInfo = () => {
    const icons = {
      public: <Globe className="h-4 w-4" />,
      group: <Lock className="h-4 w-4" />,
      private: <Lock className="h-4 w-4" />,
    }

    const labels = {
      public: t('eventDetail.privacy.public'),
      group: t('eventDetail.privacy.group'),
      private: t('eventDetail.privacy.private'),
    }

    return (
      <Badge variant={event.privacy === 'public' ? 'default' : 'secondary'}>
        <span className="flex items-center gap-1">
          {icons[event.privacy]}
          {labels[event.privacy]}
        </span>
      </Badge>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-2xl">{event.title}</DialogTitle>
            {getPrivacyInfo()}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* RSVP Section */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-muted-foreground">
                <div className="font-medium text-foreground mb-1">{t('eventDetail.rsvpStatus')}</div>
                <div className="flex gap-4">
                  <span>{t('eventDetail.rsvpCounts.going', { count: event.rsvpCounts.going })}</span>
                  <span>{t('eventDetail.rsvpCounts.maybe', { count: event.rsvpCounts.maybe })}</span>
                  <span>{t('eventDetail.rsvpCounts.notGoing', { count: event.rsvpCounts.notGoing })}</span>
                </div>
              </div>
              {event.capacity && (
                <div className="text-sm text-muted-foreground">
                  <Users className="h-4 w-4 inline mr-1" />
                  {t('eventDetail.capacity', { current: event.rsvpCounts.going, max: event.capacity })}
                </div>
              )}
            </div>
            <RSVPButton
              eventId={event.id}
              currentStatus={event.userRSVP}
              onRSVPChange={onRSVPChange}
            />
          </div>

          {/* Tabs for Details and Attendees */}
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details" className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                {t('eventDetail.tabs.details')}
              </TabsTrigger>
              <TabsTrigger value="attendees" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {t('eventDetail.tabs.attendees')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6 pt-4">
              {/* Description */}
              {event.description && (
                <div>
                  <h3 className="font-medium mb-2">{t('eventDetail.description')}</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{event.description}</p>
                </div>
              )}

              {/* Event Details */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="font-medium">{t('eventDetail.startTime')}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(event.startTime)}
                      </div>
                    </div>
                  </div>

                  {event.endTime && (
                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="font-medium">{t('eventDetail.endTime')}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(event.endTime)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {event.location && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="font-medium">{t('eventDetail.location')}</div>
                        <div className="text-sm text-muted-foreground">{event.location}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tags */}
              {event.tags.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">{t('eventDetail.tags')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {event.tags.map((tag, index) => (
                      <Badge key={index} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Image */}
              {event.imageUrl && (
                <div>
                  <img
                    src={event.imageUrl}
                    alt={event.title}
                    className="w-full rounded-lg object-cover max-h-96"
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="attendees" className="pt-4">
              <AttendeeList
                eventId={event.id}
                creatorPubkey={event.createdBy}
                showNotes={isCreator}
              />
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('eventDetail.actions.close')}
            </Button>
            {isCreator && (
              <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                {t('eventDetail.actions.edit')}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Edit Event Dialog */}
      {event && (
        <EditEventDialog
          event={event}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onEventUpdated={() => {
            setEditDialogOpen(false)
            onRSVPChange?.() // Refresh the event data
          }}
        />
      )}
    </Dialog>
  )
}
