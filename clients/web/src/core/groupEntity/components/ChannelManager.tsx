/**
 * Channel Manager
 * Create and manage role-based messaging channels
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Hash, Plus, Trash2, Lock, Globe } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useGroupEntityStore } from '../groupEntityStore';
import type { Channel, ChannelPermissions } from '../types';

interface ChannelManagerProps {
  groupId: string;
}

export function ChannelManager({ groupId }: ChannelManagerProps) {
  const { t } = useTranslation();
  const { getChannels, createChannel, deleteChannel } = useGroupEntityStore();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<Channel['type']>('member');
  const [groupChannels, setGroupChannels] = useState<Channel[]>([]);

  const loadChannels = useCallback(async () => {
    try {
      const loaded = await getChannels(groupId);
      setGroupChannels(loaded);
    } catch (err) {
      console.error('[Channel] Failed to load:', err);
    }
  }, [getChannels, groupId]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const handleCreate = async () => {
    if (!name.trim()) return;

    const permissions: ChannelPermissions = getDefaultPermissions(type);

    try {
      await createChannel({
        groupId,
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        permissions,
      });

      await loadChannels();
      setIsCreateOpen(false);
      setName('');
      setDescription('');
      setType('member');
    } catch (error) {
      console.error('[Channel] Failed to create:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('channelManager.confirmDelete'))) return;

    try {
      await deleteChannel(id);
      await loadChannels();
    } catch (error) {
      console.error('[Channel] Failed to delete:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              {t('channelManager.title')}
            </CardTitle>
            <CardDescription>
              {t('channelManager.description')}
            </CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t('channelManager.newChannel')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('channelManager.createDialog.title')}</DialogTitle>
                <DialogDescription>
                  {t('channelManager.createDialog.description')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="channel-name">{t('channelManager.createDialog.nameLabel')}</Label>
                  <Input
                    id="channel-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('channelManager.createDialog.namePlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="channel-description">{t('channelManager.createDialog.descriptionLabel')}</Label>
                  <Textarea
                    id="channel-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('channelManager.createDialog.descriptionPlaceholder')}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="channel-type">{t('channelManager.createDialog.typeLabel')}</Label>
                  <Select value={type} onValueChange={(v) => setType(v as Channel['type'])}>
                    <SelectTrigger id="channel-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">{t('channelManager.types.public')}</SelectItem>
                      <SelectItem value="member">{t('channelManager.types.member')}</SelectItem>
                      <SelectItem value="admin-only">{t('channelManager.types.adminOnly')}</SelectItem>
                      <SelectItem value="role-based">{t('channelManager.types.roleBased')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {type === 'public' && t('channelManager.typeDescriptions.public')}
                    {type === 'member' && t('channelManager.typeDescriptions.member')}
                    {type === 'admin-only' && t('channelManager.typeDescriptions.adminOnly')}
                    {type === 'role-based' && t('channelManager.typeDescriptions.roleBased')}
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    {t('channelManager.buttons.cancel')}
                  </Button>
                  <Button onClick={handleCreate} disabled={!name.trim()}>
                    {t('channelManager.buttons.create')}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {groupChannels.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Hash className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>{t('channelManager.empty.title')}</p>
            <p className="text-sm mt-1">
              {t('channelManager.empty.description')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {groupChannels.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                onDelete={handleDelete}
                t={t}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ChannelCardProps {
  channel: Channel;
  onDelete: (id: string) => void;
  t: (key: string) => string;
}

function ChannelCard({ channel, onDelete, t }: ChannelCardProps) {
  const getIcon = () => {
    switch (channel.type) {
      case 'public':
        return <Globe className="h-4 w-4" />;
      case 'admin-only':
        return <Lock className="h-4 w-4" />;
      default:
        return <Hash className="h-4 w-4" />;
    }
  };

  const getTypeLabel = () => {
    switch (channel.type) {
      case 'public':
        return t('channelManager.typeLabels.public');
      case 'member':
        return t('channelManager.typeLabels.member');
      case 'admin-only':
        return t('channelManager.typeLabels.adminOnly');
      case 'role-based':
        return t('channelManager.typeLabels.roleBased');
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent cursor-pointer">
      <div className="text-muted-foreground">{getIcon()}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{channel.name}</span>
          <Badge variant="secondary" className="text-xs">
            {getTypeLabel()}
          </Badge>
        </div>
        {channel.description && (
          <p className="text-sm text-muted-foreground">{channel.description}</p>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(channel.id);
        }}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

function getDefaultPermissions(type: Channel['type']): ChannelPermissions {
  switch (type) {
    case 'public':
      return {
        canRead: ['admin', 'moderator', 'member', 'read-only'],
        canPost: ['admin', 'moderator', 'member'],
        canInvite: ['admin', 'moderator'],
        canManage: ['admin'],
      };
    case 'member':
      return {
        canRead: ['admin', 'moderator', 'member'],
        canPost: ['admin', 'moderator', 'member'],
        canInvite: ['admin', 'moderator'],
        canManage: ['admin'],
      };
    case 'admin-only':
      return {
        canRead: ['admin'],
        canPost: ['admin'],
        canInvite: ['admin'],
        canManage: ['admin'],
      };
    case 'role-based':
      return {
        canRead: ['admin', 'moderator'],
        canPost: ['admin', 'moderator'],
        canInvite: ['admin'],
        canManage: ['admin'],
      };
  }
}
