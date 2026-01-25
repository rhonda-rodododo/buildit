/**
 * Command Palette React Context
 */

import { createContext } from 'react';
import type { CommandPaletteContextValue } from './types';

/**
 * Default context value (noop functions)
 */
const defaultContext: CommandPaletteContextValue = {
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
  registerAction: () => {},
  unregisterAction: () => {},
  registerActions: () => {},
  executeAction: () => {},
  query: '',
  setQuery: () => {},
};

/**
 * Command Palette Context
 */
export const CommandPaletteContext = createContext<CommandPaletteContextValue>(defaultContext);
