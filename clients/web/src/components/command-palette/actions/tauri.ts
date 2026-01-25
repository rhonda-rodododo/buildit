/**
 * Tauri-specific actions for Command Palette
 * These actions are only available in the desktop app
 */

import {
  Bluetooth,
  Monitor,
  Minimize2,
  Maximize2,
  Pin,
  Bell,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import type { CommandAction } from '../types';

/**
 * Create Tauri-specific actions
 * These are conditionally added when running in Tauri
 */
export function createTauriActions(): CommandAction[] {
  return [
    {
      id: 'tauri-ble-scan',
      label: 'Start BLE Scan',
      category: 'tauri',
      icon: Bluetooth,
      keywords: ['bluetooth', 'mesh', 'nearby', 'devices'],
      description: 'Scan for nearby devices',
      priority: 90,
      tauriOnly: true,
      requiresAuth: true,
      onSelect: async () => {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('ble_start_scan');
        } catch (error) {
          console.error('Failed to start BLE scan:', error);
        }
      },
    },
    {
      id: 'tauri-minimize',
      label: 'Minimize Window',
      category: 'tauri',
      icon: Minimize2,
      keywords: ['hide', 'dock', 'taskbar'],
      priority: 70,
      tauriOnly: true,
      onSelect: async () => {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          await getCurrentWindow().minimize();
        } catch (error) {
          console.error('Failed to minimize:', error);
        }
      },
    },
    {
      id: 'tauri-maximize',
      label: 'Maximize Window',
      category: 'tauri',
      icon: Maximize2,
      keywords: ['fullscreen', 'expand'],
      priority: 65,
      tauriOnly: true,
      onSelect: async () => {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const win = getCurrentWindow();
          if (await win.isMaximized()) {
            await win.unmaximize();
          } else {
            await win.maximize();
          }
        } catch (error) {
          console.error('Failed to maximize:', error);
        }
      },
    },
    {
      id: 'tauri-always-on-top',
      label: 'Toggle Always on Top',
      category: 'tauri',
      icon: Pin,
      keywords: ['pin', 'float', 'front'],
      priority: 60,
      tauriOnly: true,
      onSelect: async () => {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const win = getCurrentWindow();
          // Note: This toggles, actual state tracking would need to be stored
          await win.setAlwaysOnTop(true);
        } catch (error) {
          console.error('Failed to set always on top:', error);
        }
      },
    },
    {
      id: 'tauri-notifications',
      label: 'Enable Desktop Notifications',
      category: 'tauri',
      icon: Bell,
      keywords: ['alerts', 'system', 'native'],
      priority: 55,
      tauriOnly: true,
      onSelect: async () => {
        try {
          const { requestPermission, isPermissionGranted } = await import(
            '@tauri-apps/plugin-notification'
          );
          const granted = await isPermissionGranted();
          if (!granted) {
            await requestPermission();
          }
        } catch (error) {
          console.error('Failed to request notifications:', error);
        }
      },
    },
    {
      id: 'tauri-open-devtools',
      label: 'Open Developer Tools',
      category: 'tauri',
      icon: Monitor,
      keywords: ['debug', 'inspect', 'console'],
      shortcut: 'Mod+Shift+i',
      priority: 50,
      tauriOnly: true,
      onSelect: async () => {
        try {
          const { getCurrentWebview } = await import('@tauri-apps/api/webview');
          const webview = getCurrentWebview();
          // Note: This may not work on all platforms
          await webview.emit('devtools-toggle');
        } catch (error) {
          console.error('Failed to open devtools:', error);
        }
      },
    },
    {
      id: 'tauri-open-external',
      label: 'Open Link in Browser',
      category: 'tauri',
      icon: ExternalLink,
      keywords: ['external', 'browser', 'url'],
      description: 'Open current page in default browser',
      priority: 45,
      tauriOnly: true,
      onSelect: async () => {
        try {
          const { open } = await import('@tauri-apps/plugin-shell');
          await open(window.location.href);
        } catch (error) {
          console.error('Failed to open external:', error);
        }
      },
    },
    {
      id: 'tauri-reload',
      label: 'Reload Application',
      category: 'tauri',
      icon: RefreshCw,
      keywords: ['refresh', 'restart'],
      shortcut: 'Mod+r',
      priority: 40,
      tauriOnly: true,
      onSelect: () => {
        window.location.reload();
      },
    },
  ];
}
