/**
 * Federation Status Badge
 *
 * Shows AP and/or Bluesky icons on posts that have been federated.
 */

import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, CloudLightning } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FederationStatusBadgeProps {
  apFederated?: boolean;
  atFederated?: boolean;
  className?: string;
}

export const FederationStatusBadge: FC<FederationStatusBadgeProps> = ({
  apFederated,
  atFederated,
  className = '',
}) => {
  const { t } = useTranslation('federation');

  if (!apFederated && !atFederated) return null;

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {apFederated && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="text-purple-500"
              aria-label={t('badge.activityPub')}
            >
              <Globe className="w-3 h-3" />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{t('badge.activityPubTooltip')}</p>
          </TooltipContent>
        </Tooltip>
      )}
      {atFederated && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="text-blue-500"
              aria-label={t('badge.bluesky')}
            >
              <CloudLightning className="w-3 h-3" />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{t('badge.blueskyTooltip')}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </span>
  );
};
