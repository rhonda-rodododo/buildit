/**
 * Bulk Actions Toolbar Component
 * Provides multi-select and bulk action capabilities for CRM contacts
 */

import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Mail,
  Tag,
  UserPlus,
  Download,
  Trash2,
  CheckSquare,
  Square,
  Filter,
  X
} from 'lucide-react';

interface BulkActionsToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkMessage: () => void;
  onBulkAddTag: () => void;
  onBulkUpdateField: () => void;
  onBulkAssignTask: () => void;
  onBulkExport: () => void;
  onBulkDelete: () => void;
  className?: string;
}

export const BulkActionsToolbar: FC<BulkActionsToolbarProps> = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onBulkMessage,
  onBulkAddTag,
  onBulkUpdateField,
  onBulkAssignTask,
  onBulkExport,
  onBulkDelete,
  className
}) => {
  const { t } = useTranslation();
  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className={`flex items-center gap-4 p-4 bg-muted/50 rounded-lg border ${className}`}>
      {/* Selection controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="gap-2"
        >
          {allSelected ? (
            <>
              <CheckSquare className="w-4 h-4" />
              {t('bulkActionsToolbar.selection.deselectAll')}
            </>
          ) : (
            <>
              <Square className="w-4 h-4" />
              {t('bulkActionsToolbar.selection.selectAll')}
            </>
          )}
        </Button>

        {selectedCount > 0 && (
          <>
            <div className="h-6 w-px bg-border" />
            <span className="text-sm font-medium">
              {t('bulkActionsToolbar.selection.selected', { count: selectedCount })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDeselectAll}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>

      {/* Bulk actions */}
      {selectedCount > 0 && (
        <>
          <div className="h-6 w-px bg-border" />

          <div className="flex items-center gap-2 flex-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkMessage}
              className="gap-2"
            >
              <Mail className="w-4 h-4" />
              {t('bulkActionsToolbar.actions.sendMessage')}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="w-4 h-4" />
                  {t('bulkActionsToolbar.actions.moreActions')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>{t('bulkActionsToolbar.actions.bulkActions')}</DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={onBulkAddTag}>
                  <Tag className="w-4 h-4 mr-2" />
                  {t('bulkActionsToolbar.actions.addTag')}
                </DropdownMenuItem>

                <DropdownMenuItem onClick={onBulkUpdateField}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  {t('bulkActionsToolbar.actions.updateField')}
                </DropdownMenuItem>

                <DropdownMenuItem onClick={onBulkAssignTask}>
                  <CheckSquare className="w-4 h-4 mr-2" />
                  {t('bulkActionsToolbar.actions.assignTask')}
                </DropdownMenuItem>

                <DropdownMenuItem onClick={onBulkExport}>
                  <Download className="w-4 h-4 mr-2" />
                  {t('bulkActionsToolbar.actions.exportSelected')}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={onBulkDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('bulkActionsToolbar.actions.deleteSelected')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      )}
    </div>
  );
};
