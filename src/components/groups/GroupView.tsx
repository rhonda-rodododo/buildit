import { FC, useState, Suspense, lazy } from 'react'
import { useGroupsStore } from '@/stores/groupsStore'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GroupThreadList } from '@/components/messaging/GroupThreadList'
import { GroupThreadView } from '@/components/messaging/GroupThreadView'
import { CreateThreadDialog } from '@/components/messaging/CreateThreadDialog'
import { GroupSettingsDialog } from '@/components/groups/GroupSettingsDialog'
import { useMessagingStore } from '@/stores/messagingStore'
import { hexToBytes } from '@noble/hashes/utils'

// Lazy load module components to reduce initial bundle size
const EventsView = lazy(() => import('@/modules/events/components/EventsView').then(m => ({ default: m.EventsView })))
const MutualAidView = lazy(() => import('@/modules/mutual-aid/components/MutualAidView').then(m => ({ default: m.MutualAidView })))
const GovernanceView = lazy(() => import('@/modules/governance/components/GovernanceView').then(m => ({ default: m.GovernanceView })))
const WikiView = lazy(() => import('@/modules/wiki/components/WikiView').then(m => ({ default: m.WikiView })))
const CRMView = lazy(() => import('@/modules/crm/components/CRMView').then(m => ({ default: m.CRMView })))

// Loading component for lazy-loaded modules
const ModuleLoading = () => (
  <div className="flex items-center justify-center p-8">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      <p className="mt-4 text-muted-foreground">Loading module...</p>
    </div>
  </div>
)

export const GroupView: FC = () => {
  const { activeGroup } = useGroupsStore()
  const { activeThreadId } = useMessagingStore()
  const [createThreadOpen, setCreateThreadOpen] = useState(false)

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
          <GroupSettingsDialog group={activeGroup} />
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
              <TabsContent value="messaging" className="h-[calc(100vh-300px)]">
                <div className="grid grid-cols-3 gap-4 h-full">
                  <div className="col-span-1 border rounded-lg overflow-hidden">
                    <GroupThreadList
                      groupId={activeGroup.id}
                      onCreateThread={() => setCreateThreadOpen(true)}
                    />
                  </div>
                  <div className="col-span-2 border rounded-lg overflow-hidden">
                    {activeThreadId && activeGroup.encryptedGroupKey ? (
                      <GroupThreadView
                        threadId={activeThreadId}
                        groupId={activeGroup.id}
                        groupKey={hexToBytes(activeGroup.encryptedGroupKey)}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        Select a thread or create a new one to start messaging
                      </div>
                    )}
                  </div>
                </div>
                <CreateThreadDialog
                  open={createThreadOpen}
                  onOpenChange={setCreateThreadOpen}
                  groupId={activeGroup.id}
                />
              </TabsContent>
            )}

            {activeGroup.enabledModules.includes('events') && (
              <TabsContent value="events">
                <Suspense fallback={<ModuleLoading />}>
                  <EventsView groupId={activeGroup.id} />
                </Suspense>
              </TabsContent>
            )}

            {activeGroup.enabledModules.includes('mutual-aid') && (
              <TabsContent value="mutual-aid">
                <Suspense fallback={<ModuleLoading />}>
                  <MutualAidView />
                </Suspense>
              </TabsContent>
            )}

            {activeGroup.enabledModules.includes('governance') && (
              <TabsContent value="governance">
                <Suspense fallback={<ModuleLoading />}>
                  <GovernanceView groupId={activeGroup.id} />
                </Suspense>
              </TabsContent>
            )}

            {activeGroup.enabledModules.includes('wiki') && (
              <TabsContent value="wiki">
                <Suspense fallback={<ModuleLoading />}>
                  <WikiView groupId={activeGroup.id} />
                </Suspense>
              </TabsContent>
            )}

            {activeGroup.enabledModules.includes('crm') && (
              <TabsContent value="crm">
                <Suspense fallback={<ModuleLoading />}>
                  <CRMView />
                </Suspense>
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>
    </div>
  )
}
