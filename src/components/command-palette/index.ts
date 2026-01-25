/**
 * Command Palette
 *
 * A keyboard-driven command interface for quick navigation and actions.
 * Triggered with Cmd+K (Mac) or Ctrl+K (Windows/Linux).
 *
 * @example
 * ```tsx
 * import { CommandPaletteProvider, useCommandPalette } from '@/components/command-palette';
 *
 * // Wrap your app with the provider
 * function App() {
 *   return (
 *     <CommandPaletteProvider>
 *       <MyApp />
 *     </CommandPaletteProvider>
 *   );
 * }
 *
 * // Use the hook to programmatically control the palette
 * function MyComponent() {
 *   const { open, registerAction } = useCommandPalette();
 *   // ...
 * }
 * ```
 */

// Provider and main component
export { CommandPaletteProvider } from './CommandPaletteProvider';
export { CommandPalette } from './CommandPalette';

// Hooks
export {
  useCommandPalette,
  useRegisterAction,
  useRegisterActions,
  useCommandShortcut,
} from './useCommandPalette';

// Context (rarely needed directly)
export { CommandPaletteContext } from './CommandPaletteContext';

// Types
export type {
  CommandAction,
  CommandCategory,
  CommandGroup,
  CommandPaletteState,
  CommandPaletteContextValue,
} from './types';
export { CATEGORY_CONFIG } from './types';

// Action creators (for advanced usage)
export {
  createNavigationActions,
  createGroupActions,
  createSettingsActions,
  createTauriActions,
} from './actions';
