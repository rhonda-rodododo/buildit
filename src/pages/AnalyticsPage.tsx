/**
 * Analytics Page
 * Main page for viewing CRM and Campaign analytics
 */

import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageMeta } from '@/components/PageMeta';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CRMAnalytics } from '@/components/analytics/CRMAnalytics';
import { CampaignAnalytics } from '@/components/analytics/CampaignAnalytics';
import { BarChart3, Users } from 'lucide-react';

export const AnalyticsPage: FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('crm');

  return (
    <div className="space-y-6">
      <PageMeta titleKey="crm.title" descriptionKey="meta.analytics" path="/app/analytics" />
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{t('analyticsPage.title')}</h1>
        <p className="text-muted-foreground">
          {t('analyticsPage.subtitle')}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="crm" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            {t('analyticsPage.tabs.crm')}
          </TabsTrigger>
          <TabsTrigger value="campaign" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            {t('analyticsPage.tabs.campaign')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="crm">
          <CRMAnalytics />
        </TabsContent>

        <TabsContent value="campaign">
          <CampaignAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
};
