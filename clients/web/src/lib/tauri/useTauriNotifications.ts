/**
 * Tauri Notifications hook
 * Provides unified interface for native notifications with browser fallback
 */

import { useCallback, useState, useEffect } from 'react';
import { useTauri } from './useTauri';
import { TAURI_STORAGE_KEYS } from './constants';
import type { NotificationOptions, NotificationPermission } from './types';

/**
 * Check if browser Notification API is available
 */
function hasBrowserNotifications(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Hook for native notifications
 * Uses Tauri notifications in desktop app, falls back to browser Notification API
 *
 * @example
 * ```tsx
 * function NotificationButton() {
 *   const { sendNotification, requestPermission, permission } = useTauriNotifications();
 *
 *   const handleClick = async () => {
 *     if (permission !== 'granted') {
 *       await requestPermission();
 *     }
 *     await sendNotification({
 *       title: 'New Message',
 *       body: 'You have a new message from Alice',
 *     });
 *   };
 *
 *   return <button onClick={handleClick}>Send Notification</button>;
 * }
 * ```
 */
export function useTauriNotifications() {
  const { isTauri, capabilities } = useTauri();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(true);

  // Check initial permission state
  useEffect(() => {
    const checkPermission = async () => {
      setIsLoading(true);

      try {
        if (isTauri && capabilities.notification) {
          const { isPermissionGranted } = await import('@tauri-apps/plugin-notification');
          const granted = await isPermissionGranted();
          setPermission(granted ? 'granted' : 'default');
        } else if (hasBrowserNotifications()) {
          setPermission(Notification.permission as NotificationPermission);
        }
      } catch {
        setPermission('default');
      }

      setIsLoading(false);
    };

    checkPermission();
  }, [isTauri, capabilities.notification]);

  /**
   * Request notification permission
   */
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    try {
      if (isTauri && capabilities.notification) {
        const { requestPermission: tauriRequestPermission, isPermissionGranted } = await import(
          '@tauri-apps/plugin-notification'
        );

        // Check if already granted
        if (await isPermissionGranted()) {
          setPermission('granted');
          return 'granted';
        }

        // Request permission
        const result = await tauriRequestPermission();
        const granted = result === 'granted';
        const newPermission: NotificationPermission = granted ? 'granted' : 'denied';
        setPermission(newPermission);
        localStorage.setItem(TAURI_STORAGE_KEYS.NOTIFICATION_PERMISSION, newPermission);
        return newPermission;
      } else if (hasBrowserNotifications()) {
        const result = await Notification.requestPermission();
        const newPermission = result as NotificationPermission;
        setPermission(newPermission);
        return newPermission;
      }
    } catch {
      // Ignore errors
    }

    return 'denied';
  }, [isTauri, capabilities.notification]);

  /**
   * Send a notification
   */
  const sendNotification = useCallback(
    async (options: NotificationOptions): Promise<boolean> => {
      // Check permission first
      if (permission !== 'granted') {
        const newPermission = await requestPermission();
        if (newPermission !== 'granted') {
          return false;
        }
      }

      try {
        if (isTauri && capabilities.notification) {
          const { sendNotification: tauriSendNotification } = await import(
            '@tauri-apps/plugin-notification'
          );

          await tauriSendNotification({
            title: options.title,
            body: options.body,
            icon: options.icon,
          });

          return true;
        } else if (hasBrowserNotifications()) {
          new Notification(options.title, {
            body: options.body,
            icon: options.icon,
          });
          return true;
        }
      } catch {
        // Ignore errors
      }

      return false;
    },
    [isTauri, capabilities.notification, permission, requestPermission]
  );

  /**
   * Send a message notification
   * Convenience method for common message notification pattern
   */
  const notifyMessage = useCallback(
    async (sender: string, message: string, avatar?: string) => {
      return sendNotification({
        title: sender,
        body: message.length > 100 ? `${message.slice(0, 97)}...` : message,
        icon: avatar,
      });
    },
    [sendNotification]
  );

  /**
   * Send an event reminder notification
   */
  const notifyEventReminder = useCallback(
    async (eventTitle: string, timeUntil: string) => {
      return sendNotification({
        title: 'Event Reminder',
        body: `${eventTitle} starts ${timeUntil}`,
      });
    },
    [sendNotification]
  );

  /**
   * Send a group activity notification
   */
  const notifyGroupActivity = useCallback(
    async (groupName: string, activity: string) => {
      return sendNotification({
        title: groupName,
        body: activity,
      });
    },
    [sendNotification]
  );

  return {
    /** Current permission state */
    permission,
    /** Whether permission check is in progress */
    isLoading,
    /** Request notification permission */
    requestPermission,
    /** Send a notification */
    sendNotification,
    /** Send a message notification */
    notifyMessage,
    /** Send an event reminder */
    notifyEventReminder,
    /** Send a group activity notification */
    notifyGroupActivity,
    /** Whether notifications are available */
    isAvailable: capabilities.notification || hasBrowserNotifications(),
  };
}

export default useTauriNotifications;
