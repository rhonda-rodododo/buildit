/**
 * Transport Layer Exports
 *
 * Unified transport layer for BuildIt Network
 * BLE Mesh (PRIMARY) → Nostr Relays (SECONDARY)
 */

export { TransportService } from './TransportService';
export { TransportRouter } from './TransportRouter';
export { NostrRelayAdapter } from './NostrRelayAdapter';

export type {
  ITransportAdapter,
  TransportMessage,
  TransportCapabilities,
  TransportStats,
  TransportRouterConfig,
} from './types';

export {
  TransportType,
  TransportStatus,
  DeliveryStatus,
  DEFAULT_TRANSPORT_CONFIG,
} from './types';
