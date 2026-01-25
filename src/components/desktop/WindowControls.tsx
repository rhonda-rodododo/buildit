/**
 * Desktop Window Controls
 * Native window controls for Tauri desktop app (minimize, maximize, close)
 * Only rendered in Tauri environment
 */

import { FC } from 'react';
import { Minus, Square, X, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTauri } from '@/lib/tauri';
import { useTauriWindow } from '@/lib/tauri';
import { cn } from '@/lib/utils';

interface WindowControlsProps {
  className?: string;
}

/**
 * Window controls for Tauri desktop app
 * Shows minimize, maximize/restore, and close buttons
 */
export const WindowControls: FC<WindowControlsProps> = ({ className }) => {
  const { isTauri, os } = useTauri();
  const { minimize, maximize, close, windowState } = useTauriWindow();

  // Only render in Tauri environment
  if (!isTauri) return null;

  // On macOS, native controls are on the left side of the window
  // We typically don't need custom controls on macOS as it uses native decorations
  // However, if using a frameless window, we'd show them
  const isMac = os === 'macos';

  return (
    <div
      className={cn(
        'flex items-center gap-0.5',
        // On macOS, controls are on the left; on Windows/Linux, on the right
        isMac ? 'order-first' : 'order-last',
        className
      )}
      // Allow dragging the window from this area (except buttons)
      data-tauri-drag-region
    >
      {/* Minimize button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-8 w-8 rounded-none hover:bg-muted/80',
          isMac && 'h-3 w-3 rounded-full bg-yellow-500 hover:bg-yellow-600'
        )}
        onClick={minimize}
        aria-label="Minimize window"
      >
        {isMac ? null : <Minus className="h-4 w-4" />}
      </Button>

      {/* Maximize/Restore button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-8 w-8 rounded-none hover:bg-muted/80',
          isMac && 'h-3 w-3 rounded-full bg-green-500 hover:bg-green-600'
        )}
        onClick={maximize}
        aria-label={windowState?.isMaximized ? 'Restore window' : 'Maximize window'}
      >
        {isMac ? null : windowState?.isMaximized ? (
          <Square className="h-3 w-3" />
        ) : (
          <Maximize2 className="h-4 w-4" />
        )}
      </Button>

      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-8 w-8 rounded-none hover:bg-destructive hover:text-destructive-foreground',
          isMac && 'h-3 w-3 rounded-full bg-red-500 hover:bg-red-600'
        )}
        onClick={close}
        aria-label="Close window"
      >
        {isMac ? null : <X className="h-4 w-4" />}
      </Button>
    </div>
  );
};

export default WindowControls;
