/**
 * useModuleDependencies Hook
 *
 * Provides modules with an easy way to detect and respond to optional dependencies.
 * Modules can use this to enable/disable features based on available dependencies.
 */

import { useMemo } from 'react';
import { useModuleStore } from '@/stores/moduleStore';
import type { DependencyStatus } from '@/types/modules';

export interface ModuleDependenciesResult {
  /**
   * All dependency statuses for this module
   */
  dependencies: DependencyStatus[];

  /**
   * List of active optional dependency module IDs
   */
  activeOptional: string[];

  /**
   * Check if a specific dependency is available
   */
  has: (dependencyId: string) => boolean;

  /**
   * List of module IDs that are enhancing this module
   */
  enhancedBy: string[];

  /**
   * List of recommended modules that are not yet enabled
   */
  recommended: string[];

  /**
   * Check if this module has any missing required dependencies
   */
  hasMissingRequired: boolean;

  /**
   * List of missing required dependency names
   */
  missingRequired: string[];
}

/**
 * Hook for modules to detect and respond to optional dependencies
 *
 * @param groupId - The group context
 * @param moduleId - The module to check dependencies for
 * @returns Dependency information and helper methods
 *
 * @example
 * ```tsx
 * function EventsView({ groupId }: { groupId: string }) {
 *   const { has, enhancedBy } = useModuleDependencies(groupId, 'events');
 *
 *   const hasCustomFields = has('custom-fields');
 *
 *   return (
 *     <div>
 *       {hasCustomFields && <CustomFieldsSection />}
 *       {!hasCustomFields && (
 *         <Alert>Enable Custom Fields for more options</Alert>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useModuleDependencies(
  groupId: string,
  moduleId: string
): ModuleDependenciesResult {
  // Use selectors to avoid unnecessary re-renders
  const getDependencyStatus = useModuleStore((state) => state.getDependencyStatus);
  const getActiveOptionalDependencies = useModuleStore((state) => state.getActiveOptionalDependencies);
  const hasOptionalDependency = useModuleStore((state) => state.hasOptionalDependency);
  const getEnhancingModules = useModuleStore((state) => state.getEnhancingModules);
  const getRecommendedModules = useModuleStore((state) => state.getRecommendedModules);
  const isModuleEnabled = useModuleStore((state) => state.isModuleEnabled);
  const registry = useModuleStore((state) => state.registry);

  // Memoize the dependencies to avoid recalculating on every render
  const dependencies = useMemo(
    () => getDependencyStatus(groupId, moduleId),
    [getDependencyStatus, groupId, moduleId]
  );

  const activeOptional = useMemo(
    () => getActiveOptionalDependencies(groupId, moduleId),
    [getActiveOptionalDependencies, groupId, moduleId]
  );

  const enhancedBy = useMemo(
    () => getEnhancingModules(groupId, moduleId),
    [getEnhancingModules, groupId, moduleId]
  );

  const recommended = useMemo(() => {
    const allRecommended = getRecommendedModules(moduleId);
    // Filter out already enabled modules
    return allRecommended.filter((id) => !isModuleEnabled(groupId, id));
  }, [getRecommendedModules, moduleId, isModuleEnabled, groupId]);

  const missingRequired = useMemo(() => {
    const missing: string[] = [];
    for (const dep of dependencies) {
      if (dep.relationship === 'requires' && !dep.satisfied) {
        const entry = registry.get(dep.moduleId);
        missing.push(entry?.plugin.metadata.name || dep.moduleId);
      }
    }
    return missing;
  }, [dependencies, registry]);

  const hasMissingRequired = missingRequired.length > 0;

  // Create a memoized has function
  const has = useMemo(() => {
    return (dependencyId: string): boolean => {
      // First check if it's an optional dependency
      if (hasOptionalDependency(groupId, moduleId, dependencyId)) {
        return true;
      }
      // Also check if it's a required dependency that's satisfied
      const dep = dependencies.find((d) => d.moduleId === dependencyId);
      return dep?.satisfied ?? false;
    };
  }, [hasOptionalDependency, groupId, moduleId, dependencies]);

  return {
    dependencies,
    activeOptional,
    has,
    enhancedBy,
    recommended,
    hasMissingRequired,
    missingRequired,
  };
}

/**
 * Hook to check if a specific feature flag is enabled based on dependencies
 *
 * @param groupId - The group context
 * @param moduleId - The module to check
 * @param featureFlag - The feature flag to check
 * @returns Whether the feature is enabled
 */
export function useFeatureFlag(
  groupId: string,
  moduleId: string,
  featureFlag: string
): boolean {
  const getDependencyStatus = useModuleStore((state) => state.getDependencyStatus);
  const getNormalizedDependencies = useModuleStore((state) => state.getNormalizedDependencies);

  return useMemo(() => {
    const statuses = getDependencyStatus(groupId, moduleId);
    const deps = getNormalizedDependencies(moduleId);

    // Check if any satisfied dependency enables this feature flag
    for (const dep of deps) {
      if (dep.enhancementConfig?.featureFlags?.includes(featureFlag)) {
        const status = statuses.find((s) => s.moduleId === dep.moduleId);
        if (status?.satisfied) {
          return true;
        }
      }
    }

    return false;
  }, [getDependencyStatus, getNormalizedDependencies, groupId, moduleId, featureFlag]);
}

/**
 * Hook to get UI slots that should be rendered based on active dependencies
 *
 * @param groupId - The group context
 * @param moduleId - The module to check
 * @returns Array of UI slot IDs that should be active
 */
export function useActiveUISlots(groupId: string, moduleId: string): string[] {
  const getDependencyStatus = useModuleStore((state) => state.getDependencyStatus);
  const getNormalizedDependencies = useModuleStore((state) => state.getNormalizedDependencies);

  return useMemo(() => {
    const statuses = getDependencyStatus(groupId, moduleId);
    const deps = getNormalizedDependencies(moduleId);
    const activeSlots: string[] = [];

    for (const dep of deps) {
      if (dep.enhancementConfig?.uiSlots?.length) {
        const status = statuses.find((s) => s.moduleId === dep.moduleId);
        if (status?.satisfied) {
          activeSlots.push(...dep.enhancementConfig.uiSlots);
        }
      }
    }

    return [...new Set(activeSlots)]; // Remove duplicates
  }, [getDependencyStatus, getNormalizedDependencies, groupId, moduleId]);
}

export default useModuleDependencies;
