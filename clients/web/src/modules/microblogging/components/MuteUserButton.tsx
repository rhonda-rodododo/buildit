/**
 * Mute User Button Component
 * Epic 61: Toggle mute status for a user
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VolumeX, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSocialFeaturesStore } from '../socialFeaturesStore';
import { cn } from '@/lib/utils';

interface MuteUserButtonProps {
  userId: string;
  userName?: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'icon';
  showLabel?: boolean;
  className?: string;
}

export function MuteUserButton({
  userId,
  userName,
  variant = 'ghost',
  size = 'sm',
  showLabel = true,
  className,
}: MuteUserButtonProps) {
  const { t } = useTranslation();
  const isMuted = useSocialFeaturesStore((s) => s.isMuted);
  const muteUser = useSocialFeaturesStore((s) => s.muteUser);
  const unmuteUser = useSocialFeaturesStore((s) => s.unmuteUser);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const muted = isMuted(userId);
  const displayName = userName || userId.slice(0, 12) + '...';

  const handleToggle = async () => {
    if (muted) {
      // Unmute directly without confirmation
      setIsLoading(true);
      try {
        await unmuteUser(userId);
      } catch (error) {
        console.error('Failed to unmute user:', error);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Show confirmation for mute
      setShowConfirmDialog(true);
    }
  };

  const handleConfirmMute = async () => {
    setIsLoading(true);
    try {
      await muteUser(userId);
    } catch (error) {
      console.error('Failed to mute user:', error);
    } finally {
      setIsLoading(false);
      setShowConfirmDialog(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleToggle}
        disabled={isLoading}
        className={cn(
          muted && 'text-muted-foreground',
          className
        )}
      >
        {muted ? (
          <>
            <Volume2 className="h-4 w-4" />
            {showLabel && size !== 'icon' && (
              <span className="ml-2">{t('moderation.unmute', 'Unmute')}</span>
            )}
          </>
        ) : (
          <>
            <VolumeX className="h-4 w-4" />
            {showLabel && size !== 'icon' && (
              <span className="ml-2">{t('moderation.mute', 'Mute')}</span>
            )}
          </>
        )}
      </Button>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('moderation.muteUser', 'Mute {{name}}?', { name: displayName })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'moderation.muteDescription',
                'You won\'t see posts, comments, or stories from this user. They won\'t be notified that you\'ve muted them.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmMute} disabled={isLoading}>
              {isLoading
                ? t('moderation.muting', 'Muting...')
                : t('moderation.mute', 'Mute')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
