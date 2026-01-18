/**
 * TipTap WYSIWYG Editor Component
 * Rich text editing with formatting, tables, images, code blocks, comments, and suggestions
 * Real-time collaboration via Yjs CRDT with encrypted Nostr transport
 */

import { FC, useEffect, useState, useCallback, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { Awareness } from 'y-protocols/awareness'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  ImageIcon,
  Link as LinkIcon,
  Table as TableIcon,
  Users,
  Wifi,
  WifiOff,
  MessageSquarePlus,
  Sigma,
  Highlighter,
} from 'lucide-react'
import { EncryptedNostrProvider } from '../providers/EncryptedNostrProvider'
import { CommentMark } from '../extensions/CommentMark'
import { SuggestionMark } from '../extensions/SuggestionMark'
import { MathBlock } from '../extensions/MathBlock'
import { useDocumentsStore } from '../documentsStore'
import { secureRandomInt } from '@/lib/utils'
import type { NostrClient } from '@/core/nostr/client'
import type { ParticipantPresence, DocumentComment } from '../types'

const lowlight = createLowlight(common)

// Generate random color for cursor
// SECURITY: Uses secureRandomInt to avoid Math.random() which is predictable
const generateCursorColor = () => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
  ]
  return colors[secureRandomInt(colors.length)]
}

interface TipTapEditorProps {
  content: string
  onChange: (content: string) => void
  editable?: boolean
  className?: string
  placeholder?: string
  // Collaboration props
  documentId?: string
  groupId?: string
  nostrClient?: NostrClient
  userPrivateKey?: Uint8Array
  userPublicKey?: string
  userName?: string
  collaboratorPubkeys?: string[]
  enableCollaboration?: boolean
  // Advanced features
  suggestionMode?: boolean
}

export const TipTapEditor: FC<TipTapEditorProps> = ({
  content,
  onChange,
  editable = true,
  className = '',
  placeholder = 'Start writing...',
  documentId,
  groupId,
  nostrClient,
  userPrivateKey,
  userPublicKey,
  userName = 'Anonymous',
  collaboratorPubkeys = [],
  enableCollaboration = false,
  suggestionMode = false,
}) => {
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null)
  const [_provider, setProvider] = useState<EncryptedNostrProvider | null>(null)
  const [awareness, setAwareness] = useState<Awareness | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isSynced, setIsSynced] = useState(false)
  const [participants, setParticipants] = useState<ParticipantPresence[]>([])
  const [showCommentPopover, setShowCommentPopover] = useState(false)
  const [commentText, setCommentText] = useState('')

  const { addComment } = useDocumentsStore()

  // Initialize Yjs and providers for collaboration
  useEffect(() => {
    if (!enableCollaboration || !documentId || !groupId || !nostrClient || !userPrivateKey || !userPublicKey) {
      return
    }

    // Create Yjs document
    const doc = new Y.Doc()
    setYdoc(doc)

    // Setup awareness for presence
    const awarenessInstance = new Awareness(doc)
    awarenessInstance.setLocalStateField('user', {
      name: userName,
      color: generateCursorColor(),
      pubkey: userPublicKey,
    })
    setAwareness(awarenessInstance)

    // Setup IndexedDB persistence for offline support
    const indexeddbProvider = new IndexeddbPersistence(`doc-${documentId}`, doc)
    indexeddbProvider.whenSynced.then(() => {
      console.info('Loaded document from IndexedDB')
    })

    // Setup Nostr provider for real-time sync
    const nostrProvider = new EncryptedNostrProvider({
      doc,
      nostrClient,
      senderPrivateKey: userPrivateKey,
      recipientPubkeys: [userPublicKey, ...collaboratorPubkeys],
      roomId: documentId,
      awareness: awarenessInstance,
    })
    setProvider(nostrProvider)

    // Listen to connection status
    nostrProvider.on('status', ({ status }: { status: string }) => {
      setIsConnected(status === 'connected')
    })

    nostrProvider.on('synced', () => {
      setIsSynced(true)
    })

    // Track participants from awareness
    awarenessInstance.on('change', () => {
      const states = awarenessInstance.getStates()
      const activeParticipants: ParticipantPresence[] = []

      states.forEach((state) => {
        if (state.user) {
          activeParticipants.push({
            pubkey: state.user.pubkey,
            name: state.user.name,
            color: state.user.color,
            cursor: state.cursor,
            lastSeen: Date.now(),
          })
        }
      })

      setParticipants(activeParticipants)
    })

    // Cleanup on unmount
    return () => {
      nostrProvider.destroy()
      indexeddbProvider.destroy()
      doc.destroy()
    }
  }, [enableCollaboration, documentId, groupId, nostrClient, userPrivateKey, userPublicKey, userName, collaboratorPubkeys])

  // Build extensions array
  const extensions = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseExtensions: any[] = [
      StarterKit.configure({
        codeBlock: false, // Disable default code block to use lowlight version
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 hover:underline cursor-pointer',
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      CodeBlockLowlight.configure({
        lowlight,
      }),
      Placeholder.configure({
        placeholder,
      }),
      // Custom extensions
      CommentMark,
      SuggestionMark,
      MathBlock,
    ]

    // Add collaboration extensions if enabled
    if (enableCollaboration && ydoc && awareness) {
      baseExtensions.push(
        Collaboration.configure({
          document: ydoc,
        }),
        CollaborationCursor.configure({
          provider: awareness,
          user: {
            name: userName,
            color: awareness.getLocalState()?.user?.color || generateCursorColor(),
          },
        })
      )
    }

    return baseExtensions
  }, [enableCollaboration, ydoc, awareness, userName, placeholder])

  const editor = useEditor({
    extensions,
    content: enableCollaboration ? undefined : content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4',
      },
    },
  })

  useEffect(() => {
    if (editor && !enableCollaboration && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor, enableCollaboration])

  // Handle adding a comment
  const handleAddComment = useCallback(() => {
    if (!editor || !commentText.trim() || !documentId || !userPublicKey) return

    const { from, to } = editor.state.selection
    const selectedText = editor.state.doc.textBetween(from, to, ' ')

    const commentId = crypto.randomUUID()

    // Add comment to store
    const comment: DocumentComment = {
      id: commentId,
      documentId,
      authorPubkey: userPublicKey,
      content: commentText.trim(),
      createdAt: Date.now(),
      from,
      to,
      quotedText: selectedText,
      resolved: false,
      mentions: [],
    }

    addComment(comment)

    // Mark the text with the comment
    editor.chain().focus().setComment(commentId).run()

    setCommentText('')
    setShowCommentPopover(false)
  }, [editor, commentText, documentId, userPublicKey, addComment])

  // TODO: Implement suggestion mode interceptor for track changes
  // This will hook into editor transactions to convert edits to suggestions

  if (!editor) {
    return null
  }

  const addImage = () => {
    const url = window.prompt('Enter image URL:')
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }

  const setLink = () => {
    const url = window.prompt('Enter URL:')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  const insertMath = () => {
    editor.chain().focus().insertContent({
      type: 'mathBlock',
      attrs: { latex: 'E = mc^2' },
    }).run()
  }

  const hasSelection = !editor.state.selection.empty

  return (
    <div className={`border rounded-lg ${className}`}>
      {/* Collaboration status bar */}
      {enableCollaboration && (
        <div className="border-b bg-muted/20 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isConnected ? (
              <div className="flex items-center gap-2 text-green-600">
                <Wifi className="h-4 w-4" />
                <span className="text-sm font-medium">Connected</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-orange-600">
                <WifiOff className="h-4 w-4" />
                <span className="text-sm font-medium">Connecting...</span>
              </div>
            )}

            {isSynced && (
              <Badge variant="secondary" className="text-xs">
                Synced
              </Badge>
            )}

            {suggestionMode && (
              <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                Suggesting
              </Badge>
            )}
          </div>

          {/* Active participants */}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {participants.length} active
            </span>
            <div className="flex -space-x-2">
              {participants.slice(0, 5).map((participant) => (
                <Tooltip key={participant.pubkey}>
                  <TooltipTrigger asChild>
                    <div
                      className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white cursor-default"
                      style={{ backgroundColor: participant.color }}
                    >
                      {participant.name.charAt(0).toUpperCase()}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{participant.name}</TooltipContent>
                </Tooltip>
              ))}
              {participants.length > 5 && (
                <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-400 flex items-center justify-center text-xs font-bold text-white">
                  +{participants.length - 5}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      {editable && (
        <div className="border-b bg-muted/50 p-2 flex flex-wrap gap-1">
          {/* Text formatting */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={editor.isActive('bold') ? 'bg-muted' : ''}
              >
                <Bold className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bold (Ctrl+B)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={editor.isActive('italic') ? 'bg-muted' : ''}
              >
                <Italic className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Italic (Ctrl+I)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={editor.isActive('strike') ? 'bg-muted' : ''}
              >
                <Strikethrough className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Strikethrough</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleCode().run()}
                className={editor.isActive('code') ? 'bg-muted' : ''}
              >
                <Code className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Inline Code</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-8" />

          {/* Headings */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={editor.isActive('heading', { level: 1 }) ? 'bg-muted' : ''}
              >
                <Heading1 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Heading 1</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={editor.isActive('heading', { level: 2 }) ? 'bg-muted' : ''}
              >
                <Heading2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Heading 2</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={editor.isActive('heading', { level: 3 }) ? 'bg-muted' : ''}
              >
                <Heading3 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Heading 3</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-8" />

          {/* Lists */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={editor.isActive('bulletList') ? 'bg-muted' : ''}
              >
                <List className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bullet List</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={editor.isActive('orderedList') ? 'bg-muted' : ''}
              >
                <ListOrdered className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Numbered List</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={editor.isActive('blockquote') ? 'bg-muted' : ''}
              >
                <Quote className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Blockquote</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-8" />

          {/* Media & Links */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={addImage}>
                <ImageIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Insert Image</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={setLink}>
                <LinkIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Insert Link</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={insertTable}>
                <TableIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Insert Table</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={insertMath}>
                <Sigma className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Insert Math Equation</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-8" />

          {/* Comments & Suggestions */}
          <Popover open={showCommentPopover} onOpenChange={setShowCommentPopover}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!hasSelection}
                    className={editor.isActive('comment') ? 'bg-muted' : ''}
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Add Comment</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Add Comment</h4>
                <Textarea
                  placeholder="Write your comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="min-h-[80px]"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCommentText('')
                      setShowCommentPopover(false)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAddComment}
                    disabled={!commentText.trim()}
                  >
                    Comment
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Highlight for suggestions */}
          {suggestionMode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-orange-600"
                >
                  <Highlighter className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Suggestion Mode Active</TooltipContent>
            </Tooltip>
          )}

          <Separator orientation="vertical" className="h-8" />

          {/* Undo/Redo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
              >
                <Undo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
              >
                <Redo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Bubble menu for quick formatting on selection */}
      {editor && (
        <BubbleMenu editor={editor} options={{ placement: 'top', offset: 6 }}>
          <div className="flex items-center gap-1 bg-background border rounded-lg shadow-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => editor.chain().focus().toggleCode().run()}
            >
              <Code className="h-3 w-3" />
            </Button>
            <Separator orientation="vertical" className="h-5 mx-1" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setShowCommentPopover(true)}
            >
              <MessageSquarePlus className="h-3 w-3" />
            </Button>
          </div>
        </BubbleMenu>
      )}

      <EditorContent editor={editor} className="min-h-[300px]" />
    </div>
  )
}
