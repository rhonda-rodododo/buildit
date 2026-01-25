/**
 * Suggestion Mode Plugin for TipTap
 * Intercepts text edits and converts them to suggestions when enabled
 *
 * Epic 56: Advanced Document Features
 */

import { Plugin, PluginKey, Transaction, EditorState } from 'prosemirror-state'
import { Extension } from '@tiptap/core'
import { secureRandomInt } from '@/lib/utils'

export interface SuggestionModeOptions {
  enabled: boolean
  onSuggestionCreated?: (suggestion: {
    id: string
    type: 'insertion' | 'deletion'
    from: number
    to: number
    originalText: string
    suggestedText: string
  }) => void
}

export interface SuggestionModeStorage {
  enabled: boolean
}

export const suggestionModePluginKey = new PluginKey('suggestionMode')

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    suggestionMode: {
      /**
       * Enable suggestion mode
       */
      enableSuggestionMode: () => ReturnType
      /**
       * Disable suggestion mode
       */
      disableSuggestionMode: () => ReturnType
      /**
       * Toggle suggestion mode
       */
      toggleSuggestionMode: () => ReturnType
    }
  }
}

export const SuggestionModeExtension = Extension.create<SuggestionModeOptions, SuggestionModeStorage>({
  name: 'suggestionMode',

  addOptions() {
    return {
      enabled: false,
      onSuggestionCreated: undefined,
    }
  },

  addStorage() {
    return {
      enabled: this.options.enabled,
    }
  },

  addCommands() {
    return {
      enableSuggestionMode:
        () =>
        ({ editor }) => {
          const storage = (editor.storage as unknown as Record<string, SuggestionModeStorage>)['suggestionMode']
          storage.enabled = true
          return true
        },
      disableSuggestionMode:
        () =>
        ({ editor }) => {
          const storage = (editor.storage as unknown as Record<string, SuggestionModeStorage>)['suggestionMode']
          storage.enabled = false
          return true
        },
      toggleSuggestionMode:
        () =>
        ({ editor }) => {
          const storage = (editor.storage as unknown as Record<string, SuggestionModeStorage>)['suggestionMode']
          storage.enabled = !storage.enabled
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    const extension = this

    return [
      new Plugin({
        key: suggestionModePluginKey,

        appendTransaction(transactions: readonly Transaction[], oldState: EditorState, newState: EditorState) {
          // Check if suggestion mode is enabled via editor storage
          const editor = extension.editor
          const storage = (editor?.storage as unknown as Record<string, SuggestionModeStorage> | undefined)?.['suggestionMode']
          if (!storage?.enabled) {
            return null
          }

          // Find transactions that contain document changes
          const docChanged = transactions.some((tr) => tr.docChanged)
          if (!docChanged) {
            return null
          }

          // Get the primary transaction with changes
          const primaryTr = transactions.find((tr) => tr.docChanged)
          if (!primaryTr) {
            return null
          }

          // Analyze the changes
          const changes: Array<{
            from: number
            to: number
            oldText: string
            newText: string
          }> = []

          primaryTr.steps.forEach((step: { getMap: () => { forEach: (callback: (oldStart: number, oldEnd: number, newStart: number, newEnd: number) => void) => void } }) => {
            const stepMap = step.getMap()
            stepMap.forEach((oldStart: number, oldEnd: number, newStart: number, newEnd: number) => {
              const oldText = oldState.doc.textBetween(oldStart, oldEnd, ' ')
              const newText = newState.doc.textBetween(newStart, newEnd, ' ')

              if (oldText !== newText) {
                changes.push({
                  from: newStart,
                  to: newEnd,
                  oldText,
                  newText,
                })
              }
            })
          })

          if (changes.length === 0) {
            return null
          }

          // Create a new transaction to mark changes as suggestions
          const tr = newState.tr

          changes.forEach((change) => {
            const suggestionId = `suggestion-${Date.now()}-${secureRandomInt(10000)}`

            if (change.oldText && !change.newText) {
              // Deletion: Mark the deleted text (need to use old position)
              // For deletions in suggestion mode, we need to:
              // 1. Undo the deletion
              // 2. Mark the text as a deletion suggestion
              // This is complex - for now, we'll handle insertions primarily

              extension.options.onSuggestionCreated?.({
                id: suggestionId,
                type: 'deletion',
                from: change.from,
                to: change.to,
                originalText: change.oldText,
                suggestedText: '',
              })
            } else if (!change.oldText && change.newText) {
              // Pure insertion: Mark the inserted text
              if (change.from < change.to) {
                const mark = newState.schema.marks.suggestion?.create({
                  suggestionId,
                  type: 'insertion',
                })

                if (mark) {
                  tr.addMark(change.from, change.to, mark)
                }

                extension.options.onSuggestionCreated?.({
                  id: suggestionId,
                  type: 'insertion',
                  from: change.from,
                  to: change.to,
                  originalText: '',
                  suggestedText: change.newText,
                })
              }
            } else if (change.oldText && change.newText) {
              // Replacement: Mark as insertion (the new text replaces old)
              const mark = newState.schema.marks.suggestion?.create({
                suggestionId,
                type: 'insertion',
              })

              if (mark && change.from < change.to) {
                tr.addMark(change.from, change.to, mark)
              }

              extension.options.onSuggestionCreated?.({
                id: suggestionId,
                type: 'insertion',
                from: change.from,
                to: change.to,
                originalText: change.oldText,
                suggestedText: change.newText,
              })
            }
          })

          return tr.steps.length > 0 ? tr : null
        },
      }),
    ]
  },
})
