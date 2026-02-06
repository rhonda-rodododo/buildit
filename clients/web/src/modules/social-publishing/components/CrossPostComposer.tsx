/**
 * CrossPostComposer Component
 *
 * Side-by-side preview of how content will appear on each platform.
 * Per-platform content editing with character count validation.
 *
 * Privacy: No platform SDKs, no embed previews. Just plain text
 * formatting that matches each platform's constraints.
 */

import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Radio,
  Globe,
  AtSign,
  Rss,
  Hash,
} from 'lucide-react';

type PlatformId = 'nostr' | 'activitypub' | 'atproto' | 'rss';

interface PlatformState {
  platform: PlatformId;
  enabled: boolean;
  customContent: string;
}

interface CrossPostComposerProps {
  /** Default content shared across all platforms */
  defaultContent: string;
  /** Called when platform config changes */
  onChange: (platforms: PlatformState[]) => void;
  /** Current platform states (controlled) */
  value?: PlatformState[];
  className?: string;
}

const PLATFORM_CONFIG: Record<PlatformId, {
  label: string;
  icon: FC<{ className?: string }>;
  charLimit?: number;
  description: string;
  hashtagStyle: 'nostr' | 'standard';
}> = {
  nostr: {
    label: 'Nostr',
    icon: Radio,
    description: 'Decentralized social protocol',
    hashtagStyle: 'nostr',
  },
  activitypub: {
    label: 'ActivityPub (Mastodon)',
    icon: Globe,
    charLimit: 500,
    description: 'Mastodon, Pleroma, Misskey, and other federated platforms',
    hashtagStyle: 'standard',
  },
  atproto: {
    label: 'AT Protocol (Bluesky)',
    icon: AtSign,
    charLimit: 300,
    description: 'Bluesky and AT Protocol apps',
    hashtagStyle: 'standard',
  },
  rss: {
    label: 'RSS Feed',
    icon: Rss,
    description: 'RSS/Atom feed for subscribers',
    hashtagStyle: 'standard',
  },
};

const DEFAULT_PLATFORMS: PlatformState[] = [
  { platform: 'nostr', enabled: true, customContent: '' },
  { platform: 'activitypub', enabled: false, customContent: '' },
  { platform: 'atproto', enabled: false, customContent: '' },
  { platform: 'rss', enabled: false, customContent: '' },
];

export const CrossPostComposer: FC<CrossPostComposerProps> = ({
  defaultContent,
  onChange,
  value,
  className,
}) => {
  const { t } = useTranslation();
  const [internalState, setInternalState] = useState<PlatformState[]>(DEFAULT_PLATFORMS);

  const platforms = value || internalState;

  const updatePlatforms = (newPlatforms: PlatformState[]) => {
    if (!value) setInternalState(newPlatforms);
    onChange(newPlatforms);
  };

  const togglePlatform = (platformId: PlatformId) => {
    updatePlatforms(
      platforms.map((p) =>
        p.platform === platformId ? { ...p, enabled: !p.enabled } : p
      )
    );
  };

  const updateContent = (platformId: PlatformId, content: string) => {
    updatePlatforms(
      platforms.map((p) =>
        p.platform === platformId ? { ...p, customContent: content } : p
      )
    );
  };

  const enabledPlatforms = platforms.filter((p) => p.enabled);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Globe className="h-5 w-5" />
          {t('social-publishing.crossPost.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Platform toggles */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {platforms.map((state) => {
            const config = PLATFORM_CONFIG[state.platform];
            const Icon = config.icon;
            return (
              <div
                key={state.platform}
                className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${
                  state.enabled
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
                onClick={() => togglePlatform(state.platform)}
              >
                <Checkbox checked={state.enabled} />
                <Icon className="h-4 w-4 shrink-0" />
                <span className="text-sm truncate">{config.label.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>

        {enabledPlatforms.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Select at least one platform
          </p>
        )}

        {/* Per-platform previews */}
        {enabledPlatforms.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            {enabledPlatforms.map((state) => {
              const config = PLATFORM_CONFIG[state.platform];
              const Icon = config.icon;
              const content = state.customContent || defaultContent;
              const isOverLimit = config.charLimit
                ? content.length > config.charLimit
                : false;

              return (
                <div key={state.platform} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{config.label}</span>
                    </div>
                    {config.charLimit && (
                      <Badge
                        variant={isOverLimit ? 'destructive' : 'outline'}
                        className="text-xs"
                      >
                        {content.length}/{config.charLimit}
                      </Badge>
                    )}
                  </div>

                  <Textarea
                    value={state.customContent}
                    onChange={(e) => updateContent(state.platform, e.target.value)}
                    placeholder={defaultContent || `Content for ${config.label}...`}
                    rows={4}
                    className={`text-sm ${isOverLimit ? 'border-destructive' : ''}`}
                  />

                  {/* Platform preview card */}
                  <div className="border rounded-lg p-3 bg-muted/30 text-sm">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Icon className="h-3 w-3" />
                      {t('social-publishing.crossPost.preview')} — {config.label}
                    </div>
                    <p className="whitespace-pre-wrap text-xs leading-relaxed">
                      {content || '(empty)'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Hashtag suggestions */}
        {defaultContent && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Hash className="h-4 w-4" />
              Detected hashtags
            </div>
            <div className="flex flex-wrap gap-1">
              {extractHashtags(defaultContent).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  #{tag}
                </Badge>
              ))}
              {extractHashtags(defaultContent).length === 0 && (
                <span className="text-xs text-muted-foreground">No hashtags found</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

function extractHashtags(text: string): string[] {
  const matches = text.match(/#(\w+)/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1)))];
}
