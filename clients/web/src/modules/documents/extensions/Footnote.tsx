/**
 * Custom TipTap Footnote Extension
 * Inline footnote markers with collected footnotes at document end
 *
 * Epic 56: Advanced Document Features
 */

import { Node, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { FC, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { secureRandomInt } from '@/lib/utils'
import { X } from 'lucide-react'

const footnoteRenumberKey = new PluginKey('footnoteRenumber')

export interface FootnoteOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    footnote: {
      /**
       * Insert a footnote at the current position
       */
      insertFootnote: (content?: string) => ReturnType
    }
  }
}

interface FootnoteViewProps {
  node: {
    attrs: {
      id: string
      number: number
      content: string
    }
  }
  updateAttributes: (attrs: { content: string }) => void
  deleteNode: () => void
  selected: boolean
}

const FootnoteView: FC<FootnoteViewProps> = ({ node, updateAttributes, deleteNode, selected }) => {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [localContent, setLocalContent] = useState(node.attrs.content || '')
  const [showTooltip, setShowTooltip] = useState(false)

  const handleSave = useCallback(() => {
    updateAttributes({ content: localContent })
    setIsEditing(false)
  }, [localContent, updateAttributes])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      setLocalContent(node.attrs.content)
      setIsEditing(false)
    }
  }

  // Inline footnote marker
  if (!isEditing) {
    return (
      <NodeViewWrapper
        as="span"
        className={`inline ${selected ? 'ring-2 ring-blue-500 rounded' : ''}`}
      >
        <span
          className="relative inline-block"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <sup
            onClick={() => setIsEditing(true)}
            className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium ml-0.5 select-none"
            title={`${t('footnote.title', { number: node.attrs.number })}: ${node.attrs.content || t('footnote.clickToAdd')}`}
          >
            [{node.attrs.number}]
          </sup>

          {/* Tooltip preview */}
          {showTooltip && node.attrs.content && (
            <div
              className="
                absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2
                bg-popover text-popover-foreground
                border rounded-lg shadow-lg p-3
                max-w-xs text-sm
                whitespace-normal
              "
            >
              <div className="font-medium text-xs text-muted-foreground mb-1">
                {t('footnote.title', { number: node.attrs.number })}
              </div>
              <div className="text-sm">{node.attrs.content}</div>
              {/* Arrow */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                <div className="border-8 border-transparent border-t-popover" />
              </div>
            </div>
          )}
        </span>
      </NodeViewWrapper>
    )
  }

  // Editing mode - inline popup
  return (
    <NodeViewWrapper
      as="span"
      className={`inline ${selected ? 'ring-2 ring-blue-500 rounded' : ''}`}
    >
      <span className="relative inline-block">
        <sup className="text-blue-600 font-medium ml-0.5">[{node.attrs.number}]</sup>

        {/* Edit popup */}
        <div
          className="
            absolute z-50 top-full left-0 mt-1
            bg-popover border rounded-lg shadow-lg p-3
            w-72
          "
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-sm">{t('footnote.title', { number: node.attrs.number })}</span>
            <button
              onClick={deleteNode}
              className="p-1 rounded hover:bg-muted text-destructive"
              title={t('footnote.deleteFootnote')}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <textarea
            value={localContent}
            onChange={(e) => setLocalContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('footnote.enterContent')}
            className="w-full p-2 text-sm border rounded bg-background min-h-[80px] resize-none"
            autoFocus
          />

          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-muted-foreground">{t('footnote.ctrlEnterToSave')}</span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setLocalContent(node.attrs.content)
                  setIsEditing(false)
                }}
                className="px-2 py-1 text-xs rounded border hover:bg-muted"
                type="button"
              >
                {t('footnote.cancel')}
              </button>
              <button
                onClick={handleSave}
                className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90"
                type="button"
              >
                {t('footnote.save')}
              </button>
            </div>
          </div>
        </div>
      </span>
    </NodeViewWrapper>
  )
}

export const Footnote = Node.create<FootnoteOptions>({
  name: 'footnote',

  group: 'inline',

  inline: true,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-footnote-id'),
        renderHTML: (attributes) => ({
          'data-footnote-id': attributes.id,
        }),
      },
      number: {
        default: 1,
        parseHTML: (element) => parseInt(element.getAttribute('data-footnote-number') || '1', 10),
        renderHTML: (attributes) => ({
          'data-footnote-number': attributes.number,
        }),
      },
      content: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-footnote-content'),
        renderHTML: (attributes) => ({
          'data-footnote-content': attributes.content,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-footnote-id]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'footnote-marker',
      }),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(FootnoteView as any)
  },

  addCommands() {
    return {
      insertFootnote:
        (content = '') =>
        ({ commands, state }) => {
          // Count existing footnotes to get the next number
          let count = 0
          state.doc.descendants((node) => {
            if (node.type.name === 'footnote') {
              count++
            }
          })

          const id = `fn-${Date.now()}-${secureRandomInt(10000)}`
          const number = count + 1

          return commands.insertContent({
            type: this.name,
            attrs: { id, number, content },
          })
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: footnoteRenumberKey,
        appendTransaction: (_transactions, _oldState, newState) => {
          // Collect all footnote positions and their current numbers
          const footnotes: Array<{ pos: number; currentNumber: number }> = []
          let sequenceNumber = 0

          newState.doc.descendants((node, pos) => {
            if (node.type.name === 'footnote') {
              sequenceNumber++
              footnotes.push({ pos, currentNumber: node.attrs.number })
            }
          })

          // Check if renumbering is needed
          let needsRenumber = false
          sequenceNumber = 0
          for (const fn of footnotes) {
            sequenceNumber++
            if (fn.currentNumber !== sequenceNumber) {
              needsRenumber = true
              break
            }
          }

          if (!needsRenumber) return null

          // Create a transaction to renumber all footnotes
          const tr = newState.tr
          sequenceNumber = 0
          for (const fn of footnotes) {
            sequenceNumber++
            if (fn.currentNumber !== sequenceNumber) {
              tr.setNodeAttribute(fn.pos, 'number', sequenceNumber)
            }
          }

          return tr
        },
      }),
    ]
  },
})

