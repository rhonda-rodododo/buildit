/**
 * BLE Mesh Exports
 *
 * Bluetooth Low Energy mesh networking for offline-first communication
 */

export { BLEMeshAdapter } from './BLEMeshAdapter';

export {
  BUILDIT_SERVICE_UUID,
  BLE_CHARACTERISTICS,
  BLE_LIMITS,
  BLE_CONFIG,
  BLEMessageType,
  BLEDeviceRole,
  BLEStatusCode,
  BLE_ERRORS,
} from './constants';

export {
  compressMessage,
  decompressMessage,
  chunkMessage,
  serializeChunk,
  deserializeChunk,
  MessageReassembler,
  type MessageChunk,
} from './compression';
