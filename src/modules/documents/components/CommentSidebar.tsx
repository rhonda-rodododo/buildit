/**
 * Comment Sidebar Component
 * Displays and manages inline comments for a document
 */

import { FC, useState, useMemo } from 'react'
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
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { DocumentComment } from '../types'
import { formatDistanceToNow } from 'date-fns'

interface CommentSidebarProps {
  documentId: string
  currentUserPubkey: string
  onCommentClick?: (comment: DocumentComment) => void
}

interface CommentItemProps {
  comment: DocumentComment
  replies: DocumentComment[]
  currentUserPubkey: string
  onResolve: () => void
  onReply: (content: string) => void
  onDelete: () => void
  onClick?: () => void
}

const CommentItem: FC<CommentItemProps> = ({
  comment,
  replies,
  currentUserPubkey,
  onResolve,
  onReply,
  onDelete,
  onClick,
}) => {
  const [isReplying, setIsReplying] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [showReplies, setShowReplies] = useState(true)

  const isOwner = comment.authorPubkey === currentUserPubkey
  const hasReplies = replies.length > 0

  const handleSubmitReply = () => {
    if (!replyContent.trim()) return
    onReply(replyContent.trim())
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
              Resolved
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
                Resolve
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setIsReplying(true)}>
              <Reply className="h-4 w-4 mr-2" />
              Reply
            </DropdownMenuItem>
            {isOwner && (
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
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

      {/* Comment content */}
      <p className="text-sm">{comment.content}</p>

      {/* Reply input */}
      {isReplying && (
        <div className="space-y-2 pt-2 border-t">
          <Textarea
            placeholder="Write a reply..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            className="min-h-[60px] text-sm"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsReplying(false)
                setReplyContent('')
              }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmitReply} disabled={!replyContent.trim()}>
              Reply
            </Button>
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
            {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
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
                  <p className="text-sm">{reply.content}</p>
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
}) => {
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

  const handleReply = (parentCommentId: string, content: string) => {
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
      mentions: [],
    }

    addComment(reply)
  }

  const resolvedCount = allComments.filter((c) => c.resolved && !c.parentCommentId).length
  const openCount = unresolvedComments.filter((c) => !c.parentCommentId).length

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="font-medium text-sm">Comments</span>
          </div>
          <Badge variant="secondary">{openCount} open</Badge>
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
                Hide {resolvedCount} resolved
              </>
            ) : (
              <>
                <ChevronRight className="h-3 w-3 mr-1" />
                Show {resolvedCount} resolved
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
            <p className="text-sm">No comments yet</p>
            <p className="text-xs">Select text to add a comment</p>
          </div>
        ) : (
          rootComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              replies={getReplies(comment.id)}
              currentUserPubkey={currentUserPubkey}
              onResolve={() => resolveComment(documentId, comment.id, currentUserPubkey)}
              onReply={(content) => handleReply(comment.id, content)}
              onDelete={() => deleteComment(documentId, comment.id)}
              onClick={() => onCommentClick?.(comment)}
            />
          ))
        )}
      </div>
    </div>
  )
}
