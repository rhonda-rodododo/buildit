import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGroupsStore } from '@/stores/groupsStore';
import { useModuleStore } from '@/stores/moduleStore';
import type { DBGroup, DBGroupMember } from '@/core/storage/db';
import type { ModulePlugin } from '@/types/modules';

/**
 * Group Context Value
 * Provides current group state and enabled modules
 */
interface GroupContextValue {
  groupId: string;
  group: DBGroup | null;
  members: DBGroupMember[];
  enabledModules: string[];
  availableModules: ModulePlugin[];
  isLoading: boolean;
  error: string | null;

  // Helper functions
  isModuleEnabled: (moduleId: string) => boolean;
  canAccessModule: (moduleId: string) => boolean;
  refetch: () => Promise<void>;
}

/**
 * Group Context
 */
const GroupContext = createContext<GroupContextValue | undefined>(undefined);

/**
 * Group Context Provider Props
 */
interface GroupContextProviderProps {
  children: ReactNode;
}

/**
 * Group Context Provider
 * Wraps group-scoped routes and provides current group context
 */
export function GroupContextProvider({ children }: GroupContextProviderProps) {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();

  const { groups, loadGroups, loadGroupMembers, groupMembers } = useGroupsStore();
  const { registry } = useModuleStore();

  const [group, setGroup] = useState<DBGroup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load group data when groupId changes
  useEffect(() => {
    async function loadGroupData() {
      if (!groupId) {
        setError('No group ID provided');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Find group in store
        const foundGroup = groups.find(g => g.id === groupId);

        if (!foundGroup) {
          // Group not found - redirect to groups page
          console.error(`Group ${groupId} not found`);
          setError('Group not found');
          navigate('/app/groups');
          return;
        }

        setGroup(foundGroup);

        // Load group members
        await loadGroupMembers(groupId);

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load group:', err);
        setError(err instanceof Error ? err.message : 'Failed to load group');
        setIsLoading(false);
      }
    }

    loadGroupData();
  }, [groupId, groups, navigate, loadGroupMembers]);

  // Refetch function
  const refetch = async () => {
    if (!groupId) return;

    setIsLoading(true);
    try {
      await loadGroupMembers(groupId);
      const foundGroup = groups.find(g => g.id === groupId);
      if (foundGroup) {
        setGroup(foundGroup);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refetch group');
    } finally {
      setIsLoading(false);
    }
  };

  // Get enabled modules for this group
  const enabledModules = group?.enabledModules || [];

  // Get all available modules from registry
  const availableModules = Array.from(registry.values()).map(entry => entry.plugin);

  // Get members for this group
  const members = groupId ? groupMembers.get(groupId) || [] : [];

  // Check if a module is enabled
  const isModuleEnabled = (moduleId: string): boolean => {
    return enabledModules.includes(moduleId);
  };

  // Check if user can access a module (module must be enabled for group)
  const canAccessModule = (moduleId: string): boolean => {
    return isModuleEnabled(moduleId);
  };

  const contextValue: GroupContextValue = {
    groupId: groupId || '',
    group,
    members,
    enabledModules,
    availableModules,
    isLoading,
    error,
    isModuleEnabled,
    canAccessModule,
    refetch,
  };

  return (
    <GroupContext.Provider value={contextValue}>
      {children}
    </GroupContext.Provider>
  );
}

/**
 * Use Group Context Hook
 * Access current group context from any component within GroupContextProvider
 */
export function useGroupContext(): GroupContextValue {
  const context = useContext(GroupContext);

  if (context === undefined) {
    throw new Error('useGroupContext must be used within GroupContextProvider');
  }

  return context;
}

/**
 * Optional: Use Group Context (returns null if not within provider)
 * Useful for components that may or may not be in a group context
 */
export function useGroupContextOptional(): GroupContextValue | null {
  const context = useContext(GroupContext);
  return context || null;
}
