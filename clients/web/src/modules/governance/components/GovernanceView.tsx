import { FC, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Vote, History, Plus } from 'lucide-react';
import { CreateProposalDialog } from './CreateProposalDialog';
import { useGovernanceStore } from '../governanceStore';

interface GovernanceViewProps {
  groupId?: string;
}

export const GovernanceView: FC<GovernanceViewProps> = ({ groupId = 'global' }) => {
  const { t } = useTranslation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Access raw state to avoid selector instability
  const proposalsRecord = useGovernanceStore(state => state.proposals);

  // Memoize filtered proposals to prevent infinite re-renders
  const { draftProposals, votingProposals, decidedProposals } = useMemo(() => {
    const allProposals = Object.values(proposalsRecord)
      .filter(p => p.groupId === groupId)
      .sort((a, b) => b.createdAt - a.createdAt);

    return {
      draftProposals: allProposals.filter(p => p.status === 'draft'),
      votingProposals: allProposals.filter(p => p.status === 'voting'),
      decidedProposals: allProposals.filter(p =>
        p.status === 'passed' || p.status === 'rejected' || p.status === 'implemented'
      ),
    };
  }, [proposalsRecord, groupId]);

  return (
    <div className="h-full p-4 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('governance.title')}</h2>
          <p className="text-muted-foreground">
            {t('governance.description')}
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('governance.createProposal')}
        </Button>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">{t('governance.activeProposals')}</TabsTrigger>
          <TabsTrigger value="voting">{t('governance.voting')}</TabsTrigger>
          <TabsTrigger value="history">{t('governance.history')}</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {t('governance.draftProposals')}
                </CardTitle>
                <CardDescription>{t('governance.draftProposalsDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                {draftProposals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('governance.noDraftProposals')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {draftProposals.map(proposal => (
                      <div key={proposal.id} className="p-3 border rounded-lg hover:bg-muted/50">
                        <h4 className="font-medium">{proposal.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {(proposal.description ?? '').slice(0, 100)}...
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Vote className="h-5 w-5" />
                  {t('governance.openForVoting')}
                </CardTitle>
                <CardDescription>{t('governance.castYourVote')}</CardDescription>
              </CardHeader>
              <CardContent>
                {votingProposals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('governance.noActiveVotes')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {votingProposals.map(proposal => (
                      <div key={proposal.id} className="p-3 border rounded-lg hover:bg-muted/50">
                        <h4 className="font-medium">{proposal.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {proposal.votingSystem} - {t('governance.ends')} {new Date(proposal.votingPeriod.endsAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="voting" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('governance.votingMethods')}</CardTitle>
              <CardDescription>
                {t('governance.votingMethodsDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-start gap-4 p-4 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">{t('governance.simpleMajority')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('governance.simpleMajorityDesc')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">{t('governance.rankedChoice')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('governance.rankedChoiceDesc')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">{t('governance.quadraticVoting')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('governance.quadraticVotingDesc')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">{t('governance.consensus')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('governance.consensusDesc')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                {t('governance.decisionHistory')}
              </CardTitle>
              <CardDescription>{t('governance.auditTrail')}</CardDescription>
            </CardHeader>
            <CardContent>
              {decidedProposals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('governance.noDecisionHistory')}
                </div>
              ) : (
                <div className="space-y-2">
                  {decidedProposals.map(proposal => (
                    <div key={proposal.id} className="p-3 border rounded-lg">
                      <h4 className="font-medium">{proposal.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('governance.decidedOn')} {new Date(proposal.updatedAt ?? proposal.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateProposalDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        groupId={groupId}
        onCreated={() => {
          // Refresh proposals list
        }}
      />
    </div>
  );
};
