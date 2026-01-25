/**
 * Comment Sidebar Component
 * Displays and manages inline comments for a document
 * Epic 56: Supports @mentions in comments
 */

import { FC, useState, useMemo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDocumentsStore } from '../documentsStore'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  MessageSquare,
  Check,
  Reply,
  Trash2,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  AtSign,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { DocumentComment } from '../types'
import { formatDistanceToNow } from 'date-fns'

/**
 * User type for mentions
 */
interface MentionableUser {
  pubkey: string
  displayName: string
  username?: string
}

interface CommentSidebarProps {
  documentId: string
  currentUserPubkey: string
  onCommentClick?: (comment: DocumentComment) => void
  /** List of users that can be mentioned */
  mentionableUsers?: MentionableUser[]
  /** Callback when a user is mentioned */
  onMention?: (pubkey: string) => void
}

/**
 * Parse @mentions from comment content
 * Supports @username format
 */
const parseMentions = (content: string): string[] => {
  const mentionRegex = /@(\w+)/g
  const matches = content.match(mentionRegex)
  return matches ? matches.map((m) => m.slice(1)) : []
}

/**
 * Render comment content with highlighted @mentions
 */
const renderContentWithMentions = (
  content: string,
  mentionableUsers: MentionableUser[],
  onMentionClick?: (pubkey: string) => void
): React.ReactNode => {
  // Regex to match @mentions
  const mentionRegex = /@(\w+)/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match

  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index))
    }

    const username = match[1]
    // Find the user by username or displayName
    const user = mentionableUsers.find(
      (u) =>
        u.username?.toLowerCase() === username.toLowerCase() ||
        u.displayName.toLowerCase().replace(/\s+/g, '').includes(username.toLowerCase())
    )

    if (user) {
      // Render as highlighted mention
      parts.push(
        <span
          key={`mention-${match.index}`}
          className={cn(
            'inline-flex items-center rounded bg-blue-100 dark:bg-blue-900/30',
            'px-1 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300',
            onMentionClick && 'cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800/40'
          )}
          onClick={(e) => {
            e.stopPropagation()
            onMentionClick?.(user.pubkey)
          }}
          title={`User: ${user.pubkey.slice(0, 8)}...`}
        >
          @{user.displayName}
        </span>
      )
    } else {
      // Render as plain @mention (user not found)
      parts.push(
        <span
          key={`mention-${match.index}`}
          className="text-blue-600 dark:text-blue-400"
        >
          @{username}
        </span>
      )
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex))
  }

  return parts.length > 0 ? parts : content
}

interface CommentItemProps {
  comment: DocumentComment
  replies: DocumentComment[]
  currentUserPubkey: string
  onResolve: () => void
  onReply: (content: string, mentions: string[]) => void
  onDelete: () => void
  onClick?: () => void
  mentionableUsers?: MentionableUser[]
  onMentionClick?: (pubkey: string) => void
}

const CommentItem: FC<CommentItemProps> = ({
  comment,
  replies,
  currentUserPubkey,
  onResolve,
  onReply,
  onDelete,
  onClick,
  mentionableUsers = [],
  onMentionClick,
}) => {
  const { t } = useTranslation()
  const [isReplying, setIsReplying] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [showReplies, setShowReplies] = useState(true)
  const [showMentionPopover, setShowMentionPopover] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isOwner = comment.authorPubkey === currentUserPubkey
  const hasReplies = replies.length > 0

  // Filter mentionable users based on search
  const filteredUsers = useMemo(() => {
    if (!mentionSearch) return mentionableUsers.slice(0, 5)
    const search = mentionSearch.toLowerCase()
    return mentionableUsers
      .filter(
        (u) =>
          u.displayName.toLowerCase().includes(search) ||
          u.username?.toLowerCase().includes(search)
      )
      .slice(0, 5)
  }, [mentionableUsers, mentionSearch])

  // Handle @ key to show mention popover
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === '@') {
      setShowMentionPopover(true)
      setMentionSearch('')
    } else if (showMentionPopover) {
      if (e.key === 'Escape') {
        setShowMentionPopover(false)
      } else if (e.key === 'Backspace' && mentionSearch === '') {
        setShowMentionPopover(false)
      }
    }
  }, [showMentionPopover, mentionSearch])

  // Update mention search from textarea content
  const handleReplyChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setReplyContent(value)

    // Check if we're in a mention context
    const cursorPos = e.target.selectionStart
    const textBeforeCursor = value.slice(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1 && showMentionPopover) {
      const searchText = textBeforeCursor.slice(lastAtIndex + 1)
      // Only update if no space after @
      if (!searchText.includes(' ')) {
        setMentionSearch(searchText)
      } else {
        setShowMentionPopover(false)
      }
    }
  }, [showMentionPopover])

  // Insert mention into textarea
  const insertMention = useCallback((user: MentionableUser) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const textBeforeCursor = replyContent.slice(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    const textAfterCursor = replyContent.slice(cursorPos)

    // Replace @search with @username
    const newText =
      replyContent.slice(0, lastAtIndex) +
      `@${user.username || user.displayName.replace(/\s+/g, '')} ` +
      textAfterCursor

    setReplyContent(newText)
    setShowMentionPopover(false)
    setMentionSearch('')

    // Focus back on textarea
    setTimeout(() => {
      textarea.focus()
      const newCursorPos = lastAtIndex + (user.username || user.displayName).length + 2
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }, [replyContent])

  const handleSubmitReply = () => {
    if (!replyContent.trim()) return
    const mentions = parseMentions(replyContent)
    // Convert usernames to pubkeys
    const mentionPubkeys = mentions
      .map((username) => {
        const user = mentionableUsers.find(
          (u) =>
            u.username?.toLowerCase() === username.toLowerCase() ||
            u.displayName.toLowerCase().replace(/\s+/g, '') === username.toLowerCase()
        )
        return user?.pubkey
      })
      .filter((p): p is string => !!p)
    onReply(replyContent.trim(), mentionPubkeys)
    setReplyContent('')
    setIsReplying(false)
  }

  // Generate initials from pubkey
  const initials = comment.authorPubkey.slice(0, 2).toUpperCase()

  // Generate a consistent color from pubkey
  const avatarColor = useMemo(() => {
    const colors = [
      'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
      'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
      'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
      'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
    ]
    const hash = comment.authorPubkey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }, [comment.authorPubkey])

  return (
    <div
      className={cn(
        'border rounded-lg p-3 space-y-2 transition-colors',
        comment.resolved ? 'bg-muted/50 opacity-70' : 'bg-background',
        onClick && 'cursor-pointer hover:border-primary/50',
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarFallback className={cn('text-xs text-white', avatarColor)}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="text-xs text-muted-foreground">
            {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
          </div>
          {comment.resolved && (
            <Badge variant="secondary" className="text-xs">
              {t('commentSidebar.resolved')}
            </Badge>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!comment.resolved && (
              <DropdownMenuItem onClick={onResolve}>
                <Check className="h-4 w-4 mr-2" />
                {t('commentSidebar.actions.resolve')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setIsReplying(true)}>
              <Reply className="h-4 w-4 mr-2" />
              {t('commentSidebar.actions.reply')}
            </DropdownMenuItem>
            {isOwner && (
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                {t('commentSidebar.actions.delete')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Quoted text */}
      {comment.quotedText && (
        <div className="text-xs bg-muted rounded px-2 py-1 border-l-2 border-yellow-500 italic">
          "{comment.quotedText}"
        </div>
      )}

      {/* Comment content with @mention highlighting */}
      <p className="text-sm">
        {renderContentWithMentions(comment.content, mentionableUsers, onMentionClick)}
      </p>

      {/* Show mentioned users if any */}
      {comment.mentions && comment.mentions.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <AtSign className="h-3 w-3" />
          <span>
            {t('commentSidebar.mentioned', { count: comment.mentions.length })}
          </span>
        </div>
      )}

      {/* Reply input with @mention support */}
      {isReplying && (
        <div className="space-y-2 pt-2 border-t">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              placeholder={t('commentSidebar.reply.placeholder')}
              value={replyContent}
              onChange={handleReplyChange}
              onKeyDown={handleKeyDown}
              className="min-h-[60px] text-sm"
              autoFocus
            />
            {/* Mention suggestions popover */}
            {showMentionPopover && filteredUsers.length > 0 && (
              <Popover open={showMentionPopover} onOpenChange={setShowMentionPopover}>
                <PopoverTrigger asChild>
                  <span className="sr-only">{t('commentSidebar.mentionSuggestions')}</span>
                </PopoverTrigger>
                <PopoverContent
                  className="w-64 p-0"
                  align="start"
                  side="bottom"
                  sideOffset={4}
                >
                  <div className="py-1">
                    {filteredUsers.map((user) => (
                      <button
                        key={user.pubkey}
                        type="button"
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                        onClick={() => insertMention(user)}
                      >
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-xs">
                            {user.displayName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col items-start min-w-0">
                          <span className="font-medium truncate">{user.displayName}</span>
                          {user.username && (
                            <span className="text-xs text-muted-foreground">@{user.username}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              <AtSign className="h-3 w-3 inline mr-1" />
              {t('commentSidebar.reply.mentionHint')}
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsReplying(false)
                  setReplyContent('')
                  setShowMentionPopover(false)
                }}
              >
                {t('commentSidebar.reply.cancel')}
              </Button>
              <Button size="sm" onClick={handleSubmitReply} disabled={!replyContent.trim()}>
                {t('commentSidebar.reply.submit')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Replies */}
      {hasReplies && (
        <div className="pt-2 border-t">
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation()
              setShowReplies(!showReplies)
            }}
          >
            {showReplies ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {replies.length === 1 ? t('commentSidebar.replies.one', { count: replies.length }) : t('commentSidebar.replies.other', { count: replies.length })}
          </button>

          {showReplies && (
            <div className="mt-2 space-y-2 pl-4 border-l-2 border-muted">
              {replies.map((reply) => (
                <div key={reply.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-xs bg-muted">
                        {reply.authorPubkey.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(reply.createdAt, { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm">
                    {renderContentWithMentions(reply.content, mentionableUsers, onMentionClick)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const CommentSidebar: FC<CommentSidebarProps> = ({
  documentId,
  currentUserPubkey,
  onCommentClick,
  mentionableUsers = [],
  onMention,
}) => {
  const { t } = useTranslation()
  const {
    getDocumentComments,
    getUnresolvedComments,
    resolveComment,
    deleteComment,
    addComment,
  } = useDocumentsStore()
  const [showResolved, setShowResolved] = useState(false)

  const allComments = getDocumentComments(documentId)
  const unresolvedComments = getUnresolvedComments(documentId)

  // Get root comments (no parent)
  const rootComments = useMemo(() => {
    const comments = showResolved ? allComments : unresolvedComments
    return comments.filter((c) => !c.parentCommentId)
  }, [allComments, unresolvedComments, showResolved])

  // Get replies for a comment
  const getReplies = (commentId: string) => {
    return allComments.filter((c) => c.parentCommentId === commentId)
  }

  const handleReply = (parentCommentId: string, content: string, mentions: string[] = []) => {
    const parentComment = allComments.find((c) => c.id === parentCommentId)
    if (!parentComment) return

    const reply: DocumentComment = {
      id: crypto.randomUUID(),
      documentId,
      authorPubkey: currentUserPubkey,
      content,
      createdAt: Date.now(),
      from: parentComment.from,
      to: parentComment.to,
      quotedText: '',
      parentCommentId,
      resolved: false,
      mentions,
    }

    addComment(reply)

    // Notify about mentions
    mentions.forEach((pubkey) => onMention?.(pubkey))
  }

  // Handle click on a mention
  const handleMentionClick = useCallback((pubkey: string) => {
    onMention?.(pubkey)
  }, [onMention])

  const resolvedCount = allComments.filter((c) => c.resolved && !c.parentCommentId).length
  const openCount = unresolvedComments.filter((c) => !c.parentCommentId).length

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="font-medium text-sm">{t('commentSidebar.title')}</span>
          </div>
          <Badge variant="secondary">{t('commentSidebar.openCount', { count: openCount })}</Badge>
        </div>

        {/* Toggle resolved */}
        {resolvedCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs"
            onClick={() => setShowResolved(!showResolved)}
          >
            {showResolved ? (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                {t('commentSidebar.hideResolved', { count: resolvedCount })}
              </>
            ) : (
              <>
                <ChevronRight className="h-3 w-3 mr-1" />
                {t('commentSidebar.showResolved', { count: resolvedCount })}
              </>
            )}
          </Button>
        )}
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {rootComments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">{t('commentSidebar.empty.title')}</p>
            <p className="text-xs">{t('commentSidebar.empty.description')}</p>
          </div>
        ) : (
          rootComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              replies={getReplies(comment.id)}
              currentUserPubkey={currentUserPubkey}
              onResolve={() => resolveComment(documentId, comment.id, currentUserPubkey)}
              onReply={(content, mentions) => handleReply(comment.id, content, mentions)}
              onDelete={() => deleteComment(documentId, comment.id)}
              onClick={() => onCommentClick?.(comment)}
              mentionableUsers={mentionableUsers}
              onMentionClick={handleMentionClick}
            />
          ))
        )}
      </div>
    </div>
  )
}
