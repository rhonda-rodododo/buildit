/**
 * Command Palette Component
 * Uses cmdk for the command menu and shadcn Dialog for the modal
 */

import { useContext, useMemo, useCallback } from 'react';
import { Command } from 'cmdk';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useModifierKey } from '@/lib/tauri';
import { CommandPaletteContext } from './CommandPaletteContext';
import { CATEGORY_CONFIG, type CommandAction, type CommandGroup } from './types';

/**
 * Format shortcut for display based on platform
 */
function ShortcutDisplay({ shortcut }: { shortcut: string }) {
  const { formatShortcut } = useModifierKey();
  const formatted = formatShortcut(shortcut);

  return (
    <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
      {formatted}
    </kbd>
  );
}

/**
 * Single command item
 */
function CommandItem({ action, onSelect }: { action: CommandAction; onSelect: () => void }) {
  const Icon = action.icon;

  return (
    <Command.Item
      key={action.id}
      value={`${action.label} ${action.keywords?.join(' ') || ''}`}
      onSelect={onSelect}
      disabled={action.disabled}
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
        'aria-selected:bg-accent aria-selected:text-accent-foreground',
        'data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50'
      )}
    >
      {Icon && <Icon className="mr-2 h-4 w-4" />}
      <span>{action.label}</span>
      {action.description && (
        <span className="ml-2 text-xs text-muted-foreground truncate">
          {action.description}
        </span>
      )}
      {action.shortcut && <ShortcutDisplay shortcut={action.shortcut} />}
    </Command.Item>
  );
}

/**
 * Group actions by category
 */
function groupActionsByCategory(actions: CommandAction[]): CommandGroup[] {
  const groups = new Map<string, CommandAction[]>();

  // Group by category
  for (const action of actions) {
    const category = action.category;
    const existing = groups.get(category) || [];
    groups.set(category, [...existing, action]);
  }

  // Convert to array and sort by category priority
  const result: CommandGroup[] = [];
  for (const [category, categoryActions] of groups) {
    const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG];
    if (!config) continue;

    // Sort actions within category by priority
    const sortedActions = categoryActions.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    result.push({
      category: category as CommandGroup['category'],
      heading: config.heading,
      actions: sortedActions,
    });
  }

  // Sort groups by priority
  result.sort((a, b) => {
    const priorityA = CATEGORY_CONFIG[a.category]?.priority || 0;
    const priorityB = CATEGORY_CONFIG[b.category]?.priority || 0;
    return priorityB - priorityA;
  });

  return result;
}

/**
 * Command Palette Component
 */
export function CommandPalette() {
  const { isOpen, close, query, setQuery } = useContext(CommandPaletteContext);

  // Get actions from context - we need to access the internal state
  // The actions are passed through the provider
  const actionsFromContext = useContext(CommandPaletteContext) as unknown as {
    _actions?: CommandAction[];
  };
  const actions = actionsFromContext._actions || [];

  // Group actions by category
  const groups = useMemo(() => groupActionsByCategory(actions), [actions]);

  // Handle action selection
  const handleSelect = useCallback(
    (action: CommandAction) => {
      close();
      // Execute after close animation
      requestAnimationFrame(() => {
        action.onSelect();
      });
    },
    [close]
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent
        className="overflow-hidden p-0 shadow-lg md:max-w-lg"
        fullScreenMobile={false}
      >
        <Command
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3"
          filter={(value, search) => {
            // Custom filter for better matching
            const valueLower = value.toLowerCase();
            const searchLower = search.toLowerCase();
            const searchTerms = searchLower.split(' ').filter(Boolean);

            // All search terms must match
            for (const term of searchTerms) {
              if (!valueLower.includes(term)) {
                return 0;
              }
            }

            // Prioritize exact matches
            if (valueLower.startsWith(searchLower)) {
              return 2;
            }

            return 1;
          }}
        >
          <div className="flex items-center border-b px-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2 h-4 w-4 shrink-0 opacity-50"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Type a command or search..."
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>
            {groups.map((group) => (
              <Command.Group key={group.category} heading={group.heading}>
                {group.actions.map((action) => (
                  <CommandItem
                    key={action.id}
                    action={action}
                    onSelect={() => handleSelect(action)}
                  />
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

export default CommandPalette;
