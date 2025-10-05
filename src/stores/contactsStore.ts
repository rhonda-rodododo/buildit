import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Contact, ProfileMetadata } from '@/types/contacts';
import { getNostrClient } from '@/core/nostr/client';
import { finalizeEvent } from 'nostr-tools/pure';
import { useAuthStore } from './authStore';

interface ContactsState {
  contacts: Map<string, Contact>; // pubkey -> contact
  profiles: Map<string, ProfileMetadata>; // pubkey -> profile metadata
  loading: boolean;
  error: string | null;

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

  // Internal
  addContact: (contact: Contact) => void;
  removeContact: (pubkey: string) => void;
  updateContact: (pubkey: string, updates: Partial<Contact>) => void;
  setProfile: (pubkey: string, profile: ProfileMetadata) => void;
}

export const useContactsStore = create<ContactsState>()(
  persist(
    (set, get) => ({
      contacts: new Map(),
      profiles: new Map(),
      loading: false,
      error: null,

      followUser: async (pubkey: string, relay?: string, petname?: string) => {
        const contact: Contact = {
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
        // TODO: Publish mute list event
      },

      unmuteUser: async (pubkey: string) => {
        get().updateContact(pubkey, { mutedAt: undefined });
        // TODO: Publish mute list event
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

          const nostrClient = getNostrClient();

          // Fetch contact list (kind 3) for current user
          const contactEvents = await nostrClient.query([{
            kinds: [3],
            authors: [currentIdentity.publicKey],
            limit: 1,
          }]);

          if (contactEvents.length > 0) {
            const contactEvent = contactEvents[0];
            const newContacts = new Map<string, Contact>();

            // Parse p tags
            for (const tag of contactEvent.tags) {
              if (tag[0] === 'p') {
                const [, pubkey, relay, petname] = tag;
                newContacts.set(pubkey, {
                  pubkey,
                  relay,
                  petname,
                  relationship: 'following',
                  followedAt: contactEvent.created_at,
                });
              }
            }

            set({ contacts: newContacts });
          }

          set({ loading: false });
        } catch (error) {
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

          const following = get().getFollowing();
          const tags = following.map((contact) => [
            'p',
            contact.pubkey,
            contact.relay || '',
            contact.petname || '',
          ]);

          const event = finalizeEvent(
            {
              kind: 3,
              tags,
              content: '',
              created_at: Math.floor(Date.now() / 1000),
            },
            currentIdentity.privateKey
          );

          const nostrClient = getNostrClient();
          await nostrClient.publish(event);
        } catch (error) {
          console.error('Failed to publish contact list:', error);
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
    }),
    {
      name: 'contacts-storage',
      partialize: (state) => ({
        contacts: Array.from(state.contacts.entries()),
        profiles: Array.from(state.profiles.entries()),
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Convert arrays back to Maps
          state.contacts = new Map(state.contacts as any);
          state.profiles = new Map(state.profiles as any);
        }
      },
    }
  )
);
