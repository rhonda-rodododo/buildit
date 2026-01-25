/**
 * Device Sync Module
 * Provides device-to-device transfer and sync functionality
 */

// Services
export { DeviceTransferService, deviceTransferService } from './DeviceTransferService';
export { TransferCrypto, transferCrypto } from './TransferCrypto';

// Re-export types from backup module
export type {
  DeviceTransferQR,
  DeviceTransferSession,
  TransferMessageType,
  TransferMessage,
} from '@/core/backup/types';
