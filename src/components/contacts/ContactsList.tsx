import { FC, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useContactsStore } from '@/stores/contactsStore';
import { UserProfileCard } from './UserProfileCard';
import { Loader2 } from 'lucide-react';

export const ContactsList: FC = () => {
  const { t } = useTranslation();
  const {
    getFollowing,
    getFollowers,
    getFriends,
    profiles,
    contacts,
    loading,
    syncContacts,
    syncProfiles,
  } = useContactsStore();

  useEffect(() => {
    syncContacts();
  }, [syncContacts]);

  useEffect(() => {
    const pubkeys = Array.from(contacts.keys());
    if (pubkeys.length > 0) {
      syncProfiles(pubkeys);
    }
  }, [contacts, syncProfiles]);

  const following = getFollowing();
  const followers = getFollowers();
  const friends = getFriends();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="following" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="following">{t('contactsList.following', { count: following.length })}</TabsTrigger>
        <TabsTrigger value="followers">{t('contactsList.followers', { count: followers.length })}</TabsTrigger>
        <TabsTrigger value="friends">{t('contactsList.friends', { count: friends.length })}</TabsTrigger>
      </TabsList>

      <TabsContent value="following" className="space-y-4">
        {following.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {t('contactsList.emptyFollowing')}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {following.map((contact) => (
              <UserProfileCard
                key={contact.pubkey}
                pubkey={contact.pubkey}
                contact={contact}
                profile={profiles.get(contact.pubkey)}
              />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="followers" className="space-y-4">
        {followers.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {t('contactsList.emptyFollowers')}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {followers.map((contact) => (
              <UserProfileCard
                key={contact.pubkey}
                pubkey={contact.pubkey}
                contact={contact}
                profile={profiles.get(contact.pubkey)}
              />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="friends" className="space-y-4">
        {friends.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {t('contactsList.emptyFriends')}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {friends.map((contact) => (
              <UserProfileCard
                key={contact.pubkey}
                pubkey={contact.pubkey}
                contact={contact}
                profile={profiles.get(contact.pubkey)}
              />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
};
