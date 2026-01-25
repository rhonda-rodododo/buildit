/**
 * SEO Controls Component
 * Edit SEO metadata and indexability settings for public pages
 */

import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
          <h3 className="font-semibold">{t('seoControls.indexability')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('seoControls.indexabilityDesc')}
          </p>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="search-indexable">{t('seoControls.searchEngine')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('seoControls.searchEngineDesc')}
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
                <Label htmlFor="ai-indexable">{t('seoControls.aiTraining')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('seoControls.aiTrainingDesc')}
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
                <Label htmlFor="no-archive">{t('seoControls.preventArchiving')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('seoControls.preventArchivingDesc')}
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
              {t('seoControls.aiDisabledNote')}
            </p>
          )}
        </Card>
      )}

      {/* Basic SEO */}
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold">{t('seoControls.basicSeo')}</h3>

        <div className="space-y-2">
          <Label htmlFor="seo-title">{t('seoControls.pageTitle')}</Label>
          <Input
            id="seo-title"
            value={seo.title || ''}
            onChange={(e) => handleUpdate({ title: e.target.value })}
            placeholder={t('seoControls.pageTitlePlaceholder')}
            maxLength={60}
          />
          <p className="text-xs text-muted-foreground">
            {t('seoControls.characters', { count: (seo.title || '').length, max: 60, optimal: '50-60' })}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="seo-description">{t('seoControls.metaDescription')}</Label>
          <Textarea
            id="seo-description"
            value={seo.description || ''}
            onChange={(e) => handleUpdate({ description: e.target.value })}
            placeholder={t('seoControls.metaDescPlaceholder')}
            maxLength={160}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            {t('seoControls.characters', { count: (seo.description || '').length, max: 160, optimal: '150-160' })}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="seo-robots">{t('seoControls.robots')}</Label>
          <Select value={seo.robots || 'index, follow'} onValueChange={(v) => handleUpdate({ robots: v })}>
            <SelectTrigger id="seo-robots">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="index, follow">{t('seoControls.indexFollow')}</SelectItem>
              <SelectItem value="noindex, follow">{t('seoControls.noIndexFollow')}</SelectItem>
              <SelectItem value="index, nofollow">{t('seoControls.indexNoFollow')}</SelectItem>
              <SelectItem value="noindex, nofollow">{t('seoControls.noIndexNoFollow')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Open Graph */}
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold">{t('seoControls.openGraph')}</h3>

        <div className="space-y-2">
          <Label htmlFor="og-title">{t('seoControls.ogTitle')}</Label>
          <Input
            id="og-title"
            value={seo.ogTitle || ''}
            onChange={(e) => handleUpdate({ ogTitle: e.target.value })}
            placeholder={t('seoControls.ogTitlePlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="og-description">{t('seoControls.ogDescription')}</Label>
          <Textarea
            id="og-description"
            value={seo.ogDescription || ''}
            onChange={(e) => handleUpdate({ ogDescription: e.target.value })}
            placeholder={t('seoControls.ogDescPlaceholder')}
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="og-image">{t('seoControls.ogImage')}</Label>
          <Input
            id="og-image"
            value={seo.ogImage || ''}
            onChange={(e) => handleUpdate({ ogImage: e.target.value })}
            placeholder="https://example.com/image.jpg"
          />
          <p className="text-xs text-muted-foreground">
            {t('seoControls.recommended', { size: '1200x630px' })}
          </p>
        </div>
      </Card>

      {/* Twitter Card */}
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold">{t('seoControls.twitterCard')}</h3>

        <div className="space-y-2">
          <Label htmlFor="twitter-card">{t('seoControls.cardType')}</Label>
          <Select
            value={seo.twitterCard || 'summary'}
            onValueChange={(v) => handleUpdate({ twitterCard: v as SEOMetadata['twitterCard'] })}
          >
            <SelectTrigger id="twitter-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="summary">{t('seoControls.summary')}</SelectItem>
              <SelectItem value="summary_large_image">{t('seoControls.summaryLargeImage')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="twitter-site">{t('seoControls.twitterSite')}</Label>
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
