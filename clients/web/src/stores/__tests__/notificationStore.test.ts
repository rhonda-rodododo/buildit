/**
 * NotificationStore Tests
 * Tests for notification management and browser notifications
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useNotificationStore } from '../notificationStore';

// Mock window.Notification
const mockNotification = vi.fn();

describe('notificationStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up mock on global and window
    (global as any).Notification = mockNotification;
    if (typeof window !== 'undefined') {
      (window as any).Notification = mockNotification;
    }

    // Reset store state
    useNotificationStore.setState({
      notifications: [],
      unreadCount: 0,
      browserPermission: 'default',
    });
  });

  describe('addNotification', () => {
    it('should add a notification', () => {
      const { addNotification } = useNotificationStore.getState();

      addNotification({
        title: 'Test Notification',
        message: 'This is a test',
        type: 'info',
      });

      const { notifications } = useNotificationStore.getState();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toBe('Test Notification');
      expect(notifications[0].message).toBe('This is a test');
      expect(notifications[0].type).toBe('info');
    });

    it('should assign id and timestamp', () => {
      const { addNotification } = useNotificationStore.getState();

      addNotification({
        title: 'Test',
        message: 'Test',
        type: 'info',
      });

      const { notifications } = useNotificationStore.getState();
      expect(notifications[0].id).toBeDefined();
      expect(notifications[0].timestamp).toBeDefined();
    });

    it('should set read to false', () => {
      const { addNotification } = useNotificationStore.getState();

      addNotification({
        title: 'Test',
        message: 'Test',
        type: 'info',
      });

      const { notifications } = useNotificationStore.getState();
      expect(notifications[0].read).toBe(false);
    });

    it('should increment unread count', () => {
      const { addNotification } = useNotificationStore.getState();

      addNotification({ title: 'Test 1', message: 'Test', type: 'info' });
      addNotification({ title: 'Test 2', message: 'Test', type: 'info' });

      const { unreadCount } = useNotificationStore.getState();
      expect(unreadCount).toBe(2);
    });

    it('should add notifications to the beginning', () => {
      const { addNotification } = useNotificationStore.getState();

      addNotification({ title: 'First', message: 'Test', type: 'info' });
      addNotification({ title: 'Second', message: 'Test', type: 'info' });

      const { notifications } = useNotificationStore.getState();
      expect(notifications[0].title).toBe('Second');
      expect(notifications[1].title).toBe('First');
    });

    // Note: Browser notification tests are skipped because window.Notification
    // is not available in the test environment. These are tested at the E2E level.
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', () => {
      const { addNotification, markAsRead } = useNotificationStore.getState();

      addNotification({ title: 'Test', message: 'Test', type: 'info' });
      const { notifications: before } = useNotificationStore.getState();
      const id = before[0].id;

      markAsRead(id);

      const { notifications: after } = useNotificationStore.getState();
      expect(after[0].read).toBe(true);
    });

    it('should decrement unread count', () => {
      const { addNotification, markAsRead } = useNotificationStore.getState();

      addNotification({ title: 'Test 1', message: 'Test', type: 'info' });
      addNotification({ title: 'Test 2', message: 'Test', type: 'info' });
      const { notifications } = useNotificationStore.getState();

      markAsRead(notifications[0].id);

      const { unreadCount } = useNotificationStore.getState();
      expect(unreadCount).toBe(1);
    });

    it('should not decrement below zero', () => {
      useNotificationStore.setState({ unreadCount: 0 });
      const { addNotification, markAsRead } = useNotificationStore.getState();

      addNotification({ title: 'Test', message: 'Test', type: 'info' });
      const { notifications } = useNotificationStore.getState();

      // Mark as read
      markAsRead(notifications[0].id);
      // Try marking as read again
      markAsRead(notifications[0].id);

      const { unreadCount } = useNotificationStore.getState();
      expect(unreadCount).toBe(0);
    });

    it('should not affect state if notification already read', () => {
      const { addNotification, markAsRead } = useNotificationStore.getState();

      addNotification({ title: 'Test', message: 'Test', type: 'info' });
      const { notifications } = useNotificationStore.getState();
      const id = notifications[0].id;

      markAsRead(id);
      const { unreadCount: count1 } = useNotificationStore.getState();

      markAsRead(id); // Already read
      const { unreadCount: count2 } = useNotificationStore.getState();

      expect(count1).toBe(count2);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', () => {
      const { addNotification, markAllAsRead } = useNotificationStore.getState();

      addNotification({ title: 'Test 1', message: 'Test', type: 'info' });
      addNotification({ title: 'Test 2', message: 'Test', type: 'info' });
      addNotification({ title: 'Test 3', message: 'Test', type: 'info' });

      markAllAsRead();

      const { notifications, unreadCount } = useNotificationStore.getState();
      expect(notifications.every((n) => n.read === true)).toBe(true);
      expect(unreadCount).toBe(0);
    });
  });

  describe('removeNotification', () => {
    it('should remove a notification', () => {
      const { addNotification, removeNotification } = useNotificationStore.getState();

      addNotification({ title: 'Test 1', message: 'Test', type: 'info' });
      addNotification({ title: 'Test 2', message: 'Test', type: 'info' });
      const { notifications: before } = useNotificationStore.getState();
      const idToRemove = before[0].id;

      removeNotification(idToRemove);

      const { notifications: after } = useNotificationStore.getState();
      expect(after).toHaveLength(1);
      expect(after.find((n) => n.id === idToRemove)).toBeUndefined();
    });

    it('should decrement unread if notification was unread', () => {
      const { addNotification, removeNotification } = useNotificationStore.getState();

      addNotification({ title: 'Test', message: 'Test', type: 'info' });
      const { notifications, unreadCount: before } = useNotificationStore.getState();

      removeNotification(notifications[0].id);

      const { unreadCount: after } = useNotificationStore.getState();
      expect(after).toBe(before - 1);
    });

    it('should not decrement unread if notification was read', () => {
      const { addNotification, markAsRead, removeNotification } =
        useNotificationStore.getState();

      addNotification({ title: 'Test 1', message: 'Test', type: 'info' });
      addNotification({ title: 'Test 2', message: 'Test', type: 'info' });
      const { notifications } = useNotificationStore.getState();

      // Mark first one as read
      markAsRead(notifications[0].id);
      const { unreadCount: before } = useNotificationStore.getState();

      // Remove the read notification
      removeNotification(notifications[0].id);

      const { unreadCount: after } = useNotificationStore.getState();
      expect(after).toBe(before); // Count should stay the same
    });
  });

  describe('clearAll', () => {
    it('should clear all notifications', () => {
      const { addNotification, clearAll } = useNotificationStore.getState();

      addNotification({ title: 'Test 1', message: 'Test', type: 'info' });
      addNotification({ title: 'Test 2', message: 'Test', type: 'info' });

      clearAll();

      const { notifications, unreadCount } = useNotificationStore.getState();
      expect(notifications).toHaveLength(0);
      expect(unreadCount).toBe(0);
    });
  });

  // Note: requestBrowserPermission tests are skipped because window.Notification
  // is not available in the test environment. These are tested at the E2E level.

  describe('notification types', () => {
    it('should support different notification types', () => {
      const { addNotification } = useNotificationStore.getState();

      addNotification({ title: 'Info', message: 'Test', type: 'info' });
      addNotification({ title: 'Success', message: 'Test', type: 'success' });
      addNotification({ title: 'Warning', message: 'Test', type: 'warning' });
      addNotification({ title: 'Error', message: 'Test', type: 'error' });

      const { notifications } = useNotificationStore.getState();
      expect(notifications.map((n) => n.type)).toEqual([
        'error',
        'warning',
        'success',
        'info',
      ]);
    });
  });
});
