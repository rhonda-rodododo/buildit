/**
 * Contacts Types
 *
 * Re-exports generated Zod schemas and types from protocol schemas.
 * NIP-specific event schemas (ContactListEvent, MuteListEvent) are defined locally
 * as they are Nostr wire format, not protocol types.
 */

import { z } from 'zod';

// Re-export all generated Zod schemas and types
export {
  RelationshipTypeSchema,
  type RelationshipType,
  PredefinedTagSchema,
  type PredefinedTag,
  NoteCategorySchema,
  type NoteCategory,
  ContactMetadataSchema,
  type ContactMetadata,
  ContactSchema,
  type Contact,
  ContactNoteSchema,
  type ContactNote,
  ContactTagSchema,
  type ContactTag,
  CONTACTS_SCHEMA_VERSION,
} from '@/generated/validation/contacts.zod';

// Re-export ProfileMetadata from identity (used by contact display)
export {
  ProfileMetadataSchema,
  type ProfileMetadata,
} from '@/generated/validation/identity.zod';

// ── NIP-Specific Event Schemas (wire format, not protocol types) ──

// Contact list event (NIP-02, kind 3)
export const ContactListEventSchema = z.object({
  kind: z.literal(3),
  tags: z.array(z.tuple([z.literal('p'), z.string(), z.string().optional(), z.string().optional()])),
  content: z.string(),
  created_at: z.number(),
  pubkey: z.string(),
  id: z.string(),
  sig: z.string(),
});

export type ContactListEvent = z.infer<typeof ContactListEventSchema>;

// Mute list event (NIP-51, kind 10000)
export const MuteListEventSchema = z.object({
  kind: z.literal(10000),
  tags: z.array(z.tuple([z.literal('p'), z.string()])),
  content: z.string(), // Can be encrypted
  created_at: z.number(),
  pubkey: z.string(),
  id: z.string(),
  sig: z.string(),
});

export type MuteListEvent = z.infer<typeof MuteListEventSchema>;
