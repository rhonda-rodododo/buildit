/**
 * Push Notification Service
 *
 * Handles push notification registration and delivery using Expo Notifications.
 * Notifications are sent for new messages, group invites, and other events.
 */

import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'

export interface NotificationData {
  type: 'message' | 'group_invite' | 'mention' | 'system'
  title: string
  body: string
  data?: Record<string, unknown>
}

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

/**
 * Request permission for push notifications
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false
  }

  if (!Device.isDevice) {
    console.log('Push notifications only work on physical devices')
    return false
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  return finalStatus === 'granted'
}

/**
 * Get the Expo push token for this device
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null
  }

  if (!Device.isDevice) {
    return null
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId
    if (!projectId) {
      console.warn('No EAS project ID configured for push notifications')
      return null
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    })

    return token.data
  } catch (error) {
    console.error('Failed to get push token:', error)
    return null
  }
}

/**
 * Schedule a local notification
 */
export async function scheduleLocalNotification(
  notification: NotificationData,
  trigger?: Notifications.NotificationTriggerInput
): Promise<string> {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title: notification.title,
      body: notification.body,
      data: {
        type: notification.type,
        ...notification.data,
      },
    },
    trigger: trigger || null, // null = immediate
  })
}

/**
 * Cancel a scheduled notification
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId)
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync()
}

/**
 * Set the app badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  if (Platform.OS === 'web') return
  await Notifications.setBadgeCountAsync(count)
}

/**
 * Clear the app badge
 */
export async function clearBadge(): Promise<void> {
  await setBadgeCount(0)
}

/**
 * Add a listener for received notifications (while app is foregrounded)
 */
export function addNotificationReceivedListener(
  listener: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(listener)
}

/**
 * Add a listener for notification responses (when user taps notification)
 */
export function addNotificationResponseListener(
  listener: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(listener)
}

/**
 * Get the notification that launched the app (if any)
 */
export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  return await Notifications.getLastNotificationResponseAsync()
}

/**
 * Configure Android notification channel (required for Android 8+)
 */
export async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0a0a0a',
  })

  await Notifications.setNotificationChannelAsync('messages', {
    name: 'Messages',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0a0a0a',
    description: 'Notifications for new messages',
  })

  await Notifications.setNotificationChannelAsync('groups', {
    name: 'Groups',
    importance: Notifications.AndroidImportance.DEFAULT,
    description: 'Notifications for group activity and invites',
  })
}

/**
 * Initialize push notifications
 * Call this on app startup
 */
export async function initializeNotifications(): Promise<{
  hasPermission: boolean
  token: string | null
}> {
  // Set up Android channels
  await setupAndroidChannel()

  // Request permission
  const hasPermission = await requestNotificationPermission()

  // Get push token
  let token: string | null = null
  if (hasPermission) {
    token = await getExpoPushToken()
  }

  return { hasPermission, token }
}
