/**
 * TipTap WYSIWYG Editor Component
 * Rich text editing with formatting, tables, images, code blocks, comments, and suggestions
 * Real-time collaboration via Yjs CRDT with encrypted Nostr transport
 */

import { FC, useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
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
  GitBranch,
  ListTree,
  Superscript,
  ChevronDown,
  PenLine,
  Play,
  // Epic 56: New icons for page breaks and headers/footers
  SeparatorHorizontal,
  FileText,
} from 'lucide-react'
import { EncryptedNostrProvider } from '../providers/EncryptedNostrProvider'
import { CommentMark } from '../extensions/CommentMark'
import { SuggestionMark } from '../extensions/SuggestionMark'
import { MathBlock } from '../extensions/MathBlock'
import { MermaidBlock } from '../extensions/MermaidBlock'
import { TableOfContents } from '../extensions/TableOfContents'
import { Footnote } from '../extensions/Footnote'
import { SuggestionModeExtension } from '../extensions/SuggestionModePlugin'
import { SecureEmbed, EmbedInputDialog } from '../extensions/SecureEmbed'
// Epic 56: Page breaks, Headers/Footers
import { PageBreak } from '../extensions/PageBreak'
import { HeaderFooter } from '../extensions/HeaderFooter'
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
  const { t } = useTranslation();
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null)
  const [_provider, setProvider] = useState<EncryptedNostrProvider | null>(null)
  const [awareness, setAwareness] = useState<Awareness | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isSynced, setIsSynced] = useState(false)
  const [participants, setParticipants] = useState<ParticipantPresence[]>([])
  const [showCommentPopover, setShowCommentPopover] = useState(false)
  const [commentText, setCommentText] = useState('')

  const { addComment } = useDocumentsStore()

  // Ref to hold the provider so we can update recipients without tearing down
  const providerRef = useRef<EncryptedNostrProvider | null>(null)

  // Initialize Yjs and providers for collaboration
  // Only tears down when identity or document fundamentally changes, NOT on collaborator list updates
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
    providerRef.current = nostrProvider

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

    // Cleanup on unmount or when identity/document changes
    return () => {
      providerRef.current = null
      nostrProvider.destroy()
      indexeddbProvider.destroy()
      doc.destroy()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- collaboratorPubkeys and userName are handled by separate effects
  }, [enableCollaboration, documentId, groupId, nostrClient, userPrivateKey, userPublicKey])

  // Update recipient pubkeys on the existing provider when collaborators change
  // This avoids tearing down the entire Yjs doc + Nostr connection
  useEffect(() => {
    if (providerRef.current && userPublicKey) {
      providerRef.current.updateRecipients([userPublicKey, ...collaboratorPubkeys])
    }
  }, [collaboratorPubkeys, userPublicKey])

  // Build extensions array
  const extensions = useMemo(() => {
    const baseExtensions: any[] = [
      StarterKit.configure({
        codeBlock: false, // Disable default code block to use lowlight version
        link: false, // Disable default to use custom Link config below
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
      // Epic 56: Advanced editing extensions
      MermaidBlock,
      TableOfContents,
      Footnote,
      // Secure social media embeds
      SecureEmbed,
      // Epic 56: Page breaks and Headers/Footers
      PageBreak,
      HeaderFooter,
      // Suggestion mode plugin
      SuggestionModeExtension.configure({
        enabled: suggestionMode,
      }),
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
  }, [enableCollaboration, ydoc, awareness, userName, placeholder, suggestionMode])

  const editor = useEditor({
    extensions,
    // Only skip content prop when Yjs collaboration is actually active (ydoc exists).
    // If enableCollaboration is requested but Yjs hasn't initialized (no relay, no keys),
    // we still need the content prop to render the stored content.
    content: (enableCollaboration && ydoc) ? undefined : content,
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

  // Epic 56: Suggestion mode is now implemented via SuggestionModeExtension plugin

  if (!editor) {
    return null
  }

  const addImage = () => {
    const url = window.prompt(t('editor.enterImageUrl'))
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }

  const setLink = () => {
    const url = window.prompt(t('editor.enterUrl'))
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
      attrs: { equation: 'E = mc^2' },
    }).run()
  }

  // Epic 56: Advanced insert functions
  const insertMermaid = () => {
    editor.chain().focus().insertContent({
      type: 'mermaidBlock',
      attrs: { diagram: '' },
    }).run()
  }

  const insertTableOfContents = () => {
    editor.chain().focus().insertContent({
      type: 'tableOfContents',
    }).run()
  }

  const insertFootnote = () => {
    editor.chain().focus().insertContent({
      type: 'footnote',
      attrs: { content: '' },
    }).run()
  }

  // Epic 56: Page break and header/footer insert functions
  const insertPageBreak = () => {
    editor.chain().focus().insertPageBreak().run()
  }

  const insertHeader = () => {
    editor.chain().focus().insertHeader().run()
  }

  const insertFooter = () => {
    editor.chain().focus().insertFooter().run()
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
                <span className="text-sm font-medium">{t('editor.connected')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-orange-600">
                <WifiOff className="h-4 w-4" />
                <span className="text-sm font-medium">{t('editor.connecting')}</span>
              </div>
            )}

            {isSynced && (
              <Badge variant="secondary" className="text-xs">
                {t('editor.synced')}
              </Badge>
            )}

            {suggestionMode && (
              <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                {t('editor.suggesting')}
              </Badge>
            )}
          </div>

          {/* Active participants */}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {t('editor.active', { count: participants.length })}
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
            <TooltipContent>{t('editor.bold')}</TooltipContent>
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
            <TooltipContent>{t('editor.italic')}</TooltipContent>
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
            <TooltipContent>{t('editor.strikethrough')}</TooltipContent>
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
            <TooltipContent>{t('editor.inlineCode')}</TooltipContent>
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
            <TooltipContent>{t('editor.heading1')}</TooltipContent>
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
            <TooltipContent>{t('editor.heading2')}</TooltipContent>
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
            <TooltipContent>{t('editor.heading3')}</TooltipContent>
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
            <TooltipContent>{t('editor.bulletList')}</TooltipContent>
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
            <TooltipContent>{t('editor.numberedList')}</TooltipContent>
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
            <TooltipContent>{t('editor.blockquote')}</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-8" />

          {/* Media & Links */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={addImage}>
                <ImageIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('editor.insertImage')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={setLink}>
                <LinkIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('editor.insertLink')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={insertTable}>
                <TableIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('editor.insertTable')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <EmbedInputDialog
                  onInsert={(url) => {
                    editor.chain().focus().setSecureEmbed(url).run()
                  }}
                  trigger={
                    <Button variant="ghost" size="sm">
                      <Play className="h-4 w-4" />
                    </Button>
                  }
                />
              </span>
            </TooltipTrigger>
            <TooltipContent>{t('editor.embedMedia')}</TooltipContent>
          </Tooltip>

          {/* Advanced Insert Dropdown - Epic 56 */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{t('editor.insertBlock')}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={insertMath}>
                <Sigma className="h-4 w-4 mr-2" />
                {t('editor.mathEquation')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={insertMermaid}>
                <GitBranch className="h-4 w-4 mr-2" />
                {t('editor.diagram')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={insertTableOfContents}>
                <ListTree className="h-4 w-4 mr-2" />
                {t('editor.tableOfContents')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={insertFootnote}>
                <Superscript className="h-4 w-4 mr-2" />
                {t('editor.footnote')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={insertPageBreak}>
                <SeparatorHorizontal className="h-4 w-4 mr-2" />
                {t('editor.pageBreak')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={insertHeader}>
                <FileText className="h-4 w-4 mr-2" />
                {t('editor.documentHeader')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={insertFooter}>
                <FileText className="h-4 w-4 mr-2" />
                {t('editor.documentFooter')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
              <TooltipContent>{t('editor.addComment')}</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">{t('editor.addComment')}</h4>
                <Textarea
                  placeholder={t('editor.writeComment')}
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
                    {t('editor.cancel')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAddComment}
                    disabled={!commentText.trim()}
                  >
                    {t('editor.comment')}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Suggestion Mode Toggle - Epic 56 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={suggestionMode ? 'bg-orange-100 text-orange-700' : ''}
              >
                <PenLine className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {suggestionMode ? t('editor.suggestionModeActive') : t('editor.suggestionModeTrack')}
            </TooltipContent>
          </Tooltip>

          {/* Highlight indicator for suggestions */}
          {suggestionMode && (
            <Badge variant="outline" className="ml-1 text-xs bg-orange-50 text-orange-700 border-orange-200">
              <Highlighter className="h-3 w-3 mr-1" />
              {t('editor.suggesting')}
            </Badge>
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
            <TooltipContent>{t('editor.undo')}</TooltipContent>
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
            <TooltipContent>{t('editor.redo')}</TooltipContent>
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
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={insertFootnote}
              title={t('editor.addFootnote')}
            >
              <Superscript className="h-3 w-3" />
            </Button>
          </div>
        </BubbleMenu>
      )}

      <EditorContent editor={editor} className="min-h-[300px]" />
    </div>
  )
}
