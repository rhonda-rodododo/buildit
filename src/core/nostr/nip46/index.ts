/**
 * NIP-46 Remote Signing Module
 * Provides bunker (primary) and remote signer (secondary) functionality
 */

// Services
export { BunkerService, bunkerService } from './BunkerService';
export type { Nip46Response, PendingApproval } from './BunkerService';

export { RemoteSigner, remoteSigner } from './RemoteSigner';
export type { RemoteSignerState } from './RemoteSigner';

// Re-export types from backup module
export type {
  Nip46Permission,
  Nip46Request,
  BunkerConnectionConfig,
} from '@/core/backup/types';
