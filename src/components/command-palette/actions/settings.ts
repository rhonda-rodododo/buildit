/**
 * Settings actions for Command Palette
 */

import type { NavigateFunction } from 'react-router-dom';
import {
  User,
  Shield,
  Bell,
  Palette,
  Globe,
  Key,
  Eye,
  Monitor,
} from 'lucide-react';
import type { CommandAction } from '../types';

/**
 * Create settings-related actions
 */
export function createSettingsActions(navigate: NavigateFunction): CommandAction[] {
  return [
    {
      id: 'settings-profile',
      label: 'Edit Profile',
      category: 'settings',
      icon: User,
      keywords: ['account', 'name', 'avatar', 'bio'],
      priority: 90,
      requiresAuth: true,
      onSelect: () => navigate('/app/settings/profile'),
    },
    {
      id: 'settings-security',
      label: 'Security & Privacy',
      category: 'settings',
      icon: Shield,
      keywords: ['password', 'privacy', 'encryption', 'backup'],
      priority: 85,
      requiresAuth: true,
      onSelect: () => navigate('/app/settings/security'),
    },
    {
      id: 'settings-notifications',
      label: 'Notification Settings',
      category: 'settings',
      icon: Bell,
      keywords: ['alerts', 'sounds', 'push'],
      priority: 80,
      requiresAuth: true,
      onSelect: () => navigate('/app/settings/notifications'),
    },
    {
      id: 'settings-appearance',
      label: 'Appearance',
      category: 'settings',
      icon: Palette,
      keywords: ['theme', 'dark', 'light', 'colors'],
      priority: 75,
      requiresAuth: true,
      onSelect: () => navigate('/app/settings/appearance'),
    },
    {
      id: 'settings-language',
      label: 'Language & Region',
      category: 'settings',
      icon: Globe,
      keywords: ['locale', 'translation', 'i18n'],
      priority: 70,
      requiresAuth: true,
      onSelect: () => navigate('/app/settings/language'),
    },
    {
      id: 'settings-keys',
      label: 'Manage Keys',
      category: 'settings',
      icon: Key,
      keywords: ['nostr', 'keypair', 'export', 'import', 'nsec'],
      priority: 65,
      requiresAuth: true,
      onSelect: () => navigate('/app/settings/keys'),
    },
    {
      id: 'settings-privacy',
      label: 'Privacy Settings',
      category: 'settings',
      icon: Eye,
      keywords: ['visibility', 'hidden', 'public', 'private'],
      priority: 60,
      requiresAuth: true,
      onSelect: () => navigate('/app/settings/privacy'),
    },
    {
      id: 'settings-devices',
      label: 'Manage Devices',
      category: 'settings',
      icon: Monitor,
      keywords: ['sessions', 'logout', 'signed in'],
      priority: 55,
      requiresAuth: true,
      onSelect: () => navigate('/app/settings/devices'),
    },
  ];
}
