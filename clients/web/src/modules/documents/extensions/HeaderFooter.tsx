/**
 * Header/Footer Extension
 * Epic 56: Advanced Document Features
 *
 * Allows users to define document headers and footers for print/export
 * Headers and footers appear at the top/bottom of each page when printed
 */

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Header/Footer position type
 */
export type HeaderFooterPosition = 'header' | 'footer'

interface HeaderFooterViewProps {
  node: {
    attrs: {
      position: HeaderFooterPosition
      showPageNumber?: boolean
      alignment?: 'left' | 'center' | 'right'
    }
  }
  updateAttributes: (attrs: Record<string, unknown>) => void
}

/**
 * Header/Footer node view component
 */
const HeaderFooterView: FC<HeaderFooterViewProps> = ({ node, updateAttributes }) => {
  const { t } = useTranslation()
  const { position, showPageNumber = false, alignment = 'center' } = node.attrs

  const isHeader = position === 'header'
  const Icon = isHeader ? ChevronUp : ChevronDown
  const label = isHeader ? t('headerFooter.documentHeader') : t('headerFooter.documentFooter')

  const alignmentClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }

  return (
    <NodeViewWrapper
      className={cn(
        'header-footer-wrapper my-4',
        isHeader ? 'header-section' : 'footer-section'
      )}
    >
      <div
        className={cn(
          'relative border rounded-lg p-3',
          isHeader ? 'border-t-4 border-t-blue-400' : 'border-b-4 border-b-blue-400',
          'bg-muted/20'
        )}
        data-header-footer={position}
      >
        {/* Label */}
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
          <div className="flex-1" />

          {/* Controls */}
          <div className="flex items-center gap-1">
            {/* Alignment buttons */}
            <button
              type="button"
              onClick={() => updateAttributes({ alignment: 'left' })}
              className={cn(
                'p-1 rounded hover:bg-muted',
                alignment === 'left' && 'bg-muted'
              )}
              title={t('headerFooter.alignLeft')}
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="15" y2="12" />
                <line x1="3" y1="18" x2="18" y2="18" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => updateAttributes({ alignment: 'center' })}
              className={cn(
                'p-1 rounded hover:bg-muted',
                alignment === 'center' && 'bg-muted'
              )}
              title={t('headerFooter.alignCenter')}
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="6" y1="12" x2="18" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => updateAttributes({ alignment: 'right' })}
              className={cn(
                'p-1 rounded hover:bg-muted',
                alignment === 'right' && 'bg-muted'
              )}
              title={t('headerFooter.alignRight')}
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="9" y1="12" x2="21" y2="12" />
                <line x1="6" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <div className="w-px h-4 bg-muted mx-1" />

            {/* Page number toggle */}
            <button
              type="button"
              onClick={() => updateAttributes({ showPageNumber: !showPageNumber })}
              className={cn(
                'p-1 rounded hover:bg-muted flex items-center gap-1 text-xs',
                showPageNumber && 'bg-muted'
              )}
              title={t('headerFooter.showPageNumber')}
            >
              <FileText className="h-3 w-3" />
              <span className="sr-only">{t('documents:pageNumber')}</span>
            </button>
          </div>
        </div>

        {/* Editable content area */}
        <div className={cn('min-h-[40px]', alignmentClasses[alignment])}>
          <NodeViewContent className="outline-none" />
        </div>

        {/* Page number preview if enabled */}
        {showPageNumber && (
          <div
            className={cn(
              'text-xs text-muted-foreground mt-2 pt-2 border-t border-muted',
              alignmentClasses[alignment]
            )}
          >
            {t('headerFooter.pageNumberNote', { page: 1 })}
          </div>
        )}
      </div>

      {/* Print styling */}
      <style>{`
        @media print {
          .header-section {
            position: running(header);
          }
          .footer-section {
            position: running(footer);
          }
          @page {
            @top-center {
              content: element(header);
            }
            @bottom-center {
              content: element(footer);
            }
          }
        }
      `}</style>
    </NodeViewWrapper>
  )
}

export interface HeaderFooterOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    headerFooter: {
      /**
       * Insert a document header
       */
      insertHeader: () => ReturnType
      /**
       * Insert a document footer
       */
      insertFooter: () => ReturnType
    }
  }
}

/**
 * TipTap Header/Footer Extension
 * Creates a node for document headers and footers that appear on each page
 * when printing or exporting to PDF
 */
export const HeaderFooter = Node.create<HeaderFooterOptions>({
  name: 'headerFooter',

  group: 'block',

  content: 'inline*',

  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      position: {
        default: 'header',
        parseHTML: (element) => element.getAttribute('data-position') || 'header',
        renderHTML: (attributes) => ({
          'data-position': attributes.position,
        }),
      },
      showPageNumber: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-show-page-number') === 'true',
        renderHTML: (attributes) => ({
          'data-show-page-number': attributes.showPageNumber ? 'true' : 'false',
        }),
      },
      alignment: {
        default: 'center',
        parseHTML: (element) => element.getAttribute('data-alignment') || 'center',
        renderHTML: (attributes) => ({
          'data-alignment': attributes.alignment,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-header-footer]',
      },
      {
        tag: 'header.document-header',
        getAttrs: () => ({ position: 'header' }),
      },
      {
        tag: 'footer.document-footer',
        getAttrs: () => ({ position: 'footer' }),
      },
    ]
  },

  renderHTML({ HTMLAttributes, node }) {
    const tag = node.attrs.position === 'header' ? 'header' : 'footer'
    return [
      tag,
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        {
          'data-header-footer': node.attrs.position,
          'class': `document-${node.attrs.position}`,
        }
      ),
      0,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(HeaderFooterView as any)
  },

  addCommands() {
    return {
      insertHeader:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { position: 'header' },
            content: [{ type: 'text', text: 'Document Title' }],
          })
        },
      insertFooter:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { position: 'footer', showPageNumber: true },
            content: [{ type: 'text', text: '' }],
          })
        },
    }
  },
})

export type { HeaderFooterOptions as HeaderFooterExtensionOptions }
