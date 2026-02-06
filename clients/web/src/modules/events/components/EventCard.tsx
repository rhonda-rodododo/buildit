import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AppEvent } from '../types'
import { Calendar, MapPin, Users, Lock, Globe } from 'lucide-react'
import { format } from 'date-fns'

interface EventCardProps {
  event: AppEvent
  onClick?: () => void
}

export const EventCard: FC<EventCardProps> = ({ event, onClick }) => {
  const { t } = useTranslation()

  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp * 1000), 'PPp')
  }

  const getPrivacyIcon = () => {
    switch (event.visibility) {
      case 'public':
        return <Globe className="h-3 w-3" />
      case 'group':
      case 'private':
        return <Lock className="h-3 w-3" />
    }
  }

  const getPrivacyLabel = () => {
    switch (event.visibility) {
      case 'public':
        return t('eventCard.privacyLabels.public')
      case 'group':
        return t('eventCard.privacyLabels.group')
      case 'private':
        return t('eventCard.privacyLabels.private')
    }
  }

  const locationName = event.location?.name ?? event.location?.address

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
          <Badge variant={event.visibility === 'public' ? 'default' : 'secondary'} className="ml-2">
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
          {formatDate(event.startAt)}
        </div>

        {locationName && (
          <div className="flex items-center text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 mr-2" />
            {locationName}
          </div>
        )}

        {event.maxAttendees && (
          <div className="flex items-center text-sm text-muted-foreground">
            <Users className="h-4 w-4 mr-2" />
            {t('eventCard.maxAttendees', { count: event.maxAttendees })}
          </div>
        )}

        {(event.tags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {(event.tags ?? []).map((tag, index) => (
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
