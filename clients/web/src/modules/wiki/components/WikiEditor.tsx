/**
 * WikiEditor — Wiki page editor view
 * Reuses the documents module's TipTapEditor with full collaboration,
 * comments, suggestions, and rich text features.
 * Collaboration is always enabled — wiki pages are inherently collaborative.
 */

import { FC, useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { TipTapEditor } from '@/modules/documents/components/TipTapEditor'
import { CommentSidebar } from '@/modules/documents/components/CommentSidebar'
import { useDocumentsStore } from '@/modules/documents/documentsStore'
import { documentManager } from '@/modules/documents/documentManager'
import { useAuthStore, getCurrentPrivateKey } from '@/stores/authStore'
import { useGroupsStore } from '@/stores/groupsStore'
import { getNostrClient } from '@/core/nostr/client'
import { getPublicKey } from 'nostr-tools'
import type { DBGroupMember } from '@/core/storage/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ArrowLeft,
  Save,
  MessageSquare,
  Edit3,
  Tag,
  Plus,
  X,
  Trash2,
} from 'lucide-react'
import { useWikiStore } from '../wikiStore'
import { generateSlug } from '../types'
import type { WikiPage } from '../types'

interface WikiEditorProps {
  page: WikiPage
  groupId: string
  onBack: () => void
}

export const WikiEditor: FC<WikiEditorProps> = ({ page, groupId, onBack }) => {
  const { t } = useTranslation()
  const updatePage = useWikiStore((s) => s.updatePage)
  const removePage = useWikiStore((s) => s.removePage)
  const setCurrentPage = useWikiStore((s) => s.setCurrentPage)

  // Documents store for comments & suggestions
  const {
    getUnresolvedComments,
    suggestionModeEnabled,
    toggleSuggestionMode,
    addDocumentTag,
    removeDocumentTag,
  } = useDocumentsStore()

  // Auth & collaboration
  const currentIdentity = useAuthStore((s) => s.currentIdentity)
  const { groupMembers, loadGroupMembers } = useGroupsStore()
  const nostrClient = getNostrClient()

  // Local UI state
  const [title, setTitle] = useState(page.title)
  const [content, setContent] = useState(page.content)
  const [showCommentSidebar, setShowCommentSidebar] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showTagInput, setShowTagInput] = useState(false)
  const [newTagValue, setNewTagValue] = useState('')

  const currentUserPubkey = useMemo(() => {
    const pk = getCurrentPrivateKey()
    return pk ? getPublicKey(pk) : ''
  }, [])

  const commentCount = useMemo(
    () => getUnresolvedComments(page.id).length,
    [page.id, getUnresolvedComments],
  )

  const collaboratorPubkeys = useMemo(() => {
    const members = groupMembers.get(groupId)
    return members ? members.map((m: DBGroupMember) => m.pubkey) : []
  }, [groupMembers, groupId])

  // Load group members for collaboration
  useEffect(() => {
    if (groupId) {
      loadGroupMembers(groupId)
    }
  }, [groupId, loadGroupMembers])

  // Sync title when page changes externally
  useEffect(() => {
    setTitle(page.title)
    setContent(page.content)
  }, [page.id, page.title, page.content])

  // Explicit save — publishes a new version
  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      updatePage(page.id, {
        title,
        content,
        slug: generateSlug(title || `untitled-${page.id.slice(0, 8)}`),
        status: 'published',
      })

      const privateKey = getCurrentPrivateKey()
      if (privateKey) {
        try {
          await documentManager.updateDocument(
            page.id,
            { title, content },
            privateKey,
            'Published wiki page',
          )
        } catch {
          // Document may not exist yet in documents store
        }
      }
    } finally {
      setIsSaving(false)
    }
  }, [page.id, title, content, updatePage])

  // Auto-save to wiki store + persist every 30s
  useEffect(() => {
    if (!currentIdentity) return

    const interval = setInterval(async () => {
      if (content !== page.content || title !== page.title) {
        updatePage(page.id, {
          title,
          content,
          slug: generateSlug(title || `untitled-${page.id.slice(0, 8)}`),
        })

        const privateKey = getCurrentPrivateKey()
        if (privateKey) {
          try {
            await documentManager.updateDocument(
              page.id,
              { title, content },
              privateKey,
              'Wiki page update',
            )
          } catch {
            // Document may not exist yet in documents store
          }
        }
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [currentIdentity, content, title, page.id, page.content, page.title, updatePage])

  // Content change handler
  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent)
      updatePage(page.id, { content: newContent })
    },
    [page.id, updatePage],
  )

  const handleTitleChange = useCallback(
    (value: string) => {
      setTitle(value)
      updatePage(page.id, {
        title: value,
        slug: generateSlug(value || `untitled-${page.id.slice(0, 8)}`),
      })
    },
    [page.id, updatePage],
  )

  const handleDelete = useCallback(() => {
    const confirmed = window.confirm(
      t('wiki:deletePage', { title: page.title || t('wiki:untitledPage') }),
    )
    if (!confirmed) return
    removePage(page.id)
    setCurrentPage(null)
  }, [page.id, page.title, removePage, setCurrentPage, t])

  const handleAddTag = useCallback(
    (tag: string) => {
      const currentTags = page.tags ?? []
      if (!currentTags.includes(tag)) {
        updatePage(page.id, { tags: [...currentTags, tag] })
      }
      addDocumentTag(page.id, tag)
    },
    [page.id, page.tags, updatePage, addDocumentTag],
  )

  const handleRemoveTag = useCallback(
    (tag: string) => {
      const currentTags = page.tags ?? []
      updatePage(page.id, { tags: currentTags.filter((t) => t !== tag) })
      removeDocumentTag(page.id, tag)
    },
    [page.id, page.tags, updatePage, removeDocumentTag],
  )

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header bar */}
        <div className="border-b p-3 flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('wiki:backToList')}</TooltipContent>
          </Tooltip>

          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="flex-1 text-lg font-semibold border-none shadow-none focus-visible:ring-0"
            placeholder={t('wiki:titlePlaceholder')}
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
                  {suggestionModeEnabled
                    ? t('documentsPage.editor.suggesting')
                    : t('documentsPage.editor.editing')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {suggestionModeEnabled
                  ? t('documentsPage.editor.suggestionModeTooltip')
                  : t('documentsPage.editor.editModeTooltip')}
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
                  {commentCount > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs px-1.5">
                      {commentCount}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {showCommentSidebar
                  ? t('documentsPage.editor.hideComments')
                  : t('documentsPage.editor.showComments')}
              </TooltipContent>
            </Tooltip>

            {/* Save / Publish */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('documentsPage.editor.saveDocument')}</TooltipContent>
            </Tooltip>

            {/* Delete */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('wiki:deletePage')}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Tags Row */}
        <div className="border-b px-3 py-2 flex items-center gap-2 bg-muted/30">
          <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
          {(page.tags ?? []).map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1 cursor-pointer hover:bg-secondary/80"
              onClick={() => handleRemoveTag(tag)}
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
                    handleAddTag(newTagValue.trim())
                    setNewTagValue('')
                    setShowTagInput(false)
                  }
                  if (e.key === 'Escape') {
                    setNewTagValue('')
                    setShowTagInput(false)
                  }
                }}
                placeholder={t('wiki:addTagPlaceholder')}
                className="h-6 w-24 text-xs"
                autoFocus
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => {
                  if (newTagValue.trim()) handleAddTag(newTagValue.trim())
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
              {t('wiki:addTag')}
            </Button>
          )}

          {/* Status badge */}
          <div className="ml-auto">
            <Badge variant="outline" className="text-xs capitalize">
              {page.status}
            </Badge>
          </div>
        </div>

        {/* Editor + Comments */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-auto p-4">
            <TipTapEditor
              content={content}
              onChange={handleContentChange}
              enableCollaboration={!!nostrClient && !!getCurrentPrivateKey()}
              documentId={page.id}
              groupId={groupId}
              nostrClient={nostrClient}
              userPrivateKey={getCurrentPrivateKey() ?? undefined}
              userPublicKey={currentUserPubkey || undefined}
              userName={currentIdentity?.name || 'Anonymous'}
              collaboratorPubkeys={collaboratorPubkeys}
              suggestionMode={suggestionModeEnabled}
              placeholder={t('wiki:editorPlaceholder')}
            />
          </div>

          {/* Comment Sidebar */}
          {showCommentSidebar && (
            <div className="w-80 border-l shrink-0">
              <CommentSidebar
                documentId={page.id}
                currentUserPubkey={currentUserPubkey}
                onCommentClick={() => {
                  // Comment position navigation deferred
                }}
              />
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
