/**
 * Custom TipTap Math Block Extension
 * Renders mathematical equations using KaTeX
 */

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import katex from 'katex'
import { FC, useState, useEffect, useCallback } from 'react'

export interface MathBlockOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mathBlock: {
      /**
       * Insert a math block
       */
      insertMathBlock: (equation?: string) => ReturnType
    }
  }
}

interface MathBlockViewProps {
  node: {
    attrs: {
      equation: string
    }
  }
  updateAttributes: (attrs: { equation: string }) => void
  selected: boolean
}

const MathBlockView: FC<MathBlockViewProps> = ({ node, updateAttributes, selected }) => {
  const [isEditing, setIsEditing] = useState(!node.attrs.equation)
  const [localEquation, setLocalEquation] = useState(node.attrs.equation || '')
  const [renderedHtml, setRenderedHtml] = useState('')
  const [error, setError] = useState<string | null>(null)

  const renderMath = useCallback((eq: string) => {
    try {
      const html = katex.renderToString(eq, {
        throwOnError: false,
        displayMode: true,
        output: 'htmlAndMathml',
      })
      setRenderedHtml(html)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
      setRenderedHtml('')
    }
  }, [])

  useEffect(() => {
    if (node.attrs.equation) {
      renderMath(node.attrs.equation)
    }
  }, [node.attrs.equation, renderMath])

  const handleSave = () => {
    updateAttributes({ equation: localEquation })
    setIsEditing(false)
    renderMath(localEquation)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      setLocalEquation(node.attrs.equation)
      setIsEditing(false)
    }
  }

  return (
    <NodeViewWrapper className={`my-4 ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <div className="bg-muted/30 rounded-lg p-4 border">
        {isEditing ? (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground mb-2">
              Enter LaTeX equation (Shift+Enter to save, Escape to cancel)
            </div>
            <textarea
              value={localEquation}
              onChange={(e) => {
                setLocalEquation(e.target.value)
                renderMath(e.target.value)
              }}
              onKeyDown={handleKeyDown}
              className="w-full p-2 font-mono text-sm border rounded bg-background min-h-[60px]"
              placeholder="E = mc^2"
              autoFocus
            />
            {error && (
              <div className="text-sm text-red-500">{error}</div>
            )}
            {renderedHtml && (
              <div className="p-2 bg-background rounded border">
                <div
                  className="text-center"
                  dangerouslySetInnerHTML={{ __html: renderedHtml }}
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setLocalEquation(node.attrs.equation)
                  setIsEditing(false)
                }}
                className="px-3 py-1 text-sm rounded border hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setIsEditing(true)}
            className="cursor-pointer hover:bg-muted/50 rounded p-2 transition-colors"
          >
            {renderedHtml ? (
              <div
                className="text-center"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            ) : (
              <div className="text-center text-muted-foreground italic">
                Click to add equation
              </div>
            )}
          </div>
        )}
      </div>
      <NodeViewContent className="hidden" />
    </NodeViewWrapper>
  )
}

export const MathBlock = Node.create<MathBlockOptions>({
  name: 'mathBlock',

  group: 'block',

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      equation: {
        default: '',
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-math-block]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-math-block': '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView as any)
  },

  addCommands() {
    return {
      insertMathBlock:
        (equation = '') =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { equation },
          })
        },
    }
  },
})
