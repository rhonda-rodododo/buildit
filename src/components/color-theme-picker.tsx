import { useTheme } from '@/components/theme-provider';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const COLOR_THEMES = [
  { name: 'default', label: 'Default', colors: ['#000000', '#e5e5e5', '#ffffff'] },
  { name: 'blue', label: 'Blue', colors: ['#1e3a8a', '#3b82f6', '#93c5fd'] },
  { name: 'green', label: 'Green', colors: ['#065f46', '#10b981', '#6ee7b7'] },
  { name: 'yellow', label: 'Yellow', colors: ['#854d0e', '#eab308', '#fde047'] },
  { name: 'rose', label: 'Rose', colors: ['#881337', '#f43f5e', '#fda4af'] },
  { name: 'violet', label: 'Violet', colors: ['#5b21b6', '#8b5cf6', '#c4b5fd'] },
  { name: 'red', label: 'Red', colors: ['#991b1b', '#ef4444', '#fca5a5'] },
] as const;

export function ColorThemePicker() {
  const { colorTheme, setColorTheme } = useTheme();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {COLOR_THEMES.map((theme) => (
        <button
          key={theme.name}
          onClick={() => setColorTheme(theme.name)}
          className={cn(
            'relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105',
            colorTheme === theme.name
              ? 'border-primary shadow-md'
              : 'border-border hover:border-muted-foreground'
          )}
          aria-label={`Select ${theme.label} theme`}
        >
          {colorTheme === theme.name && (
            <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
              <Check className="h-3 w-3 text-primary-foreground" />
            </div>
          )}
          <div className="flex gap-1 w-full">
            {theme.colors.map((color, idx) => (
              <div
                key={idx}
                className="flex-1 h-8 rounded"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <span className="text-xs font-medium">{theme.label}</span>
        </button>
      ))}
    </div>
  );
}
