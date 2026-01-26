/**
 * Version Badge Component
 *
 * Displays a badge indicating the schema version status of content.
 * Shows warnings for content from newer schema versions.
 */

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AlertTriangle, CheckCircle, Info } from 'lucide-react'
import type { SemanticVersion, CompatibilityStatus } from '@/core/schema/types'
import { getCompatibilityStatus, getCurrentSchemaVersion } from '@/core/schema/versionUtils'
import { cn } from '@/lib/utils'

interface VersionBadgeProps {
  /** Content version */
  version: SemanticVersion
  /** Module ID for version lookup */
  moduleId: string
  /** Whether to show the version number */
  showVersion?: boolean
  /** Additional class names */
  className?: string
}

export function VersionBadge({
  version,
  moduleId,
  showVersion = false,
  className
}: VersionBadgeProps) {
  const readerVersion = getCurrentSchemaVersion(moduleId)
  const status = getCompatibilityStatus(version, readerVersion)

  if (status.fullyCompatible && !showVersion) {
    // Don't show anything for fully compatible content
    return null
  }

  const { variant, icon: Icon, label } = getBadgeConfig(status)

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={variant} className={cn('gap-1', className)}>
            <Icon className="h-3 w-3" />
            {showVersion ? `v${version}` : label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{status.message}</p>
          {status.updateRecommended && (
            <p className="text-xs text-muted-foreground mt-1">
              Update recommended for full feature support
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function getBadgeConfig(status: CompatibilityStatus): {
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  icon: typeof CheckCircle
  label: string
} {
  if (!status.canRead) {
    return {
      variant: 'destructive',
      icon: AlertTriangle,
      label: 'Incompatible'
    }
  }

  if (status.updateRecommended) {
    return {
      variant: 'secondary',
      icon: Info,
      label: 'Partial'
    }
  }

  return {
    variant: 'outline',
    icon: CheckCircle,
    label: 'Compatible'
  }
}
