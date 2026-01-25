import { create } from 'zustand'
import type { Notification } from '@/types/notification'

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  browserPermission: NotificationPermission

  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  removeNotification: (id: string) => void
  clearAll: () => void
  requestBrowserPermission: () => Promise<NotificationPermission>
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  browserPermission: 'default',

  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      read: false,
    }

    set((state) => ({
      notifications: [newNotification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }))

    // Show browser notification if permission granted
    if (get().browserPermission === 'granted') {
      new window.Notification(notification.title, {
        body: notification.message,
        icon: '/icon.png',
        tag: newNotification.id,
      })
    }
  },

  markAsRead: (id) =>
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id)
      if (!notification || notification.read) return state

      return {
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }
    }),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  removeNotification: (id) =>
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id)
      return {
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: notification && !notification.read
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
      }
    }),

  clearAll: () =>
    set({
      notifications: [],
      unreadCount: 0,
    }),

  requestBrowserPermission: async () => {
    if (!('Notification' in window)) {
      return 'denied'
    }

    const permission = await window.Notification.requestPermission()
    set({ browserPermission: permission })
    return permission
  },
}))
