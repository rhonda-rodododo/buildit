/**
 * Identity Types
 *
 * Re-exports generated Zod schemas and types from protocol schemas.
 * The generated Identity type uses string for privateKey (protocol-level).
 * Web client code that needs Uint8Array privateKey should define its own
 * runtime type or cast as needed.
 */

// Re-export all generated Zod schemas and types
export {
  IdentitySchema,
  type Identity,
  EncryptedIdentitySchema,
  type EncryptedIdentity,
  ProfileMetadataSchema,
  type ProfileMetadata,
  IDENTITY_SCHEMA_VERSION,
} from '@/generated/validation/identity.zod';

export {
  KeyPairSchema,
  type KeyPair,
} from '@/generated/validation/crypto.zod';
