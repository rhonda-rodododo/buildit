/**
 * Shared Items Dashboard
 * Centralized view of all shared files and documents
 * Epic 58: Advanced Sharing & Permissions
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDistanceToNow } from 'date-fns'
import {
  FileText,
  File,
  Image,
  Video,
  Music,
  Archive,
  Users,
  Globe,
  Lock,
  Eye,
  Pencil,
  MessageSquare,
  Download,
  Clock,
  Trash2,
  ExternalLink,
  Filter,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useDocumentsStore } from '@/modules/documents/documentsStore'
import { useFilesStore } from '@/modules/files/filesStore'
import { cn } from '@/lib/utils'

type FilterType = 'all' | 'documents' | 'files'
type PermissionFilter = 'all' | 'view' | 'comment' | 'edit' | 'admin'

interface SharedItem {
  id: string
  type: 'document' | 'file'
  name: string
  sharedVia: 'link' | 'user'
  permission: string
  isPublic?: boolean
  expiresAt?: number
  accessCount?: number
  createdAt: number
  icon: typeof FileText
}

export function SharedItemsDashboard() {
  const { t } = useTranslation()
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [permissionFilter, setPermissionFilter] = useState<PermissionFilter>('all')

  // Get document shares (Map<documentId, DocumentShareLink[]>)
  const documentShareLinksMap = useDocumentsStore((state) => state.shareLinks)
  const documents = useDocumentsStore((state) => state.documents)
  const deleteDocShareLink = useDocumentsStore((state) => state.deleteShareLink)

  // Get file shares (Map<shareId, FileShare>)
  const fileSharesMap = useFilesStore((state) => state.shares)
  const files = useFilesStore((state) => state.files)
  const deleteFileShare = useFilesStore((state) => state.deleteShare)

  // Build shared items list
  const sharedItems = useMemo(() => {
    const items: SharedItem[] = []

    // Add document share links (iterate over Map<documentId, DocumentShareLink[]>)
    documentShareLinksMap.forEach((links, documentId) => {
      const doc = documents.get(documentId)
      if (doc) {
        links.forEach((link) => {
          items.push({
            id: link.id,
            type: 'document',
            name: doc.title,
            sharedVia: 'link',
            permission: link.permission,
            isPublic: link.isPublic,
            expiresAt: link.expiresAt,
            accessCount: link.accessCount,
            createdAt: link.createdAt,
            icon: FileText,
          })
        })
      }
    })

    // Add file shares (iterate over Map<shareId, FileShare>)
    fileSharesMap.forEach((share) => {
      const file = files.get(share.fileId)
      if (file) {
        const iconMap = {
          image: Image,
          video: Video,
          audio: Music,
          document: FileText,
          archive: Archive,
          other: File,
        }
        items.push({
          id: share.id,
          type: 'file',
          name: file.name,
          sharedVia: share.shareLink ? 'link' : 'user',
          permission: share.permissions[0] || 'view',
          isPublic: !!share.shareLink,
          expiresAt: share.expiresAt || undefined,
          accessCount: share.accessCount || 0,
          createdAt: share.createdAt,
          icon: iconMap[file.type],
        })
      }
    })

    // Sort by creation date (newest first)
    return items.sort((a, b) => b.createdAt - a.createdAt)
  }, [documentShareLinksMap, documents, fileSharesMap, files])

  // Filter items
  const filteredItems = useMemo(() => {
    return sharedItems.filter((item) => {
      // Type filter
      if (filterType !== 'all') {
        if (filterType === 'documents' && item.type !== 'document') return false
        if (filterType === 'files' && item.type !== 'file') return false
      }

      // Permission filter
      if (permissionFilter !== 'all' && item.permission !== permissionFilter) {
        return false
      }

      return true
    })
  }, [sharedItems, filterType, permissionFilter])

  // Stats
  const stats = useMemo(() => {
    const totalShares = sharedItems.length
    const publicLinks = sharedItems.filter((i) => i.isPublic).length
    const expiringLinks = sharedItems.filter(
      (i) => i.expiresAt && i.expiresAt > Date.now() && i.expiresAt < Date.now() + 7 * 24 * 60 * 60 * 1000
    ).length
    const totalViews = sharedItems.reduce((sum, i) => sum + (i.accessCount || 0), 0)

    return { totalShares, publicLinks, expiringLinks, totalViews }
  }, [sharedItems])

  const handleDeleteShare = (item: SharedItem) => {
    if (!confirm(t('sharedItemsDashboard.confirmRevoke'))) return

    if (item.type === 'document') {
      // Find the document ID from the share link
      for (const [documentId, links] of documentShareLinksMap.entries()) {
        const link = links.find((l) => l.id === item.id)
        if (link) {
          deleteDocShareLink(documentId, item.id)
          break
        }
      }
    } else {
      deleteFileShare(item.id)
    }
  }

  const getPermissionBadge = (permission: string) => {
    const config: Record<string, { labelKey: string; icon: typeof Eye; color: string }> = {
      view: { labelKey: 'sharedItemsDashboard.permissions.view', icon: Eye, color: 'bg-blue-100 text-blue-700' },
      comment: { labelKey: 'sharedItemsDashboard.permissions.comment', icon: MessageSquare, color: 'bg-green-100 text-green-700' },
      edit: { labelKey: 'sharedItemsDashboard.permissions.edit', icon: Pencil, color: 'bg-orange-100 text-orange-700' },
      download: { labelKey: 'sharedItemsDashboard.permissions.download', icon: Download, color: 'bg-purple-100 text-purple-700' },
      admin: { labelKey: 'sharedItemsDashboard.permissions.admin', icon: Lock, color: 'bg-red-100 text-red-700' },
    }

    const cfg = config[permission] || config.view
    const Icon = cfg.icon

    return (
      <Badge variant="secondary" className={cn('gap-1', cfg.color)}>
        <Icon className="h-3 w-3" />
        {t(cfg.labelKey)}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t('sharedItemsDashboard.title')}</h1>
        <p className="text-muted-foreground">
          {t('sharedItemsDashboard.description')}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('sharedItemsDashboard.totalShares')}</CardDescription>
            <CardTitle className="text-3xl">{stats.totalShares}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('sharedItemsDashboard.publicLinks')}</CardDescription>
            <CardTitle className="text-3xl">{stats.publicLinks}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('sharedItemsDashboard.expiringSoon')}</CardDescription>
            <CardTitle className="text-3xl text-orange-600">{stats.expiringLinks}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('sharedItemsDashboard.totalViews')}</CardDescription>
            <CardTitle className="text-3xl">{stats.totalViews}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{t('sharedItemsDashboard.filters')}</span>
        </div>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('sharedItemsDashboard.type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('sharedItemsDashboard.allTypes')}</SelectItem>
            <SelectItem value="documents">{t('sharedItemsDashboard.documents')}</SelectItem>
            <SelectItem value="files">{t('sharedItemsDashboard.files')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={permissionFilter} onValueChange={(v) => setPermissionFilter(v as PermissionFilter)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('sharedItemsDashboard.permission')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('sharedItemsDashboard.allPermissions')}</SelectItem>
            <SelectItem value="view">{t('sharedItemsDashboard.viewOnly')}</SelectItem>
            <SelectItem value="comment">{t('sharedItemsDashboard.comment')}</SelectItem>
            <SelectItem value="edit">{t('sharedItemsDashboard.edit')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Shared Items Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('sharedItemsDashboard.tableHeaders.name')}</TableHead>
                <TableHead>{t('sharedItemsDashboard.tableHeaders.type')}</TableHead>
                <TableHead>{t('sharedItemsDashboard.tableHeaders.permission')}</TableHead>
                <TableHead>{t('sharedItemsDashboard.tableHeaders.sharedVia')}</TableHead>
                <TableHead>{t('sharedItemsDashboard.tableHeaders.views')}</TableHead>
                <TableHead>{t('sharedItemsDashboard.tableHeaders.expires')}</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {t('sharedItemsDashboard.noSharedItems')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => {
                  const Icon = item.icon
                  const isExpired = item.expiresAt && item.expiresAt < Date.now()
                  const isExpiringSoon =
                    item.expiresAt &&
                    !isExpired &&
                    item.expiresAt < Date.now() + 7 * 24 * 60 * 60 * 1000

                  return (
                    <TableRow key={`${item.type}-${item.id}`} className={isExpired ? 'opacity-50' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium truncate max-w-[200px]">{item.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {item.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{getPermissionBadge(item.permission)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {item.sharedVia === 'link' ? (
                            item.isPublic ? (
                              <>
                                <Globe className="h-3 w-3 text-green-600" />
                                <span className="text-sm">{t('sharedItemsDashboard.sharedVia.publicLink')}</span>
                              </>
                            ) : (
                              <>
                                <Lock className="h-3 w-3 text-orange-600" />
                                <span className="text-sm">{t('sharedItemsDashboard.sharedVia.privateLink')}</span>
                              </>
                            )
                          ) : (
                            <>
                              <Users className="h-3 w-3 text-blue-600" />
                              <span className="text-sm">{t('sharedItemsDashboard.sharedVia.direct')}</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{item.accessCount || 0}</span>
                      </TableCell>
                      <TableCell>
                        {item.expiresAt ? (
                          <div className="flex items-center gap-1">
                            <Clock className={cn('h-3 w-3', isExpired ? 'text-red-600' : isExpiringSoon ? 'text-orange-600' : 'text-muted-foreground')} />
                            <span className={cn('text-sm', isExpired ? 'text-red-600' : isExpiringSoon ? 'text-orange-600' : '')}>
                              {isExpired
                                ? t('sharedItemsDashboard.expired')
                                : formatDistanceToNow(item.expiresAt, { addSuffix: true })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">{t('sharedItemsDashboard.never')}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              {t('sharedItemsDashboard.open')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteShare(item)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('sharedItemsDashboard.revokeShare')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
