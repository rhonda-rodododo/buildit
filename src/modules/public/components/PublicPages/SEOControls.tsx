/**
 * SEO Controls Component
 * Edit SEO metadata and indexability settings for public pages
 */

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { SEOMetadata, IndexabilitySettings } from '../../types';
import { DEFAULT_INDEXABILITY } from '@/types/indexability';

interface SEOControlsProps {
  seo: SEOMetadata;
  onUpdate: (seo: SEOMetadata) => void;
  indexability?: IndexabilitySettings;
  onIndexabilityUpdate?: (indexability: IndexabilitySettings) => void;
}

export function SEOControls({ seo, onUpdate, indexability, onIndexabilityUpdate }: SEOControlsProps) {
  const handleUpdate = (updates: Partial<SEOMetadata>) => {
    onUpdate({ ...seo, ...updates });
  };

  const currentIndexability = indexability ?? DEFAULT_INDEXABILITY;

  const handleIndexabilityUpdate = (updates: Partial<IndexabilitySettings>) => {
    if (onIndexabilityUpdate) {
      onIndexabilityUpdate({ ...currentIndexability, ...updates });
    }
  };

  return (
    <div className="space-y-6">
      {/* Indexability Controls */}
      {onIndexabilityUpdate && (
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold">Indexability</h3>
          <p className="text-sm text-muted-foreground">
            Control how search engines and AI systems can access this content.
          </p>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="search-indexable">Search Engine Indexing</Label>
                <p className="text-xs text-muted-foreground">
                  Allow Google, Bing, DuckDuckGo and other search engines to index this page
                </p>
              </div>
              <Switch
                id="search-indexable"
                checked={currentIndexability.isSearchIndexable}
                onCheckedChange={(checked) => handleIndexabilityUpdate({ isSearchIndexable: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="ai-indexable">AI Training / Indexing</Label>
                <p className="text-xs text-muted-foreground">
                  Allow AI crawlers (GPTBot, Claude, etc.) to use this content for training
                </p>
              </div>
              <Switch
                id="ai-indexable"
                checked={currentIndexability.isAiIndexable}
                onCheckedChange={(checked) => handleIndexabilityUpdate({ isAiIndexable: checked })}
                disabled={!currentIndexability.isSearchIndexable}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="no-archive">Prevent Archiving</Label>
                <p className="text-xs text-muted-foreground">
                  Block archive.org and similar services from caching this page
                </p>
              </div>
              <Switch
                id="no-archive"
                checked={currentIndexability.noArchive ?? false}
                onCheckedChange={(checked) => handleIndexabilityUpdate({ noArchive: checked })}
              />
            </div>
          </div>

          {!currentIndexability.isSearchIndexable && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Note: AI indexing is automatically disabled when search engine indexing is off.
            </p>
          )}
        </Card>
      )}

      {/* Basic SEO */}
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold">Basic SEO</h3>

        <div className="space-y-2">
          <Label htmlFor="seo-title">Page Title</Label>
          <Input
            id="seo-title"
            value={seo.title || ''}
            onChange={(e) => handleUpdate({ title: e.target.value })}
            placeholder="Page title for search engines"
            maxLength={60}
          />
          <p className="text-xs text-muted-foreground">
            {(seo.title || '').length}/60 characters (optimal: 50-60)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="seo-description">Meta Description</Label>
          <Textarea
            id="seo-description"
            value={seo.description || ''}
            onChange={(e) => handleUpdate({ description: e.target.value })}
            placeholder="Brief description for search results"
            maxLength={160}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            {(seo.description || '').length}/160 characters (optimal: 150-160)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="seo-robots">Robots</Label>
          <Select value={seo.robots || 'index, follow'} onValueChange={(v) => handleUpdate({ robots: v })}>
            <SelectTrigger id="seo-robots">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="index, follow">Index, Follow (default)</SelectItem>
              <SelectItem value="noindex, follow">No Index, Follow</SelectItem>
              <SelectItem value="index, nofollow">Index, No Follow</SelectItem>
              <SelectItem value="noindex, nofollow">No Index, No Follow</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Open Graph */}
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold">Open Graph (Social Sharing)</h3>

        <div className="space-y-2">
          <Label htmlFor="og-title">OG Title</Label>
          <Input
            id="og-title"
            value={seo.ogTitle || ''}
            onChange={(e) => handleUpdate({ ogTitle: e.target.value })}
            placeholder="Title for social media shares"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="og-description">OG Description</Label>
          <Textarea
            id="og-description"
            value={seo.ogDescription || ''}
            onChange={(e) => handleUpdate({ ogDescription: e.target.value })}
            placeholder="Description for social media shares"
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="og-image">OG Image URL</Label>
          <Input
            id="og-image"
            value={seo.ogImage || ''}
            onChange={(e) => handleUpdate({ ogImage: e.target.value })}
            placeholder="https://example.com/image.jpg"
          />
          <p className="text-xs text-muted-foreground">
            Recommended: 1200x630px
          </p>
        </div>
      </Card>

      {/* Twitter Card */}
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold">Twitter Card</h3>

        <div className="space-y-2">
          <Label htmlFor="twitter-card">Card Type</Label>
          <Select
            value={seo.twitterCard || 'summary'}
            onValueChange={(v) => handleUpdate({ twitterCard: v as SEOMetadata['twitterCard'] })}
          >
            <SelectTrigger id="twitter-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="summary">Summary</SelectItem>
              <SelectItem value="summary_large_image">Summary Large Image</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="twitter-site">Twitter Site Handle</Label>
          <Input
            id="twitter-site"
            value={seo.twitterSite || ''}
            onChange={(e) => handleUpdate({ twitterSite: e.target.value })}
            placeholder="@yourhandle"
          />
        </div>
      </Card>
    </div>
  );
}
