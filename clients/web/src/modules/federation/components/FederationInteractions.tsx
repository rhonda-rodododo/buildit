/**
 * Federation Interactions Panel
 *
 * Shows incoming replies, likes, and reposts from Mastodon and Bluesky.
 */

import { FC, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { Globe, CloudLightning, Heart, MessageCircle, Repeat2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useFederationStore } from '../federationStore';
import { useAuthStore } from '@/stores/authStore';
import type { FederationInteraction } from '../types';

export const FederationInteractions: FC = () => {
  const { t } = useTranslation('federation');
  const { interactions, loading, fetchInteractions } = useFederationStore();
  const pubkey = useAuthStore((s) => s.currentIdentity?.publicKey);

  useEffect(() => {
    if (pubkey) {
      fetchInteractions(pubkey);
    }
  }, [pubkey, fetchInteractions]);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded" />
          ))}
        </div>
      </Card>
    );
  }

  if (interactions.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground text-center">
          {t('interactions.empty')}
        </p>
      </Card>
    );
  }

  return (
    <Card className="divide-y">
      {interactions.map((interaction) => (
        <InteractionRow key={interaction.id} interaction={interaction} />
      ))}
    </Card>
  );
};

const InteractionRow: FC<{ interaction: FederationInteraction }> = ({ interaction }) => {
  const { t } = useTranslation('federation');

  const ProtocolIcon = interaction.sourceProtocol === 'activitypub' ? Globe : CloudLightning;
  const protocolColor = interaction.sourceProtocol === 'activitypub' ? 'text-purple-500' : 'text-blue-500';

  const TypeIcon = {
    reply: MessageCircle,
    like: Heart,
    repost: Repeat2,
  }[interaction.interactionType];

  return (
    <div className="p-4 flex items-start gap-3">
      <Avatar className="w-8 h-8">
        <AvatarFallback>
          {(interaction.sourceActorName ?? '?').slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium truncate">
            {interaction.sourceActorName ?? t('interactions.unknownUser')}
          </span>
          <ProtocolIcon className={`w-3 h-3 ${protocolColor}`} />
          <TypeIcon className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {interaction.receivedAt && formatDistanceToNow(new Date(interaction.receivedAt), { addSuffix: true })}
          </span>
        </div>
        {interaction.content && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {interaction.content}
          </p>
        )}
      </div>
      {interaction.sourceUrl && (
        <a
          href={interaction.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline shrink-0"
          aria-label={t('interactions.viewOnPlatform')}
        >
          {t('interactions.view')}
        </a>
      )}
    </div>
  );
};
