import { FC, useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { LoginForm } from '@/components/auth/LoginForm'
import { MessagingView } from '@/components/messaging/MessagingView'
import { GroupsView } from '@/components/groups/GroupsView'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'
import { EventsView } from '@/modules/events/components/EventsView'
import { MutualAidView } from '@/modules/mutual-aid/components/MutualAidView'
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Social Action Network
          </h1>
          <div className="flex items-center gap-2 sm:gap-4">
            <NotificationCenter />
            <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">
              {currentIdentity.name}
            </span>
            <Button variant="outline" size="sm" onClick={logout} className="text-xs sm:text-sm">
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <Tabs value={activeTab} onValueChange={(value) => {
          console.log('Tab changing to:', value)
          setActiveTab(value)
        }}>
          <TabsList className="mb-4 sm:mb-6 grid w-full grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-0 bg-muted/50 p-1">
            <TabsTrigger value="messages" className="text-xs sm:text-sm">Messages</TabsTrigger>
            <TabsTrigger value="groups" className="text-xs sm:text-sm">Groups</TabsTrigger>
            <TabsTrigger value="events" className="text-xs sm:text-sm">Events</TabsTrigger>
            <TabsTrigger value="mutual-aid" className="text-xs sm:text-sm">Mutual Aid</TabsTrigger>
          </TabsList>

          <TabsContent value="messages">
            <MessagingView />
          </TabsContent>

          <TabsContent value="groups">
            <GroupsView />
          </TabsContent>

          <TabsContent value="events">
            <EventsView />
          </TabsContent>

          <TabsContent value="mutual-aid">
            <MutualAidView />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default App
