import { FC } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Users, Plus, Table, Columns, Calendar } from 'lucide-react'

export const CRMView: FC = () => {
  return (
    <div className="h-full p-4 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Contact Database</h2>
          <p className="text-muted-foreground">
            Organize and manage community relationships
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Contact
        </Button>
      </div>

      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table">
            <Table className="h-4 w-4 mr-2" />
            Table View
          </TabsTrigger>
          <TabsTrigger value="board">
            <Columns className="h-4 w-4 mr-2" />
            Board View
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <Calendar className="h-4 w-4 mr-2" />
            Calendar View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Contacts
              </CardTitle>
              <CardDescription>
                Manage contacts with custom fields and privacy controls
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                No contacts yet. Add your first contact to get started.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="board" className="mt-6">
          <div className="text-center py-12 text-muted-foreground">
            Board view - organize contacts by status or category
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <div className="text-center py-12 text-muted-foreground">
            Calendar view - see contacts by date-based fields
          </div>
        </TabsContent>
      </Tabs>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Available Templates</CardTitle>
          <CardDescription>Pre-configured fields for common use cases</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="p-3 border rounded-lg">
            <h4 className="font-medium">Union Organizing</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Track organizing conversations and commitments
            </p>
          </div>
          <div className="p-3 border rounded-lg">
            <h4 className="font-medium">Fundraising</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Donor management and campaign tracking
            </p>
          </div>
          <div className="p-3 border rounded-lg">
            <h4 className="font-medium">Legal Tracking</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Case management for legal support work
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
