/**
 * Custom TipTap Table of Contents Extension
 * Auto-generates a navigable TOC from document headings
 *
 * Epic 56: Advanced Document Features
 */

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { FC, useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Editor } from '@tiptap/core'
import { List, RefreshCw } from 'lucide-react'

export interface TableOfContentsOptions {
  HTMLAttributes: Record<string, unknown>
}

interface HeadingItem {
  id: string
  level: number
  text: string
  pos: number
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableOfContents: {
      /**
       * Insert a table of contents block
       */
      insertTableOfContents: () => ReturnType
    }
  }
}

interface TableOfContentsViewProps {
  node: {
    attrs: Record<string, unknown>
  }
  editor: Editor
  selected: boolean
}

const TableOfContentsView: FC<TableOfContentsViewProps> = ({ editor, selected }) => {
  const { t } = useTranslation('documents')
  const [headings, setHeadings] = useState<HeadingItem[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)

  const extractHeadings = useCallback(() => {
    const items: HeadingItem[] = []
    const { doc } = editor.state

    doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        const level = node.attrs.level as number
        const text = node.textContent
        // Generate ID from text content
        const id = text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')

        items.push({
          id,
          level,
          text,
          pos,
        })
      }
    })

    return items
  }, [editor])

  const refreshHeadings = useCallback(() => {
    setIsRefreshing(true)
    const items = extractHeadings()
    setHeadings(items)
    setTimeout(() => setIsRefreshing(false), 200)
  }, [extractHeadings])

  // Extract headings on mount and when document changes
  useEffect(() => {
    refreshHeadings()

    // Subscribe to document changes
    const updateHandler = () => {
      refreshHeadings()
    }

    editor.on('update', updateHandler)

    return () => {
      editor.off('update', updateHandler)
    }
  }, [editor, refreshHeadings])

  const scrollToHeading = (pos: number) => {
    // Set cursor to the heading position
    editor.chain().focus().setTextSelection(pos).run()

    // Scroll the heading into view
    const { view } = editor
    const domAtPos = view.domAtPos(pos)
    const element = domAtPos.node as HTMLElement
    element?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  }

  const getIndentClass = (level: number): string => {
    const indents: Record<number, string> = {
      1: 'pl-0',
      2: 'pl-4',
      3: 'pl-8',
      4: 'pl-12',
      5: 'pl-16',
      6: 'pl-20',
    }
    return indents[level] || 'pl-0'
  }

  const getFontSizeClass = (level: number): string => {
    const sizes: Record<number, string> = {
      1: 'text-base font-semibold',
      2: 'text-sm font-medium',
      3: 'text-sm',
      4: 'text-xs',
      5: 'text-xs',
      6: 'text-xs',
    }
    return sizes[level] || 'text-sm'
  }

  return (
    <NodeViewWrapper className={`my-4 ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <div className="bg-muted/30 rounded-lg border">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
          <div className="flex items-center gap-2 text-sm font-medium">
            <List className="h-4 w-4" />
            {t('tableOfContents')}
          </div>
          <button
            onClick={refreshHeadings}
            className="p-1 rounded hover:bg-muted transition-colors"
            title={t('refreshToc')}
            type="button"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="p-4">
          {headings.length === 0 ? (
            <div className="text-sm text-muted-foreground italic text-center py-2">
              {t('noHeadingsFound')}
            </div>
          ) : (
            <nav className="space-y-1">
              {headings.map((heading, index) => (
                <button
                  key={`${heading.id}-${index}`}
                  onClick={() => scrollToHeading(heading.pos)}
                  className={`
                    block w-full text-left py-1 px-2 rounded
                    hover:bg-muted transition-colors
                    text-foreground hover:text-primary
                    ${getIndentClass(heading.level)}
                    ${getFontSizeClass(heading.level)}
                  `}
                  type="button"
                >
                  {heading.text || '(Untitled)'}
                </button>
              ))}
            </nav>
          )}
        </div>
      </div>
      <NodeViewContent className="hidden" />
    </NodeViewWrapper>
  )
}

export const TableOfContents = Node.create<TableOfContentsOptions>({
  name: 'tableOfContents',

  group: 'block',

  atom: true,

  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-table-of-contents]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-table-of-contents': '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(TableOfContentsView as any)
  },

  addCommands() {
    return {
      insertTableOfContents:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
          })
        },
    }
  },
})
