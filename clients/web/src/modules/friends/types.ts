/**
 * Friends System - Types
 * Core types for friend relationships and contacts management
 */

/**
 * Friend relationship status
 */
export type FriendStatus = 'pending' | 'accepted' | 'blocked';

/**
 * Method used to add friend
 */
export type FriendAddMethod = 'qr' | 'username' | 'email' | 'invite-link';

/**
 * Trust tier for contacts
 */
export type TrustTier = 'stranger' | 'contact' | 'friend' | 'verified' | 'trusted';

/**
 * Friend relationship interface
 */
export interface DBFriend {
  id: string;
  userPubkey: string;      // Current user
  friendPubkey: string;    // Friend's pubkey
  username?: string;       // Cached username
  displayName?: string;    // Cached display name
  status: FriendStatus;
  addedAt: number;
  acceptedAt?: number;
  notes?: string;          // Private notes about friend
  tags: string[];          // Custom tags (organizer, trusted, etc.)
  verifiedInPerson: boolean;  // Met IRL and verified
  isFavorite: boolean;     // Pinned to favorites
  trustTier: TrustTier;    // Trust level

  // Privacy settings
  privacySettings: FriendPrivacySettings;
}

/**
 * Friend privacy settings
 */
export interface FriendPrivacySettings {
  canSeeOnlineStatus: boolean;
  canSeeGroups: boolean;
  canSeeActivity: boolean;
  canTagInPosts: boolean;
}

/**
 * Friend request interface
 */
export interface FriendRequest {
  id: string;
  fromPubkey: string;
  fromUsername?: string;   // Cached for display
  toPubkey: string;
  message?: string;        // Optional intro message
  method: FriendAddMethod;
  createdAt: number;
  expiresAt?: number;

  // For QR code verification
  signature?: string;      // Signature to verify authenticity
}

/**
 * QR code friend data
 *
 * SECURITY: The signature covers pubkey + timestamp + nonce using Schnorr/BIP-340.
 * QR codes expire after 10 minutes to limit replay attack windows.
 * The nonce prevents replay of captured QR codes with identical timestamps.
 */
export interface FriendQRData {
  pubkey: string;
  username?: string;
  timestamp: number;
  nonce?: string;          // Random nonce for uniqueness (32 hex chars)
  signature: string;       // Schnorr signature of sha256("buildit-qr:{pubkey}:{timestamp}:{nonce}")
}

/**
 * Invite link data
 */
export interface FriendInviteLink {
  id: string;
  creatorPubkey: string;
  code: string;            // Short invite code
  expiresAt?: number;
  maxUses?: number;
  currentUses: number;
  createdAt: number;
}

/**
 * Friend filters for querying
 */
export interface FriendFilter {
  status?: FriendStatus[];
  trustTiers?: TrustTier[];
  tags?: string[];
  favorites?: boolean;
  verified?: boolean;
  searchQuery?: string;
  sortBy?: 'recent' | 'name' | 'username';
}

/**
 * Friend statistics
 */
export interface FriendStats {
  total: number;
  pending: number;
  accepted: number;
  blocked: number;
  verified: number;
  favorites: number;
  byTrustTier: Record<TrustTier, number>;
}
