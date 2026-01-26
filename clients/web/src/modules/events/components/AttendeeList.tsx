import { FC } from 'react'
import { useEventsStore } from '../eventsStore'
import { RSVPStatus } from '../types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { UserHandle } from '@/components/user/UserHandle'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown, Check, HelpCircle, X } from 'lucide-react'

interface AttendeeListProps {
  eventId: string
  creatorPubkey: string
  showNotes?: boolean
}

interface AttendeeGroup {
  status: RSVPStatus
  label: string
  icon: React.ReactNode
  variant: 'default' | 'secondary' | 'outline'
  attendees: Array<{
    pubkey: string
    note?: string
    timestamp: number
  }>
}

export const AttendeeList: FC<AttendeeListProps> = ({
  eventId,
  creatorPubkey,
  showNotes = false,
}) => {
  const { getRSVPsForEvent } = useEventsStore()
  const rsvps = getRSVPsForEvent(eventId)

  // Group RSVPs by status
  const groups: AttendeeGroup[] = [
    {
      status: 'going',
      label: 'Going',
      icon: <Check className="h-3.5 w-3.5" />,
      variant: 'default',
      attendees: rsvps
        .filter((r) => r.status === 'going')
        .map((r) => ({
          pubkey: r.userPubkey,
          note: r.note,
          timestamp: r.timestamp,
        })),
    },
    {
      status: 'maybe',
      label: 'Maybe',
      icon: <HelpCircle className="h-3.5 w-3.5" />,
      variant: 'secondary',
      attendees: rsvps
        .filter((r) => r.status === 'maybe')
        .map((r) => ({
          pubkey: r.userPubkey,
          note: r.note,
          timestamp: r.timestamp,
        })),
    },
    {
      status: 'not_going',
      label: 'Not Going',
      icon: <X className="h-3.5 w-3.5" />,
      variant: 'outline',
      attendees: rsvps
        .filter((r) => r.status === 'not_going')
        .map((r) => ({
          pubkey: r.userPubkey,
          note: r.note,
          timestamp: r.timestamp,
        })),
    },
  ]

  // Only show groups with attendees
  const activeGroups = groups.filter((g) => g.attendees.length > 0)

  if (activeGroups.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        No RSVPs yet. Be the first to respond!
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {activeGroups.map((group) => (
        <Collapsible key={group.status} defaultOpen={group.status === 'going'}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted/50 rounded-md transition-colors">
            <div className="flex items-center gap-2">
              <Badge variant={group.variant} className="gap-1">
                {group.icon}
                {group.label}
              </Badge>
              <span className="text-sm text-muted-foreground">
                ({group.attendees.length})
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
          </CollapsibleTrigger>

          <CollapsibleContent className="pt-2">
            <div className="space-y-2 pl-2">
              {group.attendees.map((attendee) => (
                <div
                  key={attendee.pubkey}
                  className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/30 transition-colors"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${attendee.pubkey}`}
                    />
                    <AvatarFallback>
                      {attendee.pubkey.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <UserHandle
                        pubkey={attendee.pubkey}
                        format="display-name"
                        className="text-sm font-medium"
                      />
                      {attendee.pubkey === creatorPubkey && (
                        <Badge variant="outline" className="text-xs">
                          Host
                        </Badge>
                      )}
                    </div>
                    {showNotes && attendee.note && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {attendee.note}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  )
}
