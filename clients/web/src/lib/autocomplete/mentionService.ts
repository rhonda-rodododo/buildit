import { useContactsStore } from '@/stores/contactsStore';
import { fuzzySearch, type SearchableItem } from './fuzzySearch';

export interface MentionableUser extends SearchableItem {
  pubkey: string;
  displayName: string;
  avatar?: string;
  petname?: string;
  nip05?: string;
}

export class MentionService {
  /**
   * Get mentionable users from contacts
   */
  static getUsersFromContacts(): MentionableUser[] {
    const { contacts, profiles } = useContactsStore.getState();
    const users: MentionableUser[] = [];

    contacts.forEach((contact) => {
      const profile = profiles.get(contact.pubkey);
      const displayName = profile?.display_name || profile?.name || contact.petname || contact.pubkey.slice(0, 8);

      const searchTerms = [
        displayName,
        contact.petname || '',
        profile?.name || '',
        profile?.display_name || '',
        profile?.nip05 || '',
        contact.pubkey,
      ].filter(Boolean);

      users.push({
        id: contact.pubkey,
        pubkey: contact.pubkey,
        displayName,
        avatar: profile?.picture,
        petname: contact.petname,
        nip05: profile?.nip05,
        searchTerms,
      });
    });

    return users;
  }

  /**
   * Get mentionable users from a specific group
   */
  static getUsersFromGroup(_groupId?: string): MentionableUser[] {
    // For now, fallback to contacts since group members are stored separately
    // This would need to query the group members from the database
    // For this implementation, we'll use contacts as the source
    return this.getUsersFromContacts();
  }

  /**
   * Search for users to mention
   */
  static searchUsers(query: string, groupId?: string): MentionableUser[] {
    const users = groupId
      ? this.getUsersFromGroup(groupId)
      : this.getUsersFromContacts();

    if (!query) return users.slice(0, 10);

    return fuzzySearch(query, users, 0.3).slice(0, 10);
  }

  /**
   * Parse @mentions from text and return an array of mentioned pubkeys
   */
  static parseMentions(text: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const username = match[1];
      // Try to find the user in contacts
      const users = this.getUsersFromContacts();
      const user = users.find(
        (u) =>
          u.displayName.toLowerCase() === username.toLowerCase() ||
          u.petname?.toLowerCase() === username.toLowerCase() ||
          u.pubkey === username
      );

      if (user) {
        mentions.push(user.pubkey);
      }
    }

    return mentions;
  }

  /**
   * Replace @mentions with npub references
   */
  static replaceMentionsWithRefs(text: string): { text: string; mentions: string[] } {
    const mentions: string[] = [];
    const users = this.getUsersFromContacts();

    const replacedText = text.replace(/@(\w+)/g, (match, username) => {
      const user = users.find(
        (u) =>
          u.displayName.toLowerCase() === username.toLowerCase() ||
          u.petname?.toLowerCase() === username.toLowerCase()
      );

      if (user) {
        mentions.push(user.pubkey);
        return `nostr:${user.pubkey}`;
      }

      return match;
    });

    return { text: replacedText, mentions };
  }
}
