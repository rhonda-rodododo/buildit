/**
 * Custom TipTap Mermaid Block Extension
 * Renders diagrams using Mermaid.js
 *
 * Epic 56: Advanced Document Features
 */

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { FC, useState, useEffect, useCallback, useRef } from 'react'
import mermaid from 'mermaid'
import { sanitizeMathHtml } from '@/lib/security/sanitize'
import { secureRandomInt } from '@/lib/utils'

// Initialize mermaid with security settings
mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  theme: 'default',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
})

export interface MermaidBlockOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaidBlock: {
      /**
       * Insert a mermaid diagram block
       */
      insertMermaidBlock: (diagram?: string) => ReturnType
    }
  }
}

interface MermaidBlockViewProps {
  node: {
    attrs: {
      diagram: string
    }
  }
  updateAttributes: (attrs: { diagram: string }) => void
  selected: boolean
}

const EXAMPLE_DIAGRAMS = {
  flowchart: `flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`,
  sequence: `sequenceDiagram
    Alice->>Bob: Hello Bob!
    Bob-->>Alice: Hi Alice!
    Alice->>Bob: How are you?
    Bob-->>Alice: Great, thanks!`,
  gantt: `gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    section Planning
    Research :a1, 2024-01-01, 7d
    Design :a2, after a1, 5d
    section Development
    Implementation :a3, after a2, 14d
    Testing :a4, after a3, 7d`,
  pie: `pie title Vote Distribution
    "Yes" : 60
    "No" : 25
    "Abstain" : 15`,
}

const MermaidBlockView: FC<MermaidBlockViewProps> = ({ node, updateAttributes, selected }) => {
  const [isEditing, setIsEditing] = useState(!node.attrs.diagram)
  const [localDiagram, setLocalDiagram] = useState(node.attrs.diagram || '')
  const [renderedSvg, setRenderedSvg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const diagramIdRef = useRef(`mermaid-${secureRandomInt(1000000)}`)

  const renderDiagram = useCallback(async (diagramCode: string) => {
    if (!diagramCode.trim()) {
      setRenderedSvg('')
      setError(null)
      return
    }

    try {
      // Validate syntax first
      await mermaid.parse(diagramCode)

      // Render the diagram
      const { svg } = await mermaid.render(diagramIdRef.current, diagramCode)
      // Sanitize the SVG output for security
      setRenderedSvg(sanitizeMathHtml(svg))
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Invalid diagram syntax'
      setError(errorMessage)
      setRenderedSvg('')
    }
  }, [])

  useEffect(() => {
    if (node.attrs.diagram) {
      renderDiagram(node.attrs.diagram)
    }
  }, [node.attrs.diagram, renderDiagram])

  const handleSave = () => {
    updateAttributes({ diagram: localDiagram })
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      setLocalDiagram(node.attrs.diagram)
      setIsEditing(false)
    }
  }

  const insertExample = (type: keyof typeof EXAMPLE_DIAGRAMS) => {
    setLocalDiagram(EXAMPLE_DIAGRAMS[type])
    renderDiagram(EXAMPLE_DIAGRAMS[type])
  }

  return (
    <NodeViewWrapper className={`my-4 ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <div className="bg-muted/30 rounded-lg p-4 border">
        {isEditing ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Enter Mermaid diagram (Ctrl/Cmd+Enter to save, Escape to cancel)
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => insertExample('flowchart')}
                  className="px-2 py-1 text-xs rounded border hover:bg-muted"
                  type="button"
                >
                  Flowchart
                </button>
                <button
                  onClick={() => insertExample('sequence')}
                  className="px-2 py-1 text-xs rounded border hover:bg-muted"
                  type="button"
                >
                  Sequence
                </button>
                <button
                  onClick={() => insertExample('gantt')}
                  className="px-2 py-1 text-xs rounded border hover:bg-muted"
                  type="button"
                >
                  Gantt
                </button>
                <button
                  onClick={() => insertExample('pie')}
                  className="px-2 py-1 text-xs rounded border hover:bg-muted"
                  type="button"
                >
                  Pie
                </button>
              </div>
            </div>
            <textarea
              value={localDiagram}
              onChange={(e) => {
                setLocalDiagram(e.target.value)
                // Debounce rendering for performance
                const timeoutId = setTimeout(() => renderDiagram(e.target.value), 300)
                return () => clearTimeout(timeoutId)
              }}
              onKeyDown={handleKeyDown}
              className="w-full p-2 font-mono text-sm border rounded bg-background min-h-[120px]"
              placeholder="flowchart TD&#10;    A[Start] --> B[End]"
              autoFocus
            />
            {error && (
              <div className="text-sm text-red-500 p-2 bg-red-50 rounded border border-red-200">
                {error}
              </div>
            )}
            {renderedSvg && (
              <div className="p-4 bg-background rounded border overflow-auto">
                <div
                  className="flex justify-center"
                  dangerouslySetInnerHTML={{ __html: renderedSvg }}
                />
              </div>
            )}
            <div className="flex justify-between items-center">
              <a
                href="https://mermaid.js.org/syntax/flowchart.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline"
              >
                Mermaid Docs
              </a>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setLocalDiagram(node.attrs.diagram)
                    setIsEditing(false)
                  }}
                  className="px-3 py-1 text-sm rounded border hover:bg-muted"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-3 py-1 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90"
                  type="button"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setIsEditing(true)}
            className="cursor-pointer hover:bg-muted/50 rounded p-2 transition-colors"
          >
            {renderedSvg ? (
              <div
                className="flex justify-center overflow-auto"
                dangerouslySetInnerHTML={{ __html: renderedSvg }}
              />
            ) : (
              <div className="text-center text-muted-foreground italic py-4">
                Click to add diagram
              </div>
            )}
          </div>
        )}
      </div>
      <NodeViewContent className="hidden" />
    </NodeViewWrapper>
  )
}

export const MermaidBlock = Node.create<MermaidBlockOptions>({
  name: 'mermaidBlock',

  group: 'block',

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      diagram: {
        default: '',
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-mermaid-block]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-mermaid-block': '' })]
  },

  addNodeView() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ReactNodeViewRenderer(MermaidBlockView as any)
  },

  addCommands() {
    return {
      insertMermaidBlock:
        (diagram = '') =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { diagram },
          })
        },
    }
  },
})
