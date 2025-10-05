import { FC } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus, UserMinus, Shield } from 'lucide-react';
import { useContactsStore } from '@/stores/contactsStore';
import type { Contact, ProfileMetadata } from '@/types/contacts';

interface UserProfileCardProps {
  pubkey: string;
  contact?: Contact;
  profile?: ProfileMetadata;
  onFollow?: () => void;
  onUnfollow?: () => void;
  onBlock?: () => void;
}

export const UserProfileCard: FC<UserProfileCardProps> = ({
  pubkey,
  contact,
  profile,
  onFollow,
  onUnfollow,
  onBlock,
}) => {
  const { isFollowing, followUser, unfollowUser, blockUser } = useContactsStore();
  const following = isFollowing(pubkey);

  const displayName = profile?.display_name || profile?.name || contact?.petname || pubkey.slice(0, 8);
  const avatar = profile?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${pubkey}`;

  const handleFollow = async () => {
    await followUser(pubkey);
    onFollow?.();
  };

  const handleUnfollow = async () => {
    await unfollowUser(pubkey);
    onUnfollow?.();
  };

  const handleBlock = async () => {
    await blockUser(pubkey);
    onBlock?.();
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-4">
          <img
            src={avatar}
            alt={displayName}
            className="w-12 h-12 rounded-full bg-muted"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{displayName}</h3>
            <p className="text-sm text-muted-foreground truncate font-mono">
              {pubkey.slice(0, 16)}...
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {profile?.about && (
          <p className="text-sm text-muted-foreground line-clamp-2">{profile.about}</p>
        )}
        <div className="flex gap-2">
          {following ? (
            <Button variant="outline" size="sm" onClick={handleUnfollow} className="flex-1">
              <UserMinus className="w-4 h-4 mr-2" />
              Unfollow
            </Button>
          ) : (
            <Button variant="default" size="sm" onClick={handleFollow} className="flex-1">
              <UserPlus className="w-4 h-4 mr-2" />
              Follow
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleBlock}>
            <Shield className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
