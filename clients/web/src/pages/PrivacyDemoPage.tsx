/**
 * Privacy Demo Page
 * Demonstrates anonymous engagement and privacy controls
 */

import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageMeta } from '@/components/PageMeta';
import { AnonymousReactions } from '@/components/privacy/AnonymousReactions';
import { AnonymousVoting } from '@/components/privacy/AnonymousVoting';
import { PrivacyDashboard } from '@/components/privacy/PrivacyDashboard';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  ThumbsUp,
  CheckCircle,
  Settings
} from 'lucide-react';

export const PrivacyDemoPage: FC = () => {
  const { t } = useTranslation();
  const [_riskLevel, _setRiskLevel] = useState<'low' | 'medium' | 'high'>('medium');

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageMeta title="Privacy Demo" descriptionKey="meta.privacy" />
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">{t('privacyDemo.title')}</h1>
        <p className="text-muted-foreground">
          {t('privacyDemo.description')}
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="dashboard" className="gap-2">
            <Settings className="w-4 h-4" />
            {t('privacyDemo.tabs.dashboard')}
          </TabsTrigger>
          <TabsTrigger value="reactions" className="gap-2">
            <ThumbsUp className="w-4 h-4" />
            {t('privacyDemo.tabs.reactions')}
          </TabsTrigger>
          <TabsTrigger value="voting" className="gap-2">
            <CheckCircle className="w-4 h-4" />
            {t('privacyDemo.tabs.voting')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <PrivacyDashboard currentMode="normal" riskLevel={_riskLevel} />
        </TabsContent>

        <TabsContent value="reactions" className="mt-6 space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-2">{t('privacyDemo.reactions.samplePost')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('privacyDemo.reactions.sampleContent')}
            </p>

            <AnonymousReactions
              postId="post-1"
              allowAnonymous={true}
              defaultAnonymous={false}
              showAnonymousCounts={true}
            />
          </Card>

          <Card className="p-4 bg-blue-500/5 border-blue-500/20">
            <h4 className="text-sm font-medium mb-1">{t('privacyDemo.reactions.howItWorks')}</h4>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4">
              <li>• {t('privacyDemo.reactions.tips.enableAnonymous')}</li>
              <li>• {t('privacyDemo.reactions.tips.aggregateCounts')}</li>
              <li>• {t('privacyDemo.reactions.tips.critical')}</li>
              <li>• {t('privacyDemo.reactions.tips.cryptoSecured')}</li>
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="voting" className="mt-6 space-y-6">
          <AnonymousVoting
            proposalId="proposal-1"
            proposalTitle="Should we endorse the Housing Justice Bill?"
            proposalDescription="Vote on whether our coalition should publicly endorse the city's Housing Justice Bill. This may draw media attention."
            voteType="yes-no-abstain"
            totalVoters={45}
            hasVoted={false}
            isAnonymous={true}
            showResults={false}
            allowChangeVote={true}
          />

          <Card className="p-4 bg-blue-500/5 border-blue-500/20">
            <h4 className="text-sm font-medium mb-1">{t('privacyDemo.voting.howItWorks')}</h4>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4">
              <li>• {t('privacyDemo.voting.tips.zeroKnowledge')}</li>
              <li>• {t('privacyDemo.voting.tips.noTrace')}</li>
              <li>• {t('privacyDemo.voting.tips.verifiable')}</li>
              <li>• {t('privacyDemo.voting.tips.essential')}</li>
              <li>• {t('privacyDemo.voting.tips.preventIntimidation')}</li>
            </ul>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info Box */}
      <Card className="p-4 bg-purple-500/5 border-purple-500/20">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium mb-1">{t('privacyDemo.whyMatters.title')}</h4>
            <p className="text-xs text-muted-foreground mb-2">
              {t('privacyDemo.whyMatters.intro')}
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4">
              <li>• {t('privacyDemo.whyMatters.consequences.workers')}</li>
              <li>• {t('privacyDemo.whyMatters.consequences.tenants')}</li>
              <li>• {t('privacyDemo.whyMatters.consequences.activists')}</li>
              <li>• {t('privacyDemo.whyMatters.consequences.marginalized')}</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              {t('privacyDemo.whyMatters.conclusion')}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
