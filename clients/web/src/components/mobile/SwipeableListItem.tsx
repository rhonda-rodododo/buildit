/**
 * SwipeableListItem Component
 * Provides swipe-to-reveal actions for list items on mobile
 * Similar to iOS Mail app behavior
 */

import { FC, ReactNode, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useSwipeGesture, useHapticFeedback, useIsTouchDevice } from '@/hooks/useMobile';
import { Trash2, Archive } from 'lucide-react';

export interface SwipeAction {
  id: string;
  icon: typeof Trash2;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'warning';
  /** Width of the action button in pixels */
  width?: number;
}

interface SwipeableListItemProps {
  children: ReactNode;
  /** Actions revealed when swiping left */
  leftActions?: SwipeAction[];
  /** Actions revealed when swiping right */
  rightActions?: SwipeAction[];
  /** Callback when item is swiped to delete threshold */
  onDelete?: () => void;
  /** Callback when item is swiped to archive threshold */
  onArchive?: () => void;
  /** Disable swipe gestures */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

const ACTION_WIDTH = 72;

const getActionBgColor = (variant?: SwipeAction['variant']) => {
  switch (variant) {
    case 'destructive':
      return 'bg-destructive';
    case 'warning':
      return 'bg-yellow-500';
    default:
      return 'bg-primary';
  }
};

const getActionTextColor = (variant?: SwipeAction['variant']) => {
  switch (variant) {
    case 'destructive':
      return 'text-destructive-foreground';
    case 'warning':
      return 'text-black';
    default:
      return 'text-primary-foreground';
  }
};

export const SwipeableListItem: FC<SwipeableListItemProps> = ({
  children,
  leftActions = [],
  rightActions = [],
  onDelete,
  onArchive,
  disabled = false,
  className,
}) => {
  const isTouch = useIsTouchDevice();
  const { mediumTap, heavyTap } = useHapticFeedback();
  const [isOpen, setIsOpen] = useState<'left' | 'right' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Default actions if not provided
  const defaultRightActions: SwipeAction[] = [];
  if (onArchive) {
    defaultRightActions.push({
      id: 'archive',
      icon: Archive,
      label: 'Archive',
      onClick: onArchive,
      variant: 'default',
    });
  }
  if (onDelete) {
    defaultRightActions.push({
      id: 'delete',
      icon: Trash2,
      label: 'Delete',
      onClick: onDelete,
      variant: 'destructive',
    });
  }

  const finalRightActions = rightActions.length > 0 ? rightActions : defaultRightActions;
  const hasSwipeActions = leftActions.length > 0 || finalRightActions.length > 0;

  const handleSwipeLeft = useCallback(() => {
    if (finalRightActions.length > 0) {
      mediumTap();
      setIsOpen('right');
    }
  }, [finalRightActions.length, mediumTap]);

  const handleSwipeRight = useCallback(() => {
    if (leftActions.length > 0) {
      mediumTap();
      setIsOpen('left');
    } else if (isOpen) {
      setIsOpen(null);
    }
  }, [leftActions.length, mediumTap, isOpen]);

  const { handlers, swipeOffset, isSwiping } = useSwipeGesture(
    handleSwipeLeft,
    handleSwipeRight,
    { enabled: !disabled && isTouch && hasSwipeActions }
  );

  const handleActionClick = (action: SwipeAction) => {
    heavyTap();
    action.onClick();
    setIsOpen(null);
  };

  const handleClose = () => {
    setIsOpen(null);
  };

  // Calculate transform based on swipe and open state
  const getTransform = () => {
    if (isSwiping) {
      // Limit swipe distance
      const maxSwipe = Math.max(leftActions.length, finalRightActions.length) * ACTION_WIDTH;
      const clampedOffset = Math.max(-maxSwipe, Math.min(maxSwipe, swipeOffset));
      return `translateX(${clampedOffset}px)`;
    }
    if (isOpen === 'right') {
      return `translateX(-${finalRightActions.length * ACTION_WIDTH}px)`;
    }
    if (isOpen === 'left') {
      return `translateX(${leftActions.length * ACTION_WIDTH}px)`;
    }
    return 'translateX(0)';
  };

  // Don't add swipe handlers on non-touch devices
  const touchHandlers = isTouch && hasSwipeActions ? handlers : {};

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden', className)}
    >
      {/* Left actions (revealed on right swipe) */}
      {leftActions.length > 0 && (
        <div className="absolute left-0 top-0 bottom-0 flex">
          {leftActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => handleActionClick(action)}
                className={cn(
                  'flex flex-col items-center justify-center px-4 min-w-[72px]',
                  getActionBgColor(action.variant),
                  getActionTextColor(action.variant)
                )}
                aria-label={action.label}
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="text-xs font-medium">{action.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Right actions (revealed on left swipe) */}
      {finalRightActions.length > 0 && (
        <div className="absolute right-0 top-0 bottom-0 flex">
          {finalRightActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => handleActionClick(action)}
                className={cn(
                  'flex flex-col items-center justify-center px-4 min-w-[72px]',
                  getActionBgColor(action.variant),
                  getActionTextColor(action.variant)
                )}
                aria-label={action.label}
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="text-xs font-medium">{action.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main content */}
      <div
        {...touchHandlers}
        className={cn(
          'relative bg-background transition-transform',
          isSwiping ? 'transition-none' : 'duration-200'
        )}
        style={{ transform: getTransform() }}
        onClick={isOpen ? handleClose : undefined}
      >
        {children}
      </div>
    </div>
  );
};

/**
 * Example usage:
 *
 * <SwipeableListItem
 *   onDelete={() => handleDelete(item.id)}
 *   onArchive={() => handleArchive(item.id)}
 * >
 *   <div className="p-4 border-b">
 *     <h3>{item.title}</h3>
 *     <p>{item.description}</p>
 *   </div>
 * </SwipeableListItem>
 */
