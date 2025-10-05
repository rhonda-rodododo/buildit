import { FC } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileText, Vote, History, Plus } from 'lucide-react'

export const GovernanceView: FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Governance</h2>
          <p className="text-muted-foreground">
            Democratic decision-making and collective governance
          </p>
        </div>
        <Button>
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
                <div className="text-center py-8 text-muted-foreground">
                  No draft proposals
                </div>
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
                <div className="text-center py-8 text-muted-foreground">
                  No active votes
                </div>
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
              <div className="text-center py-8 text-muted-foreground">
                No decision history yet
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
