/**
 * Update Available Banner Component
 *
 * Shows a dismissible banner when content from newer schema versions is detected.
 * Informs users that an update may provide additional features.
 */

import * as React from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ArrowUpCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UpdateAvailableBannerProps {
  /** Number of items with unknown fields */
  itemCount: number
  /** Module name for display */
  moduleName: string
  /** Callback when user dismisses the banner */
  onDismiss?: () => void
  /** Callback when user wants to check for updates */
  onCheckUpdate?: () => void
  /** Additional class names */
  className?: string
}

export function UpdateAvailableBanner({
  itemCount,
  moduleName,
  onDismiss,
  onCheckUpdate,
  className
}: UpdateAvailableBannerProps) {
  const [dismissed, setDismissed] = React.useState(false)

  if (dismissed) {
    return null
  }

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  return (
    <Alert className={cn('relative', className)}>
      <ArrowUpCircle className="h-4 w-4" />
      <AlertTitle>Update Available</AlertTitle>
      <AlertDescription className="pr-8">
        <p>
          {itemCount} {moduleName} {itemCount === 1 ? 'item' : 'items'} contain
          features from a newer version. Update your app to see all content.
        </p>
        {onCheckUpdate && (
          <Button
            variant="link"
            size="sm"
            onClick={onCheckUpdate}
            className="px-0 h-auto mt-1"
          >
            Check for updates
          </Button>
        )}
      </AlertDescription>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Dismiss</span>
      </Button>
    </Alert>
  )
}

/**
 * Hook to track and display update notifications
 */
export function useUpdateNotification(_moduleId: string) {
  const [partialItems, setPartialItems] = React.useState<Set<string>>(new Set())
  const [dismissed, setDismissed] = React.useState(false)

  const addPartialItem = React.useCallback((itemId: string) => {
    setPartialItems(prev => new Set([...prev, itemId]))
  }, [])

  const removePartialItem = React.useCallback((itemId: string) => {
    setPartialItems(prev => {
      const next = new Set(prev)
      next.delete(itemId)
      return next
    })
  }, [])

  const dismiss = React.useCallback(() => {
    setDismissed(true)
  }, [])

  const reset = React.useCallback(() => {
    setPartialItems(new Set())
    setDismissed(false)
  }, [])

  return {
    /** Number of items with partial compatibility */
    partialCount: partialItems.size,
    /** Whether banner should be shown */
    showBanner: !dismissed && partialItems.size > 0,
    /** Add an item that has unknown fields */
    addPartialItem,
    /** Remove an item (if it gets updated/deleted) */
    removePartialItem,
    /** Dismiss the notification */
    dismiss,
    /** Reset all state */
    reset
  }
}
