import { FC, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileText, Vote, History, Plus } from 'lucide-react'
import { CreateProposalDialog } from './CreateProposalDialog'
import { useGovernanceStore } from '../governanceStore'

interface GovernanceViewProps {
  groupId?: string
}

export const GovernanceView: FC<GovernanceViewProps> = ({ groupId = 'global' }) => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const draftProposals = useGovernanceStore(state =>
    state.getProposalsByStatus(groupId, 'draft')
  )
  const votingProposals = useGovernanceStore(state =>
    state.getProposalsByStatus(groupId, 'voting')
  )
  const decidedProposals = useGovernanceStore(state =>
    state.getProposalsByStatus(groupId, 'decided')
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Governance</h2>
          <p className="text-muted-foreground">
            Democratic decision-making and collective governance
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Proposal
        </Button>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active Proposals</TabsTrigger>
          <TabsTrigger value="voting">Voting</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Draft Proposals
                </CardTitle>
                <CardDescription>Proposals under discussion</CardDescription>
              </CardHeader>
              <CardContent>
                {draftProposals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No draft proposals
                  </div>
                ) : (
                  <div className="space-y-2">
                    {draftProposals.map(proposal => (
                      <div key={proposal.id} className="p-3 border rounded-lg hover:bg-muted/50">
                        <h4 className="font-medium">{proposal.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {proposal.description.slice(0, 100)}...
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
                  Open for Voting
                </CardTitle>
                <CardDescription>Cast your vote</CardDescription>
              </CardHeader>
              <CardContent>
                {votingProposals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No active votes
                  </div>
                ) : (
                  <div className="space-y-2">
                    {votingProposals.map(proposal => (
                      <div key={proposal.id} className="p-3 border rounded-lg hover:bg-muted/50">
                        <h4 className="font-medium">{proposal.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {proposal.votingMethod} - Ends {proposal.votingEndTime && new Date(proposal.votingEndTime).toLocaleDateString()}
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
              <CardTitle>Voting Methods Available</CardTitle>
              <CardDescription>
                Multiple democratic voting systems supported
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-start gap-4 p-4 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">Simple Majority</h4>
                  <p className="text-sm text-muted-foreground">
                    Traditional yes/no/abstain voting
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">Ranked Choice</h4>
                  <p className="text-sm text-muted-foreground">
                    Rank preferences for multiple options
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">Quadratic Voting</h4>
                  <p className="text-sm text-muted-foreground">
                    Express preference intensity with token allocation
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">Consensus</h4>
                  <p className="text-sm text-muted-foreground">
                    Threshold-based consensus decision making
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
                Decision History
              </CardTitle>
              <CardDescription>Audit trail of all decisions</CardDescription>
            </CardHeader>
            <CardContent>
              {decidedProposals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No decision history yet
                </div>
              ) : (
                <div className="space-y-2">
                  {decidedProposals.map(proposal => (
                    <div key={proposal.id} className="p-3 border rounded-lg">
                      <h4 className="font-medium">{proposal.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Decided on {new Date(proposal.updated).toLocaleDateString()}
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
  )
}
