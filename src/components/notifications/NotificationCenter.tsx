import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react'
import { useNotificationStore } from '@/stores/notificationStore'
import type { Notification } from '@/types/notification'

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    requestBrowserPermission,
    browserPermission,
  } = useNotificationStore()

  const handleRequestPermission = async () => {
    await requestBrowserPermission()
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(true)}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Notifications</DialogTitle>
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  disabled={unreadCount === 0}
                >
                  <CheckCheck className="w-4 h-4 mr-2" />
                  Mark all read
                </Button>
              )}
            </div>
          </DialogHeader>

          {browserPermission !== 'granted' && (
            <Card className="p-4 mb-4 bg-accent">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Enable browser notifications</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Get notified even when the app is in the background
                  </p>
                </div>
                <Button size="sm" onClick={handleRequestPermission}>
                  Enable
                </Button>
              </div>
            </Card>
          )}

          <div className="space-y-2 overflow-y-auto max-h-[calc(80vh-200px)]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={() => markAsRead(notification.id)}
                  onRemove={() => removeNotification(notification.id)}
                />
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface NotificationItemProps {
  notification: Notification
  onMarkRead: () => void
  onRemove: () => void
}

function NotificationItem({ notification, onMarkRead, onRemove }: NotificationItemProps) {
  const timeAgo = getTimeAgo(notification.timestamp)

  return (
    <Card
      className={`p-4 ${!notification.read ? 'bg-accent border-primary' : ''}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h4 className="font-medium text-sm mb-1">{notification.title}</h4>
          <p className="text-sm text-muted-foreground mb-2">{notification.message}</p>
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>
        <div className="flex items-center gap-2">
          {!notification.read && (
            <Button variant="ghost" size="sm" onClick={onMarkRead}>
              <Check className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(timestamp).toLocaleDateString()
}
