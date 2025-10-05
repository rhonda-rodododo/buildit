import { FC } from 'react'
import { useGroupsStore } from '@/stores/groupsStore'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const GroupView: FC = () => {
  const { activeGroup } = useGroupsStore()

  if (!activeGroup) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Select a group to view details
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">{activeGroup.name}</h2>
            <p className="text-muted-foreground mt-1">{activeGroup.description}</p>
          </div>
          <Button variant="outline" size="sm">
            Settings
          </Button>
        </div>

        {/* Group Info */}
        <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
          <span className="capitalize">{activeGroup.privacy} group</span>
          <span>•</span>
          <span>{activeGroup.adminPubkeys.length} members</span>
          {activeGroup.enabledModules.length > 0 && (
            <>
              <span>•</span>
              <span>{activeGroup.enabledModules.length} modules enabled</span>
            </>
          )}
        </div>
      </div>

      {/* Modules */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeGroup.enabledModules.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              No modules enabled yet. Enable modules in group settings to get started.
            </p>
          </Card>
        ) : (
          <Tabs defaultValue={activeGroup.enabledModules[0]}>
            <TabsList className="mb-6">
              {activeGroup.enabledModules.map((module) => (
                <TabsTrigger key={module} value={module} className="capitalize">
                  {module.replace('-', ' ')}
                </TabsTrigger>
              ))}
            </TabsList>

            {activeGroup.enabledModules.includes('messaging') && (
              <TabsContent value="messaging">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-2">Group Messaging</h3>
                  <p className="text-muted-foreground">
                    Group messaging feature coming soon...
                  </p>
                </Card>
              </TabsContent>
            )}

            {activeGroup.enabledModules.includes('events') && (
              <TabsContent value="events">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-2">Events</h3>
                  <p className="text-muted-foreground">
                    Events management coming soon...
                  </p>
                </Card>
              </TabsContent>
            )}

            {activeGroup.enabledModules.includes('mutual-aid') && (
              <TabsContent value="mutual-aid">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-2">Mutual Aid</h3>
                  <p className="text-muted-foreground">
                    Mutual aid requests and offers coming soon...
                  </p>
                </Card>
              </TabsContent>
            )}

            {activeGroup.enabledModules.includes('governance') && (
              <TabsContent value="governance">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-2">Governance</h3>
                  <p className="text-muted-foreground">
                    Proposals and voting coming soon...
                  </p>
                </Card>
              </TabsContent>
            )}

            {activeGroup.enabledModules.includes('wiki') && (
              <TabsContent value="wiki">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-2">Wiki</h3>
                  <p className="text-muted-foreground">
                    Knowledge base coming soon...
                  </p>
                </Card>
              </TabsContent>
            )}

            {activeGroup.enabledModules.includes('crm') && (
              <TabsContent value="crm">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-2">CRM</h3>
                  <p className="text-muted-foreground">
                    Contact management coming soon...
                  </p>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>
    </div>
  )
}
