/**
 * Custom TipTap Suggestion Mark Extension
 * Track changes / suggestion mode for document editing
 */

import { Mark, mergeAttributes } from '@tiptap/core'

export interface SuggestionMarkOptions {
  HTMLAttributes: Record<string, unknown>
}

export type SuggestionType = 'insertion' | 'deletion'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    suggestion: {
      /**
       * Set a suggestion mark (insertion)
       */
      setSuggestion: (suggestionId: string, type: SuggestionType) => ReturnType
      /**
       * Accept a suggestion
       */
      acceptSuggestion: (suggestionId: string) => ReturnType
      /**
       * Reject a suggestion
       */
      rejectSuggestion: (suggestionId: string) => ReturnType
    }
  }
}

export const SuggestionMark = Mark.create<SuggestionMarkOptions>({
  name: 'suggestion',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      suggestionId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-suggestion-id'),
        renderHTML: (attributes) => {
          if (!attributes.suggestionId) {
            return {}
          }
          return {
            'data-suggestion-id': attributes.suggestionId,
          }
        },
      },
      type: {
        default: 'insertion',
        parseHTML: (element) => element.getAttribute('data-suggestion-type'),
        renderHTML: (attributes) => ({
          'data-suggestion-type': attributes.type,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-suggestion-id]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const type = HTMLAttributes['data-suggestion-type'] as SuggestionType
    const baseClass = type === 'insertion'
      ? 'bg-green-100 text-green-800 border-b-2 border-green-500'
      : 'bg-red-100 text-red-800 line-through border-b-2 border-red-500'

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: `${baseClass} cursor-pointer`,
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setSuggestion:
        (suggestionId: string, type: SuggestionType) =>
        ({ commands }) => {
          return commands.setMark(this.name, { suggestionId, type })
        },
      acceptSuggestion:
        (suggestionId: string) =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return false

          const { doc } = state
          let found = false

          doc.descendants((node, pos) => {
            node.marks.forEach((mark) => {
              if (mark.type.name === this.name && mark.attrs.suggestionId === suggestionId) {
                found = true
                const type = mark.attrs.type as SuggestionType

                if (type === 'deletion') {
                  // For deletions, remove the marked content
                  tr.delete(pos, pos + node.nodeSize)
                } else {
                  // For insertions, just remove the mark to accept
                  tr.removeMark(pos, pos + node.nodeSize, mark.type)
                }
              }
            })
          })

          return found
        },
      rejectSuggestion:
        (suggestionId: string) =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return false

          const { doc } = state
          let found = false

          doc.descendants((node, pos) => {
            node.marks.forEach((mark) => {
              if (mark.type.name === this.name && mark.attrs.suggestionId === suggestionId) {
                found = true
                const type = mark.attrs.type as SuggestionType

                if (type === 'insertion') {
                  // For insertions, remove the inserted content to reject
                  tr.delete(pos, pos + node.nodeSize)
                } else {
                  // For deletions, just remove the mark to keep content
                  tr.removeMark(pos, pos + node.nodeSize, mark.type)
                }
              }
            })
          })

          return found
        },
    }
  },
})
