/**
 * TipTap WYSIWYG Editor Component
 * Rich text editing with formatting, tables, images, and code blocks
 * Now with real-time collaboration via Yjs CRDT
 */

import { FC, useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
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
} from 'lucide-react'
import { EncryptedNostrProvider } from '../providers/EncryptedNostrProvider'
import type { NostrClient } from '@/core/nostr/client'
import type { ParticipantPresence } from '../types'

const lowlight = createLowlight(common)

// Generate random color for cursor
const generateCursorColor = () => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
  ]
  return colors[Math.floor(Math.random() * colors.length)]
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
}) => {
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null)
  const [_provider, setProvider] = useState<EncryptedNostrProvider | null>(null)
  const [awareness, setAwareness] = useState<Awareness | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isSynced, setIsSynced] = useState(false)
  const [participants, setParticipants] = useState<ParticipantPresence[]>([])

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
      console.log('Loaded document from IndexedDB')
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
    nostrProvider.on('status', ({ status }: any) => {
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

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // Disable default code block to use lowlight version
        // Note: Disable history when using collaboration (Yjs handles it)
      }),
      ...(enableCollaboration && ydoc && awareness ? [
        Collaboration.configure({
          document: ydoc,
        }),
        CollaborationCursor.configure({
          provider: awareness,
          user: {
            name: userName,
            color: awareness.getLocalState()?.user?.color || generateCursorColor(),
          },
        }),
      ] : []),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 hover:underline',
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
    ],
    content: enableCollaboration ? undefined : content, // Don't set content when using collaboration
    editable,
    onUpdate: ({ editor }) => {
      if (!enableCollaboration) {
        onChange(editor.getHTML())
      } else {
        // In collaboration mode, sync happens automatically via Yjs
        onChange(editor.getHTML())
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4',
        'data-placeholder': placeholder,
      },
    },
  })

  useEffect(() => {
    if (editor && !enableCollaboration && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor, enableCollaboration])

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
          </div>

          {/* Active participants */}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {participants.length} active
            </span>
            <div className="flex -space-x-2">
              {participants.slice(0, 5).map((participant) => (
                <div
                  key={participant.pubkey}
                  className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: participant.color }}
                  title={participant.name}
                >
                  {participant.name.charAt(0).toUpperCase()}
                </div>
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

      {editable && (
        <div className="border-b bg-muted/50 p-2 flex flex-wrap gap-1">
          {/* Text formatting */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive('bold') ? 'bg-muted' : ''}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive('italic') ? 'bg-muted' : ''}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={editor.isActive('strike') ? 'bg-muted' : ''}
          >
            <Strikethrough className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={editor.isActive('code') ? 'bg-muted' : ''}
          >
            <Code className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-8" />

          {/* Headings */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={editor.isActive('heading', { level: 1 }) ? 'bg-muted' : ''}
          >
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={editor.isActive('heading', { level: 2 }) ? 'bg-muted' : ''}
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={editor.isActive('heading', { level: 3 }) ? 'bg-muted' : ''}
          >
            <Heading3 className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-8" />

          {/* Lists */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive('bulletList') ? 'bg-muted' : ''}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={editor.isActive('orderedList') ? 'bg-muted' : ''}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={editor.isActive('blockquote') ? 'bg-muted' : ''}
          >
            <Quote className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-8" />

          {/* Media & Links */}
          <Button variant="ghost" size="sm" onClick={addImage}>
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={setLink}>
            <LinkIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={insertTable}>
            <TableIcon className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-8" />

          {/* Undo/Redo */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>
      )}

      <EditorContent editor={editor} className="min-h-[300px]" />
    </div>
  )
}
