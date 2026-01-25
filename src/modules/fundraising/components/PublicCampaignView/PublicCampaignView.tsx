/**
 * Public Campaign View Component
 * Public-facing fundraising campaign page
 */

import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { DollarSign } from 'lucide-react';
import type { Campaign, DonationTier } from '../../types';
import { sanitizeHtml } from '@/lib/security/sanitize';

interface PublicCampaignViewProps {
  campaign: Campaign;
  tiers: DonationTier[];
  onDonate: (tierId?: string) => void;
}

export function PublicCampaignView({ campaign, tiers, onDonate }: PublicCampaignViewProps) {
  const { t } = useTranslation();
  const progress = (campaign.currentAmount / campaign.goal) * 100;
  const raised = (campaign.currentAmount / 100).toFixed(2);
  const goal = (campaign.goal / 100).toFixed(2);
  const currencySymbol = campaign.currency === 'USD' ? '$' : campaign.currency;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Hero */}
      <Card className="p-8">
        <div className="space-y-4">
          <div>
            <Badge>{campaign.category}</Badge>
            <h1 className="text-3xl font-bold mt-2">{campaign.title}</h1>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold">
                {currencySymbol}{raised}
              </div>
              <div className="text-muted-foreground">
                {t('publicCampaignView.goal', { goal: `${currencySymbol}${goal}` })}
              </div>
            </div>
            <Progress value={Math.min(progress, 100)} className="h-3" />
            <div className="text-sm text-muted-foreground">
              {t('publicCampaignView.funded', { percent: progress.toFixed(0) })}
            </div>
          </div>

          {/* Description - Sanitized to prevent XSS */}
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(campaign.description) }} />
        </div>
      </Card>

      {/* Donation Tiers */}
      {tiers.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">{t('publicCampaignView.supportCampaign')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tiers.map((tier) => (
              <Card
                key={tier.id}
                className={`p-6 cursor-pointer hover:border-primary transition-colors ${
                  tier.featured ? 'border-primary border-2' : ''
                }`}
                onClick={() => onDonate(tier.id)}
              >
                <div className="space-y-4">
                  <div>
                    <div className="text-2xl font-bold">
                      {currencySymbol}{(tier.amount / 100).toFixed(2)}
                    </div>
                    <div className="font-medium mt-1">{tier.name}</div>
                  </div>

                  {tier.description && (
                    <p className="text-sm text-muted-foreground">{tier.description}</p>
                  )}

                  {tier.limited && tier.maxCount && (
                    <div className="text-xs text-muted-foreground">
                      {t('publicCampaignView.claimed', { current: tier.currentCount, max: tier.maxCount })}
                    </div>
                  )}

                  <Button
                    className="w-full"
                    disabled={tier.limited && tier.maxCount !== undefined && tier.currentCount >= tier.maxCount}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    {t('publicCampaignView.donate')}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Custom Amount */}
      {campaign.allowCustomAmount && (
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{t('publicCampaignView.customAmount.title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('publicCampaignView.customAmount.description')}
              </p>
            </div>
            <Button onClick={() => onDonate()}>
              {t('publicCampaignView.customAmount.button')}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
