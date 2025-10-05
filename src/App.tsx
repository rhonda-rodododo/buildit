import { FC, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { LoginForm } from '@/components/auth/LoginForm'
import { initializeDatabase } from '@/core/storage/db'

const App: FC = () => {
  const { currentIdentity, loadIdentities } = useAuthStore()

  useEffect(() => {
    // Initialize database and load identities on mount
    initializeDatabase().then(() => {
      loadIdentities()
    })
  }, [loadIdentities])

  if (!currentIdentity) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <LoginForm />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-4">
          Welcome, {currentIdentity.name}!
        </h1>
        <p className="text-muted-foreground">
          You're logged in. Group management and modules coming in next epics...
        </p>
      </div>
    </div>
  )
}

export default App
