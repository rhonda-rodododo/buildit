import { FC, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useEvents } from '../hooks/useEvents'
import { RSVPStatus } from '../types'
import { Check, X, HelpCircle } from 'lucide-react'

interface RSVPButtonProps {
  eventId: string
  currentStatus?: RSVPStatus
  onRSVPChange?: () => void
}

export const RSVPButton: FC<RSVPButtonProps> = ({ eventId, currentStatus, onRSVPChange }) => {
  const { rsvpToEvent } = useEvents()
  const [loading, setLoading] = useState(false)

  const handleRSVP = async (status: RSVPStatus) => {
    if (currentStatus === status) return

    setLoading(true)
    try {
      await rsvpToEvent(eventId, status)
      onRSVPChange?.()
    } catch (error) {
      console.error('Failed to RSVP:', error)
      alert('Failed to update RSVP')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        variant={currentStatus === 'going' ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleRSVP('going')}
        disabled={loading}
      >
        <Check className="h-4 w-4 mr-1" />
        Going
      </Button>
      <Button
        variant={currentStatus === 'maybe' ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleRSVP('maybe')}
        disabled={loading}
      >
        <HelpCircle className="h-4 w-4 mr-1" />
        Maybe
      </Button>
      <Button
        variant={currentStatus === 'not-going' ? 'destructive' : 'outline'}
        size="sm"
        onClick={() => handleRSVP('not-going')}
        disabled={loading}
      >
        <X className="h-4 w-4 mr-1" />
        Not Going
      </Button>
    </div>
  )
}
