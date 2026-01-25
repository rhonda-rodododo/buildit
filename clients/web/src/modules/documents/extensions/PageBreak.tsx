/**
 * Page Break Extension
 * Epic 56: Advanced Document Features
 *
 * Allows users to insert page breaks in documents for print/PDF export
 */

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { FC } from 'react'
import { Minus } from 'lucide-react'

/**
 * Page break node view component
 * Renders a visual divider indicating a page break
 */
const PageBreakView: FC = () => {
  return (
    <NodeViewWrapper className="page-break-wrapper my-6">
      <div
        className="relative flex items-center justify-center py-2"
        contentEditable={false}
        data-page-break="true"
      >
        {/* Visual line */}
        <div className="absolute left-0 right-0 border-t-2 border-dashed border-muted-foreground/30" />

        {/* Label badge */}
        <span className="relative z-10 bg-background px-3 py-1 text-xs text-muted-foreground border border-muted-foreground/30 rounded-full flex items-center gap-1.5">
          <Minus className="h-3 w-3" />
          Page Break
        </span>
      </div>

      {/* Print styling hint */}
      <style>{`
        @media print {
          [data-page-break="true"] {
            page-break-after: always;
            break-after: page;
          }
        }
      `}</style>
    </NodeViewWrapper>
  )
}

export interface PageBreakOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      /**
       * Insert a page break
       */
      insertPageBreak: () => ReturnType
    }
  }
}

/**
 * TipTap Page Break Extension
 * Creates a node that renders as a page break divider and triggers
 * page breaks when printing or exporting to PDF
 */
export const PageBreak = Node.create<PageBreakOptions>({
  name: 'pageBreak',

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
        tag: 'div[data-page-break]',
      },
      {
        tag: 'div.page-break',
      },
      // Also parse HR with page-break class
      {
        tag: 'hr.page-break',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        {
          'data-page-break': 'true',
          'class': 'page-break',
          'style': 'page-break-after: always; break-after: page;',
        }
      ),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageBreakView)
  },

  addCommands() {
    return {
      insertPageBreak:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
          })
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      // Ctrl+Shift+Enter to insert page break
      'Mod-Shift-Enter': () => this.editor.commands.insertPageBreak(),
    }
  },
})

export type { PageBreakOptions as PageBreakExtensionOptions }
