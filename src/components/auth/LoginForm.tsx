import { FC, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { APP_CONFIG } from '@/config/app'

export const LoginForm: FC = () => {
  const { createNewIdentity, importIdentity } = useAuthStore()
  const [name, setName] = useState('')
  const [nsec, setNsec] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreateIdentity = async () => {
    if (!name.trim()) return
    setError(null)
    setLoading(true)
    try {
      await createNewIdentity(name)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create identity'
      setError(errorMsg)
      console.error('Failed to create identity:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleImportIdentity = async () => {
    if (!nsec.trim() || !name.trim()) return
    setError(null)
    setLoading(true)
    try {
      await importIdentity(nsec, name)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to import identity'
      setError(errorMsg)
      console.error('Failed to import identity:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{APP_CONFIG.fullName}</CardTitle>
        <CardDescription>{APP_CONFIG.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="create">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Create New</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
          </TabsList>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <TabsContent value="create" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <Button
              onClick={handleCreateIdentity}
              disabled={loading || !name.trim()}
              className="w-full"
            >
              {loading ? 'Creating...' : 'Create Identity'}
            </Button>
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="import-name">Display Name</Label>
              <Input
                id="import-name"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nsec">Private Key (nsec)</Label>
              <Input
                id="nsec"
                type="password"
                placeholder="nsec1..."
                value={nsec}
                onChange={(e) => setNsec(e.target.value)}
              />
            </div>
            <Button
              onClick={handleImportIdentity}
              disabled={loading || !name.trim() || !nsec.trim()}
              className="w-full"
            >
              {loading ? 'Importing...' : 'Import Identity'}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
