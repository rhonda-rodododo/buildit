/**
 * Federation Module Types
 *
 * Re-exports generated Zod schemas and types from protocol schemas.
 * UI-only types (FederationIdentityStatus) are defined here.
 */

// Re-export all generated Zod schemas and types
export {
  FederationConfigSchema,
  type FederationConfig,
  FederationStatusSchema,
  type FederationStatus,
  FederationInteractionSchema,
  type FederationInteraction,
  FEDERATION_SCHEMA_VERSION,
} from '@/generated/validation/federation.zod';

// ── UI-Only Types ──────────────────────────────────────────────────

/**
 * Federation identity status response from the worker API (UI-only type).
 * This is the shape returned by GET /api/status/:pubkey — not a protocol type.
 */
export interface FederationIdentityStatus {
  federated: boolean;
  ap_enabled?: boolean;
  at_enabled?: boolean;
  at_handle?: string;
  username?: string;
}
