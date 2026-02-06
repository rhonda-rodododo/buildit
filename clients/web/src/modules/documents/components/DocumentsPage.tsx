/**
 * Documents Page - Main UI for document management
 * Sophisticated document management with folders, comments, and sharing
 * Inspired by Google Docs, Notion, and Proton Drive - but unique for organizers
 */

import { FC, useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { useDocumentsStore } from '../documentsStore'
import { useAuthStore, getCurrentPrivateKey } from '@/stores/authStore'
import { useGroupsStore } from '@/stores/groupsStore'
import { getNostrClient } from '@/core/nostr/client'
import { documentManager } from '../documentManager'
import { TipTapEditor } from './TipTapEditor'
import { FolderTree } from './FolderTree'
import { CommentSidebar } from './CommentSidebar'
import { ShareDialog } from './ShareDialog'
import { documentTemplates } from '../templates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  FileText,
  Plus,
  Save,
  Download,
  FileX,
  Users,
  Star,
  MessageSquare,
  MoreHorizontal,
  Trash2,
  Copy,
  History,
  Share2,
  Search,
  Grid3X3,
  List,
  Clock,
  Edit3,
  FolderOpen,
  Tag,
  X,
  FileSpreadsheet,
} from 'lucide-react'
import { getPublicKey } from 'nostr-tools'
import type { DBGroupMember } from '@/core/storage/db'
// Alias Document type to avoid conflict with DOM's global Document
import type { Document as DocType, DocumentComment } from '../types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

type ViewMode = 'list' | 'grid'
type SortMode = 'updated' | 'created' | 'name'

export const DocumentsPage: FC = () => {
  const { t } = useTranslation()
  const { groupId } = useParams<{ groupId: string }>()
  const currentIdentity = useAuthStore((state) => state.currentIdentity)
  const { groupMembers, loadGroupMembers } = useGroupsStore()

  const {
    documents,
    getGroupDocuments,
    currentDocumentId,
    setCurrentDocument,
    getUnresolvedComments,
    isStarred,
    toggleStar,
    suggestionModeEnabled,
    toggleSuggestionMode,
    getAllTags,
    addDocumentTag,
    removeDocumentTag,
  } = useDocumentsStore()

  // UI State
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [collaborationEnabled, setCollaborationEnabled] = useState(true)
  const [showCommentSidebar, setShowCommentSidebar] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sortMode, setSortMode] = useState<SortMode>('updated')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [showStarred, setShowStarred] = useState(false)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [showFolderTree, setShowFolderTree] = useState(true)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showTagInput, setShowTagInput] = useState(false)
  const [newTagValue, setNewTagValue] = useState('')

  // Get documents for the group - explicitly typed
  const groupDocs: DocType[] = useMemo(() => {
    return groupId ? getGroupDocuments(groupId) : []
  }, [groupId, getGroupDocuments])

  // Get current document
  const currentDoc = useMemo(() => {
    return currentDocumentId ? documents.get(currentDocumentId) : null
  }, [currentDocumentId, documents])

  // Get all available tags in the group
  const availableTags = useMemo(() => {
    return groupId ? getAllTags(groupId) : []
  }, [groupId, getAllTags, documents]) // documents dependency to recompute when docs change

  const nostrClient = getNostrClient()

  // Get current user pubkey
  const currentUserPubkey = useMemo(() => {
    const privateKey = getCurrentPrivateKey()
    return privateKey ? getPublicKey(privateKey) : ''
  }, [])

  const collaboratorPubkeys = useMemo(() => {
    if (!groupId) return []
    const members = groupMembers.get(groupId)
    return members ? members.map((m: DBGroupMember) => m.pubkey) : []
  }, [groupMembers, groupId])

  // Filter and sort documents
  const filteredAndSortedDocs: DocType[] = useMemo(() => {
    // Start with a copy of the array
    let result = groupDocs.slice()

    // Filter by folder
    if (selectedFolderId !== null) {
      result = result.filter((doc) => {
        const docWithFolder = doc as DocType & { folderId?: string }
        return docWithFolder.folderId === selectedFolderId
      })
    }

    // Filter by starred
    if (showStarred) {
      result = result.filter((doc) => isStarred(doc.id))
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (doc) =>
          doc.title.toLowerCase().includes(query) ||
          doc.content.toLowerCase().includes(query)
      )
    }

    // Filter by selected tags
    if (selectedTags.length > 0) {
      result = result.filter((doc) =>
        selectedTags.every((tag) => doc.tags.includes(tag))
      )
    }

    // Sort
    switch (sortMode) {
      case 'updated':
        result.sort((a, b) => b.updatedAt - a.updatedAt)
        break
      case 'created':
        result.sort((a, b) => b.createdAt - a.createdAt)
        break
      case 'name':
        result.sort((a, b) => a.title.localeCompare(b.title))
        break
    }

    return result
  }, [groupDocs, selectedFolderId, showStarred, searchQuery, sortMode, isStarred, selectedTags])

  // Get comment count for a document
  const getCommentCount = useCallback(
    (docId: string): number => {
      return getUnresolvedComments(docId).length
    },
    [getUnresolvedComments]
  )

  // Load group members for collaboration
  useEffect(() => {
    if (groupId && collaborationEnabled) {
      loadGroupMembers(groupId)
    }
  }, [groupId, collaborationEnabled, loadGroupMembers])

  useEffect(() => {
    // Sync form state when current document changes
    if (currentDoc) {
      setTitle(currentDoc.title)
      setContent(currentDoc.content)
    }
  }, [currentDoc])

  // Define handleSave with useCallback before the useEffect that uses it
  const handleSave = useCallback(async () => {
    const privateKey = getCurrentPrivateKey()
    if (!currentDoc || !privateKey) return

    setIsSaving(true)
    try {
      await documentManager.updateDocument(
        currentDoc.id,
        { title, content },
        privateKey,
        'Auto-save'
      )
      setIsSaving(false)
    } catch (error) {
      console.error('Failed to save document:', error)
      setIsSaving(false)
    }
  }, [currentDoc, title, content])

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!currentDoc || !currentIdentity) return

    const interval = setInterval(async () => {
      const privateKey = getCurrentPrivateKey()
      if (!privateKey) return
      if (content !== currentDoc.content || title !== currentDoc.title) {
        await handleSave()
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [currentDoc, content, title, currentIdentity, handleSave])

  const handleCreate = async () => {
    const privateKey = getCurrentPrivateKey()
    if (!groupId || !privateKey || !title.trim()) return

    setIsCreating(true)
    try {
      const doc = await documentManager.createDocument(
        {
          groupId,
          title: title.trim(),
          content: content,
          template: selectedTemplate || undefined,
          folderId: selectedFolderId ?? undefined,
        },
        privateKey
      )
      setCurrentDocument(doc.id)
      setIsCreating(false)
    } catch (error) {
      console.error('Failed to create document:', error)
      setIsCreating(false)
    }
  }

  const handleExport = async (format: 'html' | 'markdown' | 'text' | 'pdf') => {
    if (!currentDoc) return

    if (format === 'pdf') {
      await documentManager.exportDocument(currentDoc.id, 'pdf')
    } else {
      const exported = await documentManager.exportDocument(currentDoc.id, format)
      const blob = new Blob([exported], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = `${currentDoc.title}.${format === 'markdown' ? 'md' : format}`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  // Epic 58: Export sharing report
  const exportSharingReportCSV = useDocumentsStore((state) => state.exportSharingReportCSV)
  const [exportingReport, setExportingReport] = useState(false)

  const handleExportSharingReport = async () => {
    if (!groupId) return
    setExportingReport(true)
    try {
      const csv = await exportSharingReportCSV(groupId)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = `documents-sharing-report-${new Date().toISOString().slice(0, 10)}.csv`
      window.document.body.appendChild(a)
      a.click()
      window.document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to export sharing report:', err)
      alert(t('documentsPage.failedToExport'))
    } finally {
      setExportingReport(false)
    }
  }

  const handleDelete = async () => {
    if (!currentDoc) return
    const confirmed = window.confirm(
      t('documentsPage.deleteConfirm', { title: currentDoc.title })
    )
    if (!confirmed) return

    try {
      await documentManager.deleteDocument(currentDoc.id)
      setCurrentDocument(null)
    } catch (error) {
      console.error('Failed to delete document:', error)
    }
  }

  const handleDuplicate = async () => {
    const privateKey = getCurrentPrivateKey()
    if (!currentDoc || !groupId || !privateKey) return

    try {
      const doc = await documentManager.createDocument(
        {
          groupId,
          title: `${currentDoc.title} (Copy)`,
          content: currentDoc.content,
          folderId: (currentDoc as DocType & { folderId?: string }).folderId,
        },
        privateKey
      )
      setCurrentDocument(doc.id)
    } catch (error) {
      console.error('Failed to duplicate document:', error)
    }
  }

  const handleCommentClick = (comment: DocumentComment) => {
    // Navigate to the comment's position in the editor
    // Comments are associated with a position or anchor in the document
    const commentAnchor = comment.id;

    // Try to find the comment marker in the DOM and scroll to it
    const editorContainer = window.document.querySelector('.ProseMirror');
    if (!editorContainer) return;

    // Look for a mark or element with this comment's data attribute
    const commentElement =
      editorContainer.querySelector(`[data-comment-id="${commentAnchor}"]`) ||
      editorContainer.querySelector(`[data-comment="${commentAnchor}"]`);

    if (commentElement) {
      commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Add temporary highlight effect
      commentElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'rounded');
      setTimeout(() => {
        commentElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'rounded');
      }, 2000);
    } else {
      // Fallback: scroll to approximate position based on creation order
      const allCommentMarks = editorContainer.querySelectorAll('[data-comment-id], [data-comment]');
      if (allCommentMarks.length > 0) {
        // Scroll to the first comment marker as a fallback
        allCommentMarks[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  const currentDocCommentCount = currentDoc ? getCommentCount(currentDoc.id) : 0

  // Render document item for list view
  const renderDocumentListItem = (doc: DocType) => {
    const docIsStarred = isStarred(doc.id)
    const commentCount = getCommentCount(doc.id)
    const isSelected = currentDoc?.id === doc.id

    return (
      <Card
        key={doc.id}
        className={cn(
          'p-3 cursor-pointer hover:bg-muted/50 transition-colors',
          isSelected && 'bg-muted ring-1 ring-primary'
        )}
        onClick={() => setCurrentDocument(doc.id)}
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={(e) => {
              e.stopPropagation()
              toggleStar(doc.id)
            }}
          >
            {docIsStarred ? (
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            ) : (
              <Star className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>

          <FileText className="h-5 w-5 text-muted-foreground shrink-0" />

          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-sm">{doc.title}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formatDistanceToNow(doc.updatedAt, { addSuffix: true })}</span>
              {commentCount > 0 && (
                <>
                  <MessageSquare className="h-3 w-3 ml-2" />
                  <span>{commentCount}</span>
                </>
              )}
              {doc.tags.length > 0 && (
                <div className="flex items-center gap-1 ml-2">
                  <Tag className="h-3 w-3" />
                  {doc.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="text-xs">{tag}</span>
                  ))}
                  {doc.tags.length > 2 && <span>+{doc.tags.length - 2}</span>}
                </div>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setCurrentDocument(doc.id)}>
                <Edit3 className="h-4 w-4 mr-2" /> {t('documentsPage.listItem.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleStar(doc.id)}>
                <Star className="h-4 w-4 mr-2" />
                {docIsStarred ? t('documentsPage.listItem.removeFromStarred') : t('documentsPage.listItem.addToStarred')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  setCurrentDocument(doc.id)
                  await handleDuplicate()
                }}
              >
                <Copy className="h-4 w-4 mr-2" /> {t('documentsPage.listItem.duplicate')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
    )
  }

  // Render document item for grid view
  const renderDocumentGridItem = (doc: DocType) => {
    const docIsStarred = isStarred(doc.id)
    const commentCount = getCommentCount(doc.id)
    const isSelected = currentDoc?.id === doc.id

    return (
      <Card
        key={doc.id}
        className={cn(
          'p-4 cursor-pointer hover:bg-muted/50 transition-colors',
          isSelected && 'bg-muted ring-1 ring-primary'
        )}
        onClick={() => setCurrentDocument(doc.id)}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-start justify-between mb-2">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mr-2 -mt-2"
              onClick={(e) => {
                e.stopPropagation()
                toggleStar(doc.id)
              }}
            >
              {docIsStarred ? (
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              ) : (
                <Star className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          <h3 className="font-medium text-sm truncate mb-1">{doc.title}</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-auto">
            <span>{formatDistanceToNow(doc.updatedAt, { addSuffix: true })}</span>
            {commentCount > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5">
                <MessageSquare className="h-3 w-3 mr-1" />
                {commentCount}
              </Badge>
            )}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <TooltipProvider>
      <div className="h-full flex">
        {/* Left Sidebar - Folders */}
        {showFolderTree && groupId && (
          <div className="w-56 border-r flex flex-col">
            <div className="p-3 border-b flex items-center justify-between">
              <span className="text-sm font-medium">{t('documentsPage.folders')}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowFolderTree(false)}
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <FolderTree
                groupId={groupId}
                selectedFolderId={selectedFolderId}
                onSelectFolder={setSelectedFolderId}
                onSelectStarred={() => setShowStarred(true)}
                showStarred={showStarred}
              />
            </ScrollArea>
            <div className="p-2 border-t">
              <Button
                variant={showStarred ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start"
                onClick={() => setShowStarred(!showStarred)}
              >
                <Star className={cn('h-4 w-4 mr-2', showStarred && 'fill-yellow-400 text-yellow-400')} />
                {t('documentsPage.starred')}
              </Button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {currentDoc ? (
            /* Document Editor View */
            <>
              {/* Document Header */}
              <div className="border-b p-3 flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => toggleStar(currentDoc.id)}
                    >
                      {isStarred(currentDoc.id) ? (
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      ) : (
                        <Star className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isStarred(currentDoc.id) ? t('documentsPage.listItem.removeFromStarred') : t('documentsPage.listItem.addToStarred')}
                  </TooltipContent>
                </Tooltip>

                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="flex-1 text-lg font-semibold border-none shadow-none focus-visible:ring-0"
                  placeholder={t('documentsPage.documentTitlePlaceholder')}
                />

                <div className="flex items-center gap-1">
                  {/* Suggestion Mode Toggle */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={suggestionModeEnabled ? 'default' : 'ghost'}
                        size="sm"
                        onClick={toggleSuggestionMode}
                      >
                        <Edit3 className="h-4 w-4 mr-1" />
                        {suggestionModeEnabled ? t('documentsPage.editor.suggesting') : t('documentsPage.editor.editing')}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {suggestionModeEnabled
                        ? t('documentsPage.editor.suggestionModeTooltip')
                        : t('documentsPage.editor.editModeTooltip')}
                    </TooltipContent>
                  </Tooltip>

                  {/* Collaboration Toggle */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={collaborationEnabled ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setCollaborationEnabled(!collaborationEnabled)}
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {collaborationEnabled ? t('documentsPage.editor.collaborationEnabled') : t('documentsPage.editor.enableCollaboration')}
                    </TooltipContent>
                  </Tooltip>

                  {/* Comments Toggle */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={showCommentSidebar ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setShowCommentSidebar(!showCommentSidebar)}
                      >
                        <MessageSquare className="h-4 w-4" />
                        {currentDocCommentCount > 0 && (
                          <Badge variant="secondary" className="ml-1 text-xs px-1.5">
                            {currentDocCommentCount}
                          </Badge>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {showCommentSidebar ? t('documentsPage.editor.hideComments') : t('documentsPage.editor.showComments')}
                    </TooltipContent>
                  </Tooltip>

                  {/* Share */}
                  <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <ShareDialog
                      documentId={currentDoc.id}
                      documentTitle={currentDoc.title}
                      currentUserPubkey={currentUserPubkey}
                      onClose={() => setShareDialogOpen(false)}
                    />
                  </Dialog>

                  {/* Save */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSave}
                        disabled={isSaving || collaborationEnabled}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {collaborationEnabled ? t('documentsPage.editor.autoSaving') : t('documentsPage.editor.saveDocument')}
                    </TooltipContent>
                  </Tooltip>

                  {/* More Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleDuplicate}>
                        <Copy className="h-4 w-4 mr-2" /> {t('documentsPage.actions.duplicate')}
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <History className="h-4 w-4 mr-2" /> {t('documentsPage.actions.versionHistory')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleExport('html')}>
                        <Download className="h-4 w-4 mr-2" /> {t('documentsPage.actions.exportHtml')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('markdown')}>
                        <Download className="h-4 w-4 mr-2" /> {t('documentsPage.actions.exportMarkdown')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('pdf')}>
                        <Download className="h-4 w-4 mr-2" /> {t('documentsPage.actions.exportPdf')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> {t('documentsPage.actions.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Document Tags Row */}
              <div className="border-b px-3 py-2 flex items-center gap-2 bg-muted/30">
                <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                {currentDoc.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="gap-1 cursor-pointer hover:bg-secondary/80"
                    onClick={() => removeDocumentTag(currentDoc.id, tag)}
                  >
                    {tag}
                    <X className="h-3 w-3" />
                  </Badge>
                ))}
                {showTagInput ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={newTagValue}
                      onChange={(e) => setNewTagValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newTagValue.trim()) {
                          addDocumentTag(currentDoc.id, newTagValue.trim())
                          setNewTagValue('')
                          setShowTagInput(false)
                        }
                        if (e.key === 'Escape') {
                          setNewTagValue('')
                          setShowTagInput(false)
                        }
                      }}
                      placeholder={t('documentsPage.tags.addTagPlaceholder')}
                      className="h-6 w-24 text-xs"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        if (newTagValue.trim()) {
                          addDocumentTag(currentDoc.id, newTagValue.trim())
                        }
                        setNewTagValue('')
                        setShowTagInput(false)
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setShowTagInput(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {t('documentsPage.tags.addTag')}
                  </Button>
                )}
              </div>

              {/* Editor and Comments */}
              <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 overflow-auto p-4">
                  <TipTapEditor
                    content={content}
                    onChange={setContent}
                    enableCollaboration={
                      collaborationEnabled &&
                      !!currentDoc &&
                      !!groupId &&
                      !!nostrClient &&
                      !!getCurrentPrivateKey()
                    }
                    documentId={currentDoc.id}
                    groupId={groupId}
                    nostrClient={nostrClient}
                    userPrivateKey={getCurrentPrivateKey() ?? undefined}
                    userPublicKey={
                      getCurrentPrivateKey() ? getPublicKey(getCurrentPrivateKey()!) : undefined
                    }
                    userName={currentIdentity?.name || 'Anonymous'}
                    collaboratorPubkeys={collaboratorPubkeys}
                  />
                </div>

                {/* Comment Sidebar */}
                {showCommentSidebar && currentDoc && (
                  <div className="w-80 border-l shrink-0">
                    <CommentSidebar
                      documentId={currentDoc.id}
                      currentUserPubkey={currentUserPubkey}
                      onCommentClick={handleCommentClick}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Document List View */
            <>
              {/* List Header */}
              <div className="border-b p-3">
                <div className="flex items-center gap-2">
                  {!showFolderTree && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowFolderTree(true)}
                    >
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                  )}

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button onClick={() => { setTitle(''); setContent(''); setSelectedTemplate(''); }}>
                        <Plus className="mr-2 h-4 w-4" /> {t('documentsPage.newDocument')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t('documentsPage.createNewDocument')}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Input
                          placeholder={t('documentsPage.documentTitlePlaceholder')}
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                        />
                        <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                          <SelectTrigger>
                            <SelectValue placeholder={t('documentsPage.chooseTemplate')} />
                          </SelectTrigger>
                          <SelectContent>
                            {documentTemplates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button onClick={handleCreate} disabled={!title.trim() || isCreating} className="w-full">
                          {isCreating ? t('documentsPage.creating') : t('documentsPage.createDocument')}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <div className="flex-1" />

                  {/* Search */}
                  <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('documentsPage.searchDocuments')}
                      className="pl-8"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {/* Sort */}
                  <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="updated">{t('documentsPage.sort.lastUpdated')}</SelectItem>
                      <SelectItem value="created">{t('documentsPage.sort.dateCreated')}</SelectItem>
                      <SelectItem value="name">{t('documentsPage.sort.name')}</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* View Mode */}
                  <div className="flex border rounded-md">
                    <Button
                      variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="rounded-r-none"
                      onClick={() => setViewMode('list')}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="rounded-l-none"
                      onClick={() => setViewMode('grid')}
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Epic 58: Export Sharing Report */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportSharingReport}
                        disabled={exportingReport}
                      >
                        <FileSpreadsheet className="h-4 w-4 mr-1" />
                        {exportingReport ? t('documentsPage.exporting') : t('documentsPage.exportSharing')}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('documentsPage.exportTooltip')}
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Tag Filters */}
                {(availableTags.length > 0 || selectedTags.length > 0) && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                    {selectedTags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="default"
                        className="cursor-pointer gap-1"
                        onClick={() => setSelectedTags(selectedTags.filter((t) => t !== tag))}
                      >
                        {tag}
                        <X className="h-3 w-3" />
                      </Badge>
                    ))}
                    {availableTags
                      .filter((tag) => !selectedTags.includes(tag))
                      .slice(0, 8)
                      .map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => setSelectedTags([...selectedTags, tag])}
                        >
                          {tag}
                        </Badge>
                      ))}
                    {availableTags.length > 8 && (
                      <span className="text-xs text-muted-foreground">
                        {t('documentsPage.tags.moreCount', { count: availableTags.length - 8 })}
                      </span>
                    )}
                    {selectedTags.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setSelectedTags([])}
                      >
                        {t('documentsPage.tags.clear')}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Document List/Grid */}
              <ScrollArea className="flex-1 p-4">
                {filteredAndSortedDocs.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center py-16">
                    <div className="text-center">
                      <FileX className="h-16 w-16 mx-auto mb-4 opacity-20" />
                      <p className="text-muted-foreground">
                        {searchQuery
                          ? t('documentsPage.emptyState.noSearchResults')
                          : showStarred
                            ? t('documentsPage.emptyState.noStarred')
                            : t('documentsPage.emptyState.noDocuments')}
                      </p>
                      {!searchQuery && !showStarred && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {t('documentsPage.emptyState.noDocumentsHint')}
                        </p>
                      )}
                    </div>
                  </div>
                ) : viewMode === 'list' ? (
                  <div className="space-y-2">
                    {filteredAndSortedDocs.map((doc) => renderDocumentListItem(doc))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredAndSortedDocs.map((doc) => renderDocumentGridItem(doc))}
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
