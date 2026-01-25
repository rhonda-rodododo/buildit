import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Event } from '../types'
import { Calendar, MapPin, Users, Lock, Globe } from 'lucide-react'
import { format } from 'date-fns'

interface EventCardProps {
  event: Event
  onClick?: () => void
}

export const EventCard: FC<EventCardProps> = ({ event, onClick }) => {
  const { t } = useTranslation()

  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp), 'PPp')
  }

  const getPrivacyIcon = () => {
    switch (event.privacy) {
      case 'public':
        return <Globe className="h-3 w-3" />
      case 'group':
      case 'private':
      case 'direct-action':
        return <Lock className="h-3 w-3" />
    }
  }

  const getPrivacyLabel = () => {
    switch (event.privacy) {
      case 'public':
        return t('eventCard.privacyLabels.public')
      case 'group':
        return t('eventCard.privacyLabels.group')
      case 'private':
        return t('eventCard.privacyLabels.private')
      case 'direct-action':
        return t('eventCard.privacyLabels.directAction')
    }
  }

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="line-clamp-2">{event.title}</CardTitle>
            <CardDescription className="line-clamp-2 mt-1">
              {event.description}
            </CardDescription>
          </div>
          <Badge variant={event.privacy === 'public' ? 'default' : 'secondary'} className="ml-2">
            <span className="flex items-center gap-1">
              {getPrivacyIcon()}
              {getPrivacyLabel()}
            </span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 mr-2" />
          {formatDate(event.startTime)}
        </div>

        {event.location && event.privacy !== 'direct-action' && (
          <div className="flex items-center text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 mr-2" />
            {event.location}
          </div>
        )}

        {event.privacy === 'direct-action' && event.locationRevealTime && (
          <div className="flex items-center text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 mr-2" />
            {t('eventCard.locationReveals', { date: formatDate(event.locationRevealTime) })}
          </div>
        )}

        {event.capacity && (
          <div className="flex items-center text-sm text-muted-foreground">
            <Users className="h-4 w-4 mr-2" />
            {t('eventCard.maxAttendees', { count: event.capacity })}
          </div>
        )}

        {event.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {event.tags.map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
