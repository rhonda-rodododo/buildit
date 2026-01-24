import { FC, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Heart, Users } from 'lucide-react'

export const MutualAidView: FC = () => {
  const [activeTab, setActiveTab] = useState('browse')

  return (
    <div className="h-full p-4 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Mutual Aid</h2>
          <p className="text-muted-foreground">
            Community support through resource sharing and solidarity
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Request/Offer
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="my-items">My Items</TabsTrigger>
          <TabsTrigger value="matches">Matches</TabsTrigger>
          <TabsTrigger value="rides">Ride Share</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Requests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Active Requests
                </CardTitle>
                <CardDescription>
                  Community members need your help
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  No active requests
                </div>
              </CardContent>
            </Card>

            {/* Offers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  Available Offers
                </CardTitle>
                <CardDescription>
                  Resources available to help
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  No available offers
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="my-items" className="mt-6">
          <div className="text-center py-12 text-muted-foreground">
            You haven't created any requests or offers yet
          </div>
        </TabsContent>

        <TabsContent value="matches" className="mt-6">
          <div className="text-center py-12 text-muted-foreground">
            No matches found. Create a request or offer to get started.
          </div>
        </TabsContent>

        <TabsContent value="rides" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Solidarity Ride Share</CardTitle>
              <CardDescription>
                Coordinate transportation with community members
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                No ride shares available
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
