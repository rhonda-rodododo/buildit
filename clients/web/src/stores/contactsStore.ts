import { create } from 'zustand';
import type { Contact, ProfileMetadata } from '@/types/contacts';
import { getNostrClient } from '@/core/nostr/client';
import { useAuthStore, getCurrentPrivateKey } from './authStore';
import {
  createContactListEvent,
  decryptContactList,
  parseKind3ContactList,
  createKind3ContactListEvent,
  obfuscateContactList,
  filterRealContacts,
  getEncryptedListFilters,
  getKind3ContactListFilter,
  isEncryptedListNewer,
  ENCRYPTED_LIST_KINDS,
  type ContactListEntry,
  type ContactListPublishConfig,
  DEFAULT_CONTACT_LIST_CONFIG,
} from '@/core/crypto/nip51';
import { logger } from '@/lib/logger';

interface ContactsState {
  contacts: Map<string, Contact>; // pubkey -> contact
  profiles: Map<string, ProfileMetadata>; // pubkey -> profile metadata
  loading: boolean;
  error: string | null;

  // Publish configuration for privacy settings
  publishConfig: ContactListPublishConfig;

  // Actions
  followUser: (pubkey: string, relay?: string, petname?: string) => Promise<void>;
  unfollowUser: (pubkey: string) => Promise<void>;
  blockUser: (pubkey: string) => Promise<void>;
  unblockUser: (pubkey: string) => Promise<void>;
  muteUser: (pubkey: string) => Promise<void>;
  unmuteUser: (pubkey: string) => Promise<void>;

  // Queries
  getContact: (pubkey: string) => Contact | undefined;
  getFollowing: () => Contact[];
  getFollowers: () => Contact[];
  getFriends: () => Contact[]; // Mutual follows
  getBlocked: () => Contact[];
  getMuted: () => Contact[];
  isFollowing: (pubkey: string) => boolean;
  isFriend: (pubkey: string) => boolean;

  // Sync
  syncContacts: () => Promise<void>;
  syncProfiles: (pubkeys: string[]) => Promise<void>;
  publishContactList: () => Promise<void>;

  // Migration and configuration
  migrateToEncryptedFormat: () => Promise<{ success: boolean; migrated: number; error?: string }>;
  setPublishConfig: (config: Partial<ContactListPublishConfig>) => void;
  getPublishConfig: () => ContactListPublishConfig;

  // Internal
  addContact: (contact: Contact) => void;
  removeContact: (pubkey: string) => void;
  updateContact: (pubkey: string, updates: Partial<Contact>) => void;
  setProfile: (pubkey: string, profile: ProfileMetadata) => void;
}

export const useContactsStore = create<ContactsState>()(
  (set, get) => ({
      contacts: new Map(),
      profiles: new Map(),
      loading: false,
      error: null,
      publishConfig: { ...DEFAULT_CONTACT_LIST_CONFIG },

      followUser: async (pubkey: string, relay?: string, petname?: string) => {
        const contact: Contact = {
          _v: '1.0.0',
          pubkey,
          relay,
          petname,
          relationship: 'following',
          followedAt: Math.floor(Date.now() / 1000),
        };

        get().addContact(contact);
        await get().publishContactList();
      },

      unfollowUser: async (pubkey: string) => {
        get().removeContact(pubkey);
        await get().publishContactList();
      },

      blockUser: async (pubkey: string) => {
        const contact = get().contacts.get(pubkey);
        if (contact) {
          get().updateContact(pubkey, {
            relationship: 'blocked',
            blockedAt: Math.floor(Date.now() / 1000),
          });
        } else {
          get().addContact({
            _v: '1.0.0',
            pubkey,
            relationship: 'blocked',
            blockedAt: Math.floor(Date.now() / 1000),
          });
        }
      },

      unblockUser: async (pubkey: string) => {
        const contact = get().contacts.get(pubkey);
        if (contact && contact.followedAt) {
          get().updateContact(pubkey, { relationship: 'following', blockedAt: undefined });
        } else {
          get().removeContact(pubkey);
        }
      },

      muteUser: async (pubkey: string) => {
        get().updateContact(pubkey, {
          mutedAt: Math.floor(Date.now() / 1000),
        });
        // NOTE: NIP-51 mute list (kind 10000) publishing deferred
        // Mutes only affect local contact filtering for now
        // Future: Publish mute list event to relays for cross-device sync
      },

      unmuteUser: async (pubkey: string) => {
        get().updateContact(pubkey, { mutedAt: undefined });
        // NOTE: NIP-51 mute list (kind 10000) publishing deferred
        // Unmutes only affect local contact filtering for now
      },

      getContact: (pubkey: string) => {
        return get().contacts.get(pubkey);
      },

      getFollowing: () => {
        return Array.from(get().contacts.values()).filter(
          (c) => c.relationship === 'following' || c.relationship === 'friend'
        );
      },

      getFollowers: () => {
        return Array.from(get().contacts.values()).filter(
          (c) => c.relationship === 'follower' || c.relationship === 'friend'
        );
      },

      getFriends: () => {
        return Array.from(get().contacts.values()).filter(
          (c) => c.relationship === 'friend'
        );
      },

      getBlocked: () => {
        return Array.from(get().contacts.values()).filter(
          (c) => c.relationship === 'blocked'
        );
      },

      getMuted: () => {
        return Array.from(get().contacts.values()).filter(
          (c) => c.mutedAt !== undefined
        );
      },

      isFollowing: (pubkey: string) => {
        const contact = get().contacts.get(pubkey);
        return contact?.relationship === 'following' || contact?.relationship === 'friend';
      },

      isFriend: (pubkey: string) => {
        return get().contacts.get(pubkey)?.relationship === 'friend';
      },

      syncContacts: async () => {
        set({ loading: true, error: null });
        try {
          const currentIdentity = useAuthStore.getState().currentIdentity;
          if (!currentIdentity) {
            throw new Error('No identity selected');
          }

          const privateKey = getCurrentPrivateKey();
          const nostrClient = getNostrClient();

          // Fetch both encrypted (NIP-51) and plaintext (Kind 3) contact lists
          const [encryptedEvents, plaintextEvents] = await Promise.all([
            nostrClient.query([getEncryptedListFilters(currentIdentity.publicKey, [ENCRYPTED_LIST_KINDS.CONTACT_LIST])]),
            nostrClient.query([getKind3ContactListFilter(currentIdentity.publicKey)]),
          ]);

          // Find the most recent encrypted contact list
          const encryptedEvent = encryptedEvents
            .filter(e => e.kind === ENCRYPTED_LIST_KINDS.CONTACT_LIST)
            .sort((a, b) => b.created_at - a.created_at)[0] || null;

          // Find the most recent Kind 3 contact list
          const kind3Event = plaintextEvents
            .filter(e => e.kind === 3)
            .sort((a, b) => b.created_at - a.created_at)[0] || null;

          let contactEntries: ContactListEntry[] = [];

          // Prefer encrypted list if it's newer or if we have a private key
          if (privateKey && encryptedEvent && isEncryptedListNewer(encryptedEvent, kind3Event)) {
            logger.info('Loading encrypted contact list (NIP-51)');
            const decrypted = decryptContactList(encryptedEvent, privateKey);
            if (decrypted) {
              // Filter out dummy contacts
              contactEntries = filterRealContacts(decrypted);
            } else {
              logger.warn('Failed to decrypt contact list, falling back to Kind 3');
              if (kind3Event) {
                contactEntries = parseKind3ContactList(kind3Event);
              }
            }
          } else if (kind3Event) {
            // Fall back to Kind 3 if no encrypted list or if it's newer
            logger.info('Loading plaintext contact list (Kind 3)');
            contactEntries = parseKind3ContactList(kind3Event);
          }

          // Convert ContactListEntry to Contact map
          const newContacts = new Map<string, Contact>();
          for (const entry of contactEntries) {
            newContacts.set(entry.pubkey, {
              _v: '1.0.0',
              pubkey: entry.pubkey,
              relay: entry.relay,
              petname: entry.petname,
              relationship: 'following',
              followedAt: entry.addedAt,
            });
          }

          set({ contacts: newContacts, loading: false });
          logger.info(`Synced ${newContacts.size} contacts`);
        } catch (error) {
          logger.error('Failed to sync contacts:', error);
          set({ error: (error as Error).message, loading: false });
        }
      },

      syncProfiles: async (pubkeys: string[]) => {
        try {
          const nostrClient = getNostrClient();

          // Fetch profile metadata (kind 0) for given pubkeys
          const profileEvents = await nostrClient.query([{
            kinds: [0],
            authors: pubkeys,
          }]);

          const profiles = new Map(get().profiles);

          for (const event of profileEvents) {
            try {
              const metadata = JSON.parse(event.content);
              profiles.set(event.pubkey, metadata);
            } catch (e) {
              console.error('Failed to parse profile metadata:', e);
            }
          }

          set({ profiles });
        } catch (error) {
          console.error('Failed to sync profiles:', error);
        }
      },

      publishContactList: async () => {
        try {
          const currentIdentity = useAuthStore.getState().currentIdentity;
          if (!currentIdentity) {
            throw new Error('No identity selected');
          }

          const privateKey = getCurrentPrivateKey();
          if (!privateKey) {
            throw new Error('App is locked');
          }

          const following = get().getFollowing();
          const config = get().publishConfig;

          // Convert Contact to ContactListEntry format
          const contactEntries: ContactListEntry[] = following.map(contact => ({
            pubkey: contact.pubkey,
            relay: contact.relay,
            petname: contact.petname,
            addedAt: contact.followedAt || Math.floor(Date.now() / 1000),
          }));

          const nostrClient = getNostrClient();

          // Publish encrypted contact list (NIP-51) if enabled
          if (config.publishEncrypted) {
            // Add dummy contacts for obfuscation if configured
            const obfuscatedEntries = config.dummyContactCount > 0
              ? obfuscateContactList(contactEntries, config.dummyContactCount)
              : contactEntries;

            const encryptedEvent = createContactListEvent(obfuscatedEntries, privateKey);
            await nostrClient.publish(encryptedEvent);
            logger.info(`Published encrypted contact list with ${obfuscatedEntries.length} entries (${contactEntries.length} real, ${config.dummyContactCount} dummy)`);
          }

          // Optionally publish plaintext Kind 3 for backward compatibility
          // WARNING: This exposes the social graph - only enable if user explicitly opts in
          if (config.publishPlaintext) {
            logger.warn('Publishing plaintext Kind 3 contact list (social graph exposed)');
            const kind3Event = createKind3ContactListEvent(
              contactEntries,
              privateKey,
              config.dummyContactCount // Add dummy contacts to plaintext too if configured
            );
            await nostrClient.publish(kind3Event);
          }
        } catch (error) {
          logger.error('Failed to publish contact list:', error);
          throw error;
        }
      },

      addContact: (contact: Contact) => {
        const contacts = new Map(get().contacts);
        contacts.set(contact.pubkey, contact);
        set({ contacts });
      },

      removeContact: (pubkey: string) => {
        const contacts = new Map(get().contacts);
        contacts.delete(pubkey);
        set({ contacts });
      },

      updateContact: (pubkey: string, updates: Partial<Contact>) => {
        const contacts = new Map(get().contacts);
        const existing = contacts.get(pubkey);
        if (existing) {
          contacts.set(pubkey, { ...existing, ...updates });
          set({ contacts });
        }
      },

      setProfile: (pubkey: string, profile: ProfileMetadata) => {
        const profiles = new Map(get().profiles);
        profiles.set(pubkey, profile);
        set({ profiles });
      },

      /**
       * Migrate contacts from Kind 3 plaintext format to encrypted NIP-51 format
       *
       * SECURITY: This is a one-way migration that:
       * 1. Fetches the existing Kind 3 contact list from relays
       * 2. Creates an encrypted NIP-51 version
       * 3. Publishes the encrypted version to relays
       * 4. Does NOT delete the Kind 3 event (relays may still have it)
       *
       * After migration, the encrypted list will be used for future syncs.
       */
      migrateToEncryptedFormat: async () => {
        try {
          const currentIdentity = useAuthStore.getState().currentIdentity;
          if (!currentIdentity) {
            return { success: false, migrated: 0, error: 'No identity selected' };
          }

          const privateKey = getCurrentPrivateKey();
          if (!privateKey) {
            return { success: false, migrated: 0, error: 'App is locked' };
          }

          const nostrClient = getNostrClient();

          // Fetch existing Kind 3 contact list
          const kind3Events = await nostrClient.query([getKind3ContactListFilter(currentIdentity.publicKey)]);
          const kind3Event = kind3Events
            .filter(e => e.kind === 3)
            .sort((a, b) => b.created_at - a.created_at)[0];

          if (!kind3Event) {
            logger.info('No Kind 3 contact list found, nothing to migrate');
            return { success: true, migrated: 0 };
          }

          // Parse contacts from Kind 3
          const contacts = parseKind3ContactList(kind3Event);
          logger.info(`Found ${contacts.length} contacts in Kind 3 list`);

          if (contacts.length === 0) {
            return { success: true, migrated: 0 };
          }

          // Create and publish encrypted version
          const config = get().publishConfig;
          const obfuscatedContacts = config.dummyContactCount > 0
            ? obfuscateContactList(contacts, config.dummyContactCount)
            : contacts;

          const encryptedEvent = createContactListEvent(obfuscatedContacts, privateKey);
          await nostrClient.publish(encryptedEvent);

          logger.info(`Migrated ${contacts.length} contacts to encrypted NIP-51 format`);

          // Update local store with the migrated contacts
          const newContacts = new Map<string, Contact>();
          for (const entry of contacts) {
            newContacts.set(entry.pubkey, {
              _v: '1.0.0',
              pubkey: entry.pubkey,
              relay: entry.relay,
              petname: entry.petname,
              relationship: 'following',
              followedAt: entry.addedAt,
            });
          }
          set({ contacts: newContacts });

          return { success: true, migrated: contacts.length };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          logger.error('Migration failed:', error);
          return { success: false, migrated: 0, error: errorMsg };
        }
      },

      /**
       * Update publish configuration for contact lists
       *
       * Options:
       * - publishEncrypted: Whether to publish encrypted NIP-51 lists (default: true)
       * - publishPlaintext: Whether to also publish Kind 3 for compatibility (default: false)
       * - dummyContactCount: Number of fake contacts for obfuscation (default: 0)
       */
      setPublishConfig: (config: Partial<ContactListPublishConfig>) => {
        const currentConfig = get().publishConfig;
        const newConfig = { ...currentConfig, ...config };
        set({ publishConfig: newConfig });
        logger.info('Contact list publish config updated:', newConfig);
      },

      /**
       * Get the current publish configuration
       */
      getPublishConfig: () => {
        return get().publishConfig;
      },
    })
);
