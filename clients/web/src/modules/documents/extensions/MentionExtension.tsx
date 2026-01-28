/**
 * Mention Extension for Comments
 * Epic 56: Advanced Document Features
 *
 * Allows @username mentions in comments with autocomplete suggestions
 */

import { ReactRenderer } from '@tiptap/react'
import Mention from '@tiptap/extension-mention'
import tippy, { Instance as TippyInstance } from 'tippy.js'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
  FC,
} from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { User } from 'lucide-react'

/**
 * User item interface for mention suggestions
 */
export interface MentionUser {
  id: string
  pubkey: string
  displayName: string
  username?: string
  avatar?: string
}

/**
 * Props for the mention list component
 */
interface MentionListProps {
  items: MentionUser[]
  command: (item: { id: string; label: string }) => void
}

/**
 * Ref interface for the mention list
 */
interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

/**
 * Mention suggestion list component
 * Displays autocomplete suggestions for @mentions
 */
const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command }, ref) => {
    const { t } = useTranslation('documents')
    const [selectedIndex, setSelectedIndex] = useState(0)

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index]
        if (item) {
          command({
            id: item.pubkey,
            label: item.displayName,
          })
        }
      },
      [items, command]
    )

    const upHandler = useCallback(() => {
      setSelectedIndex((prev) => (prev + items.length - 1) % items.length)
    }, [items.length])

    const downHandler = useCallback(() => {
      setSelectedIndex((prev) => (prev + 1) % items.length)
    }, [items.length])

    const enterHandler = useCallback(() => {
      selectItem(selectedIndex)
    }, [selectItem, selectedIndex])

    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          upHandler()
          return true
        }

        if (event.key === 'ArrowDown') {
          downHandler()
          return true
        }

        if (event.key === 'Enter') {
          enterHandler()
          return true
        }

        return false
      },
    }))

    if (items.length === 0) {
      return (
        <div className="bg-popover text-popover-foreground border rounded-md shadow-md p-2 text-sm text-muted-foreground">
          {t('noUsersFound')}
        </div>
      )
    }

    return (
      <div className="bg-popover text-popover-foreground border rounded-md shadow-md overflow-hidden">
        {items.map((item, index) => (
          <button
            key={item.pubkey}
            type="button"
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
              index === selectedIndex
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-muted'
            )}
            onClick={() => selectItem(index)}
          >
            {item.avatar ? (
              <img
                src={item.avatar}
                alt=""
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                <User className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-medium truncate">{item.displayName}</span>
              {item.username && (
                <span className="text-xs text-muted-foreground truncate">
                  @{item.username}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    )
  }
)

MentionList.displayName = 'MentionList'

/**
 * Configuration for the Mention extension
 */
export interface MentionExtensionOptions {
  /**
   * Function to fetch users for autocomplete
   * Called with the search query when user types @
   */
  getUsers: (query: string) => Promise<MentionUser[]> | MentionUser[]
  /**
   * Callback when a user is mentioned
   */
  onMention?: (user: MentionUser) => void
}

/**
 * Create a configured Mention extension
 * Uses TipTap's Mention extension with custom suggestion handling
 */
export function createMentionExtension(options: MentionExtensionOptions) {
  const { getUsers, onMention } = options

  return Mention.configure({
    HTMLAttributes: {
      class: 'mention',
    },
    suggestion: {
      char: '@',
      allowSpaces: false,
      startOfLine: false,

      items: async ({ query }) => {
        const users = await getUsers(query)
        return users.slice(0, 8) // Limit to 8 suggestions
      },

      render: () => {
        let component: ReactRenderer<MentionListRef> | null = null
        let popup: TippyInstance[] | null = null

        return {
          onStart: (props) => {
            component = new ReactRenderer(MentionList, {
              props,
              editor: props.editor,
            })

            if (!props.clientRect) {
              return
            }

            popup = tippy('body', {
              getReferenceClientRect: props.clientRect as () => DOMRect,
              appendTo: () => document.body,
              content: component.element,
              showOnCreate: true,
              interactive: true,
              trigger: 'manual',
              placement: 'bottom-start',
            })
          },

          onUpdate: (props) => {
            component?.updateProps(props)

            if (!props.clientRect) {
              return
            }

            popup?.[0]?.setProps({
              getReferenceClientRect: props.clientRect as () => DOMRect,
            })
          },

          onKeyDown: (props) => {
            if (props.event.key === 'Escape') {
              popup?.[0]?.hide()
              return true
            }

            return component?.ref?.onKeyDown(props) ?? false
          },

          onExit: () => {
            popup?.[0]?.destroy()
            component?.destroy()
          },
        }
      },

      command: ({ editor, range, props }) => {
        // Insert the mention
        editor
          .chain()
          .focus()
          .insertContentAt(range, [
            {
              type: 'mention',
              attrs: props,
            },
            {
              type: 'text',
              text: ' ',
            },
          ])
          .run()

        // Notify callback
        if (onMention && props.id && props.label) {
          const user: MentionUser = {
            id: props.id as string,
            pubkey: props.id as string,
            displayName: props.label as string,
          }
          onMention(user)
        }
      },
    },
  })
}

/**
 * Helper component to render a mention in read-only views
 */
export const MentionRenderer: FC<{
  pubkey: string
  displayName: string
  onClick?: (pubkey: string) => void
}> = ({ pubkey, displayName, onClick }) => {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded bg-blue-100 dark:bg-blue-900/30',
        'px-1.5 py-0.5 text-sm font-medium text-blue-700 dark:text-blue-300',
        onClick && 'cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800/40'
      )}
      onClick={() => onClick?.(pubkey)}
      title={`User: ${pubkey.slice(0, 8)}...`}
    >
      @{displayName}
    </span>
  )
}

/**
 * CSS styles for mentions in the editor
 * Add this to your global CSS or inject via style tag
 */
export const mentionStyles = `
  .mention {
    background-color: hsl(var(--accent));
    color: hsl(var(--accent-foreground));
    border-radius: 0.25rem;
    padding: 0.125rem 0.375rem;
    font-weight: 500;
    text-decoration: none;
  }

  .mention:hover {
    background-color: hsl(var(--accent) / 0.8);
  }

  .dark .mention {
    background-color: hsl(217.2, 32.6%, 22%);
    color: hsl(210, 40%, 80%);
  }

  .dark .mention:hover {
    background-color: hsl(217.2, 32.6%, 28%);
  }
`

export { MentionList, type MentionListProps, type MentionListRef }
