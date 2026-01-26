/**
 * Schema Status Card Component
 *
 * Displays comprehensive schema version status for a module.
 * Used in settings/about screens to show version compatibility.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, AlertCircle, AlertTriangle, Clock } from 'lucide-react'
import type { ModuleVersionInfo } from '@/core/schema/types'
import { cn } from '@/lib/utils'

interface SchemaStatusCardProps {
  /** Module version information */
  moduleInfo: ModuleVersionInfo
  /** Additional class names */
  className?: string
}

export function SchemaStatusCard({ moduleInfo, className }: SchemaStatusCardProps) {
  const { moduleName, localVersion, latestVersion, hasUpdate, compatibility } = moduleInfo

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{moduleName}</CardTitle>
          <StatusIcon compatibility={compatibility} />
        </div>
        <CardDescription>
          Local: v{localVersion}
          {latestVersion && ` · Latest: v${latestVersion}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Compatibility status */}
        <div className="flex items-center gap-2">
          <Badge variant={getStatusVariant(compatibility)}>
            {compatibility.fullyCompatible
              ? 'Fully Compatible'
              : compatibility.canRead
                ? 'Partially Compatible'
                : 'Incompatible'}
          </Badge>
          {hasUpdate && (
            <Badge variant="outline">Update Available</Badge>
          )}
        </div>

        {/* Deprecation warning */}
        {compatibility.isDeprecated && (
          <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-500">
            <AlertTriangle className="h-4 w-4" />
            <span>This version is deprecated</span>
          </div>
        )}

        {/* Sunset countdown */}
        {compatibility.daysUntilSunset !== null && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" />
              <span>
                {compatibility.daysUntilSunset} days until sunset
              </span>
            </div>
            <Progress
              value={Math.max(0, 100 - (compatibility.daysUntilSunset / 180) * 100)}
              className="h-1"
            />
          </div>
        )}

        {/* Status message */}
        <p className="text-sm text-muted-foreground">
          {compatibility.message}
        </p>
      </CardContent>
    </Card>
  )
}

function StatusIcon({ compatibility }: { compatibility: ModuleVersionInfo['compatibility'] }) {
  if (!compatibility.canRead) {
    return <AlertCircle className="h-5 w-5 text-destructive" />
  }
  if (compatibility.updateRecommended || compatibility.isDeprecated) {
    return <AlertTriangle className="h-5 w-5 text-yellow-500" />
  }
  return <CheckCircle className="h-5 w-5 text-green-500" />
}

function getStatusVariant(
  compatibility: ModuleVersionInfo['compatibility']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (!compatibility.canRead) return 'destructive'
  if (compatibility.updateRecommended) return 'secondary'
  return 'default'
}

/**
 * Schema Status List Component
 *
 * Displays a grid of module schema statuses.
 */
interface SchemaStatusListProps {
  /** Array of module version information */
  modules: ModuleVersionInfo[]
  /** Additional class names */
  className?: string
}

export function SchemaStatusList({ modules, className }: SchemaStatusListProps) {
  const sortedModules = [...modules].sort((a, b) => {
    // Sort by: incompatible first, then needs update, then compatible
    if (!a.compatibility.canRead && b.compatibility.canRead) return -1
    if (a.compatibility.canRead && !b.compatibility.canRead) return 1
    if (a.compatibility.updateRecommended && !b.compatibility.updateRecommended) return -1
    if (!a.compatibility.updateRecommended && b.compatibility.updateRecommended) return 1
    return a.moduleName.localeCompare(b.moduleName)
  })

  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-3', className)}>
      {sortedModules.map(module => (
        <SchemaStatusCard key={module.moduleId} moduleInfo={module} />
      ))}
    </div>
  )
}
