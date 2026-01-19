/**
 * Storage Index
 *
 * Re-exports storage utilities.
 */

export {
  STORAGE_KEYS,
  setSecureItem,
  getSecureItem,
  deleteSecureItem,
  setSecureJSON,
  getSecureJSON,
  clearAllSecureStorage,
  hasStoredIdentity,
} from './secureStorage'
export type { StorageKey } from './secureStorage'
