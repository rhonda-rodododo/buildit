/**
 * Navigation actions for Command Palette
 */

import type { NavigateFunction } from 'react-router-dom';
import {
  MessageSquare,
  Users,
  Calendar,
  Settings,
  UserPlus,
  Search,
  Bell,
  Shield,
  Newspaper,
  Plus,
  PanelLeft,
} from 'lucide-react';
import type { CommandAction } from '../types';

/**
 * Create navigation actions
 */
export function createNavigationActions(navigate: NavigateFunction): CommandAction[] {
  return [
    // Quick actions (higher priority for frequent use)
    {
      id: 'action-new',
      label: 'New...',
      category: 'actions',
      icon: Plus,
      keywords: ['create', 'add', 'compose'],
      shortcut: 'Mod+N',
      priority: 110,
      requiresAuth: true,
      onSelect: () => {
        // Context-aware new - opens command palette filtered to "new" actions
        // For now, navigate to messages as the most common "new" action
        navigate('/app/messages?new=true');
      },
    },
    {
      id: 'action-new-group',
      label: 'Create New Group',
      category: 'actions',
      icon: Users,
      keywords: ['new group', 'create community', 'start organization'],
      shortcut: 'Mod+Shift+N',
      priority: 105,
      requiresAuth: true,
      onSelect: () => navigate('/app/groups/new'),
    },
    {
      id: 'action-toggle-sidebar',
      label: 'Toggle Sidebar',
      category: 'actions',
      icon: PanelLeft,
      keywords: ['sidebar', 'panel', 'navigation', 'collapse', 'expand'],
      shortcut: 'Mod+B',
      priority: 50,
      requiresAuth: true,
      tauriOnly: false, // Works in both web and desktop
      onSelect: () => {
        // Dispatch custom event that AppSidebar listens for
        window.dispatchEvent(new CustomEvent('toggle-sidebar'));
      },
    },
    {
      id: 'nav-feed',
      label: 'Go to Feed',
      category: 'navigation',
      icon: Newspaper,
      keywords: ['home', 'timeline', 'posts'],
      shortcut: 'Mod+5',
      priority: 100,
      requiresAuth: true,
      onSelect: () => navigate('/app/feed'),
    },
    {
      id: 'nav-messages',
      label: 'Go to Messages',
      category: 'navigation',
      icon: MessageSquare,
      keywords: ['dm', 'chat', 'conversations', 'inbox'],
      shortcut: 'Mod+1',
      priority: 95,
      requiresAuth: true,
      onSelect: () => navigate('/app/messages'),
    },
    {
      id: 'nav-groups',
      label: 'Go to Groups',
      category: 'navigation',
      icon: Users,
      keywords: ['communities', 'organizations', 'teams'],
      shortcut: 'Mod+2',
      priority: 90,
      requiresAuth: true,
      onSelect: () => navigate('/app/groups'),
    },
    {
      id: 'nav-friends',
      label: 'Go to Friends',
      category: 'navigation',
      icon: UserPlus,
      keywords: ['contacts', 'connections', 'people'],
      shortcut: 'Mod+3',
      priority: 85,
      requiresAuth: true,
      onSelect: () => navigate('/app/friends'),
    },
    {
      id: 'nav-events',
      label: 'Go to Events',
      category: 'navigation',
      icon: Calendar,
      keywords: ['calendar', 'schedule', 'upcoming'],
      shortcut: 'Mod+4',
      priority: 80,
      requiresAuth: true,
      onSelect: () => navigate('/app/events'),
    },
    {
      id: 'nav-settings',
      label: 'Go to Settings',
      category: 'navigation',
      icon: Settings,
      keywords: ['preferences', 'options', 'configuration'],
      shortcut: 'Mod+,',
      priority: 75,
      requiresAuth: true,
      onSelect: () => navigate('/app/settings'),
    },
    {
      id: 'nav-notifications',
      label: 'Go to Notifications',
      category: 'navigation',
      icon: Bell,
      keywords: ['alerts', 'updates', 'mentions'],
      priority: 70,
      requiresAuth: true,
      onSelect: () => navigate('/app/notifications'),
    },
    {
      id: 'nav-security',
      label: 'Go to Security Settings',
      category: 'navigation',
      icon: Shield,
      keywords: ['privacy', 'password', 'keys', 'backup'],
      priority: 65,
      requiresAuth: true,
      onSelect: () => navigate('/app/settings/security'),
    },
    {
      id: 'nav-search',
      label: 'Search',
      category: 'search',
      icon: Search,
      keywords: ['find', 'lookup', 'query'],
      shortcut: 'Mod+/',
      priority: 100,
      requiresAuth: true,
      onSelect: () => navigate('/app/search'),
    },
  ];
}
