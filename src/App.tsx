import { FC, useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useDeviceStore } from '@/stores/deviceStore'
import { usePostsStore } from '@/modules/microblogging/postsStore'
import { startScheduledPostsScheduler, stopScheduledPostsScheduler } from '@/modules/microblogging/scheduledPostsScheduler'
import { LoginForm } from '@/components/auth/LoginForm'
import { HomePage } from '@/pages/HomePage'
import { MessagingView } from '@/components/messaging/MessagingView'
import { GroupsView } from '@/components/groups/GroupsView'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { ModeToggle } from '@/components/mode-toggle'
import { EventsView } from '@/modules/events/components/EventsView'
import { MutualAidView } from '@/modules/mutual-aid/components/MutualAidView'
import { SecurityPage } from '@/pages/settings/SecurityPage'
import { microbloggingSeeds } from '@/modules/microblogging/schema'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { APP_CONFIG } from '@/config/app'
import { useNavigate, useParams } from 'react-router-dom'
import { useModuleStore } from './stores/moduleStore'
import { Home, MessageSquare, Users, Calendar, Heart, Shield } from 'lucide-react'
import { MobileBottomNav, MobileBottomNavSpacer } from '@/components/navigation/MobileBottomNav'
import { useIsMobile } from '@/hooks/useMobile'

const App: FC = () => {
  const { currentIdentity, loadIdentities, logout } = useAuthStore()
  const { initializeCurrentDevice, checkWebAuthnSupport } = useDeviceStore()
  const { registry} = useModuleStore()
  const { posts, createPost } = usePostsStore()
  const [activeTab, setActiveTab] = useState('feed')
  const isMobile = useIsMobile()
  // const [routes, setRoutes] = useState(getRoutes())
  useEffect(() => {
    // Update routes when module registry changes (e.g. modules added/removed)
   
  }, [registry.size])

  const { pathname } = useParams()
  const navigate = useNavigate()
  useEffect(() => {
    if (pathname) {
        navigate(pathname)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentional: only restore navigation once on mount
  }, [])

  useEffect(() => {
    // Load identities on mount (database is initialized in main.tsx)
    loadIdentities()

    // Initialize device tracking and WebAuthn support
    checkWebAuthnSupport()
    initializeCurrentDevice()

    // Load seed posts if no posts exist (demo data)
    if (posts.length === 0) {
      (async () => {
        for (const seedPost of microbloggingSeeds.posts) {
          await createPost({
            content: seedPost.content,
            contentType: seedPost.contentType,
            visibility: seedPost.visibility,
            hashtags: seedPost.hashtags,
          })
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Start/stop scheduled posts scheduler based on login state
  useEffect(() => {
    if (currentIdentity) {
      startScheduledPostsScheduler()
    } else {
      stopScheduledPostsScheduler()
    }

    return () => {
      stopScheduledPostsScheduler()
    }
  }, [currentIdentity])

  if (!currentIdentity) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <LoginForm />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Skip link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-background focus:px-4 focus:py-2 focus:rounded-md focus:ring-2 focus:ring-ring focus:text-foreground"
      >
        Skip to main content
      </a>
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {APP_CONFIG.name}
            </h1>
            <p className="text-xs text-muted-foreground hidden sm:block">{APP_CONFIG.tagline}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <NotificationCenter />
            <LanguageSwitcher />
            <ModeToggle />
            <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">
              {currentIdentity.name}
            </span>
            <Button variant="outline" size="sm" onClick={logout} className="text-xs sm:text-sm">
              Logout
            </Button>
          </div>
        </div>
      </div>

      <main id="main-content" className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-screen-2xl">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TooltipProvider delayDuration={300}>
            <TabsList className="mb-4 sm:mb-6 w-full max-w-3xl bg-muted/50 p-1 grid grid-cols-6 gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="feed" className="min-h-[44px] flex items-center justify-center gap-2 px-2 sm:px-3">
                    <Home className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline text-sm">Feed</span>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent className="sm:hidden">Feed</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="messages" className="min-h-[44px] flex items-center justify-center gap-2 px-2 sm:px-3">
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline text-sm">Messages</span>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent className="sm:hidden">Messages</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="groups" className="min-h-[44px] flex items-center justify-center gap-2 px-2 sm:px-3">
                    <Users className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline text-sm">Groups</span>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent className="sm:hidden">Groups</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="events" className="min-h-[44px] flex items-center justify-center gap-2 px-2 sm:px-3">
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline text-sm">Events</span>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent className="sm:hidden">Events</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="mutual-aid" className="min-h-[44px] flex items-center justify-center gap-2 px-2 sm:px-3">
                    <Heart className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline text-sm whitespace-nowrap">Mutual Aid</span>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent className="sm:hidden">Mutual Aid</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="security" className="min-h-[44px] flex items-center justify-center gap-2 px-2 sm:px-3">
                    <Shield className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline text-sm">Security</span>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent className="sm:hidden">Security</TooltipContent>
              </Tooltip>
            </TabsList>
          </TooltipProvider>

          <TabsContent value="feed">
            <HomePage />
          </TabsContent>

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

          <TabsContent value="security">
            <SecurityPage />
          </TabsContent>
        </Tabs>

        {/* Spacer for mobile bottom nav */}
        {isMobile && <MobileBottomNavSpacer />}
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobile && <MobileBottomNav />}
    </div>
  )
}

export default App
