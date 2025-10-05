import { FC, useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { LoginForm } from '@/components/auth/LoginForm'
import { MessagingView } from '@/components/messaging/MessagingView'
import { GroupsView } from '@/components/groups/GroupsView'
import { initializeDatabase } from '@/core/storage/db'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'

const App: FC = () => {
  const { currentIdentity, loadIdentities, logout } = useAuthStore()
  const [activeTab, setActiveTab] = useState('messages')

  useEffect(() => {
    // Initialize database and load identities on mount
    initializeDatabase().then(() => {
      loadIdentities()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!currentIdentity) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <LoginForm />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Social Action Network</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {currentIdentity.name}
            </span>
            <Button variant="outline" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-8">
        <Tabs value={activeTab} onValueChange={(value) => {
          console.log('Tab changing to:', value)
          setActiveTab(value)
        }}>
          <TabsList className="mb-6">
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="mutual-aid">Mutual Aid</TabsTrigger>
          </TabsList>

          <TabsContent value="messages">
            <MessagingView />
          </TabsContent>

          <TabsContent value="groups">
            <GroupsView />
          </TabsContent>

          <TabsContent value="events">
            <div className="text-center text-muted-foreground py-12">
              Events module coming soon...
            </div>
          </TabsContent>

          <TabsContent value="mutual-aid">
            <div className="text-center text-muted-foreground py-12">
              Mutual aid module coming soon...
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default App
