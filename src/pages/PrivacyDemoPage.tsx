/**
 * Privacy Demo Page
 * Demonstrates anonymous engagement and privacy controls
 */

import { FC, useState } from 'react';
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
  const [_riskLevel, _setRiskLevel] = useState<'low' | 'medium' | 'high'>('medium');

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Privacy & Anonymous Engagement</h1>
        <p className="text-muted-foreground">
          Safe participation for high-risk organizing contexts
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="dashboard" className="gap-2">
            <Settings className="w-4 h-4" />
            Privacy Dashboard
          </TabsTrigger>
          <TabsTrigger value="reactions" className="gap-2">
            <ThumbsUp className="w-4 h-4" />
            Anonymous Reactions
          </TabsTrigger>
          <TabsTrigger value="voting" className="gap-2">
            <CheckCircle className="w-4 h-4" />
            Anonymous Voting
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <PrivacyDashboard currentMode="normal" riskLevel={_riskLevel} />
        </TabsContent>

        <TabsContent value="reactions" className="mt-6 space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-2">Sample Post</h3>
            <p className="text-sm text-muted-foreground mb-4">
              "We're organizing a direct action next week to protest the evictions. All are welcome to join - safety protocols will be provided."
            </p>

            <AnonymousReactions
              postId="post-1"
              allowAnonymous={true}
              defaultAnonymous={false}
              showAnonymousCounts={true}
            />
          </Card>

          <Card className="p-4 bg-blue-500/5 border-blue-500/20">
            <h4 className="text-sm font-medium mb-1">How Anonymous Reactions Work</h4>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4">
              <li>• Enable anonymous mode to hide your identity while showing support</li>
              <li>• Aggregate counts are still shown to demonstrate community backing</li>
              <li>• Critical for high-risk campaigns where public support could lead to retaliation</li>
              <li>• Cryptographically secured to prevent de-anonymization</li>
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
            <h4 className="text-sm font-medium mb-1">How Anonymous Voting Works</h4>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4">
              <li>• Zero-knowledge cryptography ensures vote privacy</li>
              <li>• Individual votes cannot be traced to voters</li>
              <li>• Results are verifiably accurate despite anonymity</li>
              <li>• Essential for sensitive decisions in high-risk organizing</li>
              <li>• Prevents intimidation and enables honest participation</li>
            </ul>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info Box */}
      <Card className="p-4 bg-purple-500/5 border-purple-500/20">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium mb-1">Why Anonymous Engagement Matters</h4>
            <p className="text-xs text-muted-foreground mb-2">
              In high-risk organizing contexts (surveillance states, workplace organizing, tenant unions facing retaliation),
              visible support can have serious consequences:
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4">
              <li>• Workers organizing a union may face termination</li>
              <li>• Tenants fighting evictions may be blacklisted</li>
              <li>• Activists in authoritarian states risk arrest</li>
              <li>• Marginalized communities face disproportionate surveillance</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              Anonymous engagement tools allow these supporters to participate safely while still building collective power.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
