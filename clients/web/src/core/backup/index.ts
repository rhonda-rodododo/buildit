/**
 * Backup Module
 * Provides backup and recovery functionality for BuildIt Network
 */

// Services
export { BackupService, backupService } from './BackupService';
export { RecoveryPhraseService, recoveryPhraseService } from './RecoveryPhraseService';

// Types
export type {
  EncryptedBackup,
  BackupContents,
  BackupMetadata,
  BackupContact,
  BackupGroup,
  RecoveryPhraseValidation,
  DeviceTransferQR,
  DeviceTransferSession,
  TransferMessageType,
  TransferMessage,
  Nip46Permission,
  BunkerConnectionConfig,
  Nip46Request,
  LinkedDevice,
} from './types';
