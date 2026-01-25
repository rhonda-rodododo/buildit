/**
 * Campaign Builder Component
 * Create and edit fundraising campaigns
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save } from 'lucide-react';
import { TiersEditor } from './TiersEditor';
import type { Campaign, DonationTier } from '../../types';

interface CampaignBuilderProps {
  campaign?: Campaign;
  onSave: (campaignData: {
    title: string;
    slug: string;
    description: string;
    category: Campaign['category'];
    goal: number;
    currency: string;
    tiers: Omit<DonationTier, 'id' | 'campaignId' | 'currentCount'>[];
  }) => void;
  onCancel: () => void;
}

export function CampaignBuilder({ campaign, onSave, onCancel }: CampaignBuilderProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(campaign?.title || '');
  const [slug, setSlug] = useState(campaign?.slug || '');
  const [description, setDescription] = useState(campaign?.description || '');
  const [category, setCategory] = useState<Campaign['category']>(campaign?.category || 'general');
  const [goal, setGoal] = useState(campaign?.goal ? campaign.goal / 100 : 1000);
  const [currency, setCurrency] = useState(campaign?.currency || 'USD');
  const [tiers, setTiers] = useState<Omit<DonationTier, 'id' | 'campaignId' | 'currentCount'>[]>([]);

  const handleSlugGeneration = (text: string) => {
    const generated = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    setSlug(generated);
  };

  const handleSave = () => {
    onSave({
      title,
      slug,
      description,
      category,
      goal: Math.round(goal * 100), // convert to cents
      currency,
      tiers,
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">
            {campaign ? t('campaignBuilder.editCampaign') : t('campaignBuilder.createCampaign')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('campaignBuilder.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            {t('campaignBuilder.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!title || !slug || goal <= 0}>
            <Save className="h-4 w-4 mr-2" />
            {t('campaignBuilder.saveCampaign')}
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-6">
          {/* Basic Info */}
          <Card className="p-6 space-y-4">
            <h3 className="font-semibold">{t('campaignBuilder.basicInfo')}</h3>

            <div className="space-y-2">
              <Label htmlFor="title">{t('campaignBuilder.campaignTitle')}</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!campaign) handleSlugGeneration(e.target.value);
                }}
                placeholder={t('campaignBuilder.titlePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">{t('campaignBuilder.urlSlug')}</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={t('campaignBuilder.slugPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('campaignBuilder.urlPreview', { slug: slug || 'your-slug' })}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">{t('campaignBuilder.category')}</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Campaign['category'])}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">{t('campaignBuilder.categories.general')}</SelectItem>
                  <SelectItem value="bail">{t('campaignBuilder.categories.bail')}</SelectItem>
                  <SelectItem value="strike">{t('campaignBuilder.categories.strike')}</SelectItem>
                  <SelectItem value="mutual-aid">{t('campaignBuilder.categories.mutual-aid')}</SelectItem>
                  <SelectItem value="legal">{t('campaignBuilder.categories.legal')}</SelectItem>
                  <SelectItem value="emergency">{t('campaignBuilder.categories.emergency')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('campaignBuilder.description')}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('campaignBuilder.descriptionPlaceholder')}
                rows={6}
              />
            </div>
          </Card>

          {/* Goal */}
          <Card className="p-6 space-y-4">
            <h3 className="font-semibold">{t('campaignBuilder.fundraisingGoal')}</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="goal">{t('campaignBuilder.goalAmount')}</Label>
                <Input
                  id="goal"
                  type="number"
                  min={0}
                  step={100}
                  value={goal}
                  onChange={(e) => setGoal(parseFloat(e.target.value) || 0)}
                  placeholder="10000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">{t('campaignBuilder.currency')}</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">{t('campaignBuilder.currencies.usd')}</SelectItem>
                    <SelectItem value="EUR">{t('campaignBuilder.currencies.eur')}</SelectItem>
                    <SelectItem value="GBP">{t('campaignBuilder.currencies.gbp')}</SelectItem>
                    <SelectItem value="CAD">{t('campaignBuilder.currencies.cad')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Donation Tiers */}
          <Card className="p-6">
            <TiersEditor tiers={tiers} onUpdate={setTiers} currency={currency} />
          </Card>
        </div>
      </div>
    </div>
  );
}
