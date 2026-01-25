/**
 * Hotlines List Component
 * Displays list of hotlines for selection
 */

import { Phone, PhoneOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Hotline, HotlineType } from '../types';

interface HotlinesListProps {
  hotlines: Hotline[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  isLoading?: boolean;
}

const typeLabels: Record<HotlineType, string> = {
  'jail-support': 'Jail Support',
  'legal-intake': 'Legal Intake',
  dispatch: 'Dispatch',
  crisis: 'Crisis',
  general: 'General',
};

const typeColors: Record<HotlineType, string> = {
  'jail-support': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  'legal-intake': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  dispatch: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  crisis: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  general: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

export function HotlinesList({
  hotlines,
  selectedId,
  onSelect,
  isLoading,
}: HotlinesListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (hotlines.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No hotlines created yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {hotlines.map((hotline) => (
        <button
          key={hotline.id}
          onClick={() => onSelect(hotline.id === selectedId ? null : hotline.id)}
          className={cn(
            'w-full text-left p-3 rounded-lg border transition-colors',
            selectedId === hotline.id
              ? 'border-primary bg-primary/5'
              : 'border-transparent hover:bg-muted'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {hotline.isActive ? (
                <Phone className="h-4 w-4 text-green-600" />
              ) : (
                <PhoneOff className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="font-medium">{hotline.name}</span>
            </div>
            <Badge variant="secondary" className={typeColors[hotline.type]}>
              {typeLabels[hotline.type]}
            </Badge>
          </div>
          {hotline.phone && (
            <p className="text-sm text-muted-foreground mt-1 ml-6">
              {hotline.phone}
            </p>
          )}
        </button>
      ))}
    </div>
  );
}

export default HotlinesList;
