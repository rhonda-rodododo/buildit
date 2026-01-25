import { z } from 'zod';

// Contact relationship types
export type RelationshipType = 'following' | 'follower' | 'friend' | 'blocked';

// Contact metadata schema
export const ContactMetadataSchema = z.object({
  pubkey: z.string(),
  relay: z.string().optional(),
  petname: z.string().optional(),
  displayName: z.string().optional(),
  avatar: z.string().url().optional(),
  bio: z.string().optional(),
  nip05: z.string().optional(),
  lud16: z.string().optional(), // Lightning address
});

export type ContactMetadata = z.infer<typeof ContactMetadataSchema>;

// Contact with relationship info
export interface Contact extends ContactMetadata {
  relationship: RelationshipType;
  followedAt?: number; // Timestamp when followed
  mutedAt?: number; // Timestamp when muted
  blockedAt?: number; // Timestamp when blocked
}

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

// User profile metadata (NIP-01, kind 0)
export const ProfileMetadataSchema = z.object({
  name: z.string().optional(),
  display_name: z.string().optional(),
  about: z.string().optional(),
  picture: z.string().url().optional(),
  banner: z.string().url().optional(),
  nip05: z.string().optional(),
  lud16: z.string().optional(),
  website: z.string().url().optional(),
});

export type ProfileMetadata = z.infer<typeof ProfileMetadataSchema>;
