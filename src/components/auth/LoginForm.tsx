import { FC, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Eye, EyeOff, Shield } from 'lucide-react'
import { APP_CONFIG } from '@/config/app'

export const LoginForm: FC = () => {
  const { createNewIdentity, importIdentity } = useAuthStore()
  const [name, setName] = useState('')
  const [nsec, setNsec] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validatePassword = (pass: string): string | null => {
    if (pass.length < 8) {
      return 'Password must be at least 8 characters'
    }
    return null
  }

  const handleCreateIdentity = async () => {
    if (!name.trim()) return

    // Validate password
    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setError(null)
    setLoading(true)
    try {
      await createNewIdentity(name, password)
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

    // Validate password
    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setError(null)
    setLoading(true)
    try {
      await importIdentity(nsec, name, password)
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
            <Alert variant="destructive" className="mt-4" role="alert" id="form-error">
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

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-12"
                  aria-describedby={error ? 'form-error password-hint' : 'password-hint'}
                  aria-invalid={error ? 'true' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p id="password-hint" className="text-xs text-muted-foreground">
                Minimum 8 characters. This password encrypts your private keys.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <Shield className="h-5 w-5 text-primary shrink-0" />
              <p className="text-xs text-muted-foreground">
                Your private key will be encrypted with this password. It never leaves your device unencrypted.
              </p>
            </div>

            <Button
              onClick={handleCreateIdentity}
              disabled={loading || !name.trim() || !password || !confirmPassword}
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

            <div className="space-y-2">
              <Label htmlFor="import-password">Password</Label>
              <div className="relative">
                <Input
                  id="import-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-12"
                  aria-describedby={error ? 'form-error import-password-hint' : 'import-password-hint'}
                  aria-invalid={error ? 'true' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p id="import-password-hint" className="text-xs text-muted-foreground">
                This password will encrypt your imported key locally.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="import-confirm-password">Confirm Password</Label>
              <Input
                id="import-confirm-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <Button
              onClick={handleImportIdentity}
              disabled={loading || !name.trim() || !nsec.trim() || !password || !confirmPassword}
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
