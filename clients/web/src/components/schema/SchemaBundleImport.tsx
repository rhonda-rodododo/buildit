/**
 * Schema Bundle Import Component
 *
 * Allows importing schema bundles from files for offline updates.
 * Supports JSON bundle files exported from other devices.
 */

import * as React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Upload, CheckCircle, AlertTriangle, FileJson, Trash2 } from 'lucide-react'
import { importBundle, getStoredBundles, deleteBundle } from '@/core/schema/bundleManager'
import type { SchemaBundle } from '@/core/schema/types'
import type { DBSchemaBundle } from '@/core/storage/db'
import { cn } from '@/lib/utils'

interface SchemaBundleImportProps {
  className?: string
}

export function SchemaBundleImport({ className }: SchemaBundleImportProps) {
  const [importing, setImporting] = React.useState(false)
  const [result, setResult] = React.useState<{
    success: boolean
    message: string
    modulesUpdated?: string[]
  } | null>(null)
  const [storedBundles, setStoredBundles] = React.useState<DBSchemaBundle[]>([])
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    loadStoredBundles()
  }, [])

  const loadStoredBundles = async () => {
    try {
      const bundles = await getStoredBundles()
      setStoredBundles(bundles)
    } catch {
      // DB may not be initialized yet
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setResult(null)

    try {
      const text = await file.text()
      const bundle = JSON.parse(text) as SchemaBundle

      if (!bundle.contentHash || !bundle.signature || !bundle.modules) {
        setResult({
          success: false,
          message: 'Invalid bundle format. Expected a signed schema bundle JSON file.'
        })
        return
      }

      const { applied, modulesUpdated, error } = await importBundle(bundle, 'file')

      if (!applied) {
        setResult({
          success: false,
          message: error ?? 'Failed to import bundle'
        })
      } else if (modulesUpdated.length === 0) {
        setResult({
          success: true,
          message: 'Bundle imported successfully. All modules are already up to date.'
        })
      } else {
        setResult({
          success: true,
          message: `Bundle imported. ${modulesUpdated.length} module(s) updated.`,
          modulesUpdated
        })
      }

      await loadStoredBundles()
    } catch (err) {
      setResult({
        success: false,
        message: `Failed to parse bundle file: ${err instanceof Error ? err.message : String(err)}`
      })
    } finally {
      setImporting(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDelete = async (contentHash: string) => {
    await deleteBundle(contentHash)
    await loadStoredBundles()
  }

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileJson className="h-5 w-5" />
          Schema Bundle Import
        </CardTitle>
        <CardDescription>
          Import schema bundles from files for offline updates.
          Bundles are cryptographically verified before import.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Import button */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            {importing ? 'Importing...' : 'Import Bundle File'}
          </Button>
        </div>

        {/* Import result */}
        {result && (
          <Alert variant={result.success ? 'default' : 'destructive'}>
            {result.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <AlertTitle>{result.success ? 'Success' : 'Error'}</AlertTitle>
            <AlertDescription>
              <p>{result.message}</p>
              {result.modulesUpdated && result.modulesUpdated.length > 0 && (
                <p className="mt-1 text-xs">
                  Updated: {result.modulesUpdated.join(', ')}
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Stored bundles */}
        {storedBundles.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Stored Bundles</h4>
            {storedBundles.map((bundle) => (
              <div
                key={bundle.contentHash}
                className="flex items-center justify-between rounded-lg border p-3 text-sm"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">
                      {bundle.contentHash.slice(0, 16)}...
                    </span>
                    {bundle.isActive && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900 dark:text-green-300">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    v{bundle.version} · {bundle.source} · {new Date(bundle.importedAt).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleDelete(bundle.contentHash)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Delete bundle</span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
