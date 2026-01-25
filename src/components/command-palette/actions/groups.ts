/**
 * Group actions for Command Palette
 */

import type { NavigateFunction } from 'react-router-dom';
import type { DBGroup } from '@/core/storage/db';
import { Users, Plus, Settings, ArrowRight } from 'lucide-react';
import type { CommandAction } from '../types';

/**
 * Create group-related actions
 */
export function createGroupActions(
  navigate: NavigateFunction,
  groups: DBGroup[],
  _activeGroup: DBGroup | null,
  currentGroupId?: string
): CommandAction[] {
  const actions: CommandAction[] = [];

  // Create new group
  actions.push({
    id: 'group-create',
    label: 'Create New Group',
    category: 'create',
    icon: Plus,
    keywords: ['new', 'organization', 'community', 'team'],
    shortcut: 'Mod+Shift+n',
    priority: 100,
    requiresAuth: true,
    onSelect: () => navigate('/app/groups/new'),
  });

  // Switch to group actions
  for (const group of groups) {
    // Skip current group
    if (group.id === currentGroupId) continue;

    actions.push({
      id: `group-switch-${group.id}`,
      label: `Switch to ${group.name}`,
      category: 'groups',
      icon: ArrowRight,
      keywords: ['go', 'open', group.name.toLowerCase()],
      priority: 50,
      requiresAuth: true,
      groupId: group.id,
      onSelect: () => navigate(`/app/groups/${group.id}`),
    });
  }

  // Group settings (if in a group)
  if (currentGroupId) {
    actions.push({
      id: 'group-settings',
      label: 'Group Settings',
      category: 'groups',
      icon: Settings,
      keywords: ['configure', 'options', 'preferences'],
      priority: 80,
      requiresAuth: true,
      groupId: currentGroupId,
      onSelect: () => navigate(`/app/groups/${currentGroupId}/settings`),
    });

    actions.push({
      id: 'group-members',
      label: 'Group Members',
      category: 'groups',
      icon: Users,
      keywords: ['people', 'users', 'invite'],
      priority: 75,
      requiresAuth: true,
      groupId: currentGroupId,
      onSelect: () => navigate(`/app/groups/${currentGroupId}/members`),
    });
  }

  return actions;
}
