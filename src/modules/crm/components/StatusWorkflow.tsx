/**
 * Status Workflow Component
 * Visual pipeline stages with drag-drop status changes
 */

import { useState, useMemo, useCallback } from 'react';
import { useDatabaseStore } from '@/modules/database/databaseStore';
import { databaseManager } from '@/modules/database/databaseManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface StatusWorkflowProps {
  recordId: string;
  tableId: string;
  groupId: string;
  userPubkey: string;
  statusFieldName?: string;
  className?: string;
  onStatusChange?: (newStatus: string) => void;
  onNavigateToRecord?: (recordId: string, tableId: string) => void;
}

interface StatusStage {
  value: string;
  label: string;
  color?: string;
  isComplete?: boolean;
  isCurrent?: boolean;
}

// Default status colors
const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500',
  open: 'bg-blue-500',
  pending: 'bg-yellow-500',
  waiting: 'bg-yellow-500',
  in_progress: 'bg-purple-500',
  active: 'bg-purple-500',
  review: 'bg-orange-500',
  approved: 'bg-green-500',
  resolved: 'bg-green-500',
  closed: 'bg-gray-500',
  completed: 'bg-green-500',
  cancelled: 'bg-red-500',
  rejected: 'bg-red-500',
  urgent: 'bg-red-500',
};

export function StatusWorkflow({
  recordId,
  tableId,
  groupId,
  userPubkey,
  statusFieldName = 'status',
  className,
  onStatusChange,
  onNavigateToRecord: _onNavigateToRecord,
}: StatusWorkflowProps) {
  // Reserved for future navigation features
  void _onNavigateToRecord;
  const { t } = useTranslation();
  const [updating, setUpdating] = useState(false);

  const tables = useDatabaseStore((s) => s.tables);
  const recordsByTable = useDatabaseStore((s) => s.recordsByTable);

  // Get current table and record
  const currentTable = useMemo(() => tables.get(tableId), [tables, tableId]);
  const currentRecord = useMemo(() => {
    const tableRecords = recordsByTable.get(tableId);
    return tableRecords?.get(recordId);
  }, [recordsByTable, tableId, recordId]);

  // Get status field configuration
  const statusField = useMemo(() => {
    if (!currentTable) return null;
    return currentTable.fields.find((f) => f.name === statusFieldName);
  }, [currentTable, statusFieldName]);

  // Build status stages from field options
  const statusStages = useMemo((): StatusStage[] => {
    if (!statusField?.widget.options) return [];

    const currentStatus = currentRecord?.customFields[statusFieldName] as string | undefined;
    let foundCurrent = false;

    return statusField.widget.options.map((opt) => {
      const value = typeof opt === 'object' ? String(opt.value) : String(opt);
      const label = typeof opt === 'object' ? opt.label : String(opt);

      const isCurrent = value === currentStatus;
      if (isCurrent) foundCurrent = true;

      return {
        value,
        label,
        color: STATUS_COLORS[value.toLowerCase().replace(/\s+/g, '_')] || 'bg-gray-400',
        isComplete: !foundCurrent && !isCurrent,
        isCurrent,
      };
    });
  }, [statusField, currentRecord, statusFieldName]);

  const currentStatus = currentRecord?.customFields[statusFieldName] as string | undefined;
  const currentStageIndex = statusStages.findIndex((s) => s.isCurrent);

  // Handle status change
  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!currentRecord || updating) return;

    setUpdating(true);
    try {
      await databaseManager.updateRecordWithActivity(
        recordId,
        tableId,
        groupId,
        { customFields: { [statusFieldName]: newStatus } },
        userPubkey,
        currentTable
      );
      onStatusChange?.(newStatus);
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setUpdating(false);
    }
  }, [currentRecord, currentTable, recordId, tableId, groupId, userPubkey, statusFieldName, onStatusChange, updating]);

  // Quick advance to next stage
  const handleAdvance = useCallback(() => {
    if (currentStageIndex < 0 || currentStageIndex >= statusStages.length - 1) return;
    const nextStage = statusStages[currentStageIndex + 1];
    handleStatusChange(nextStage.value);
  }, [currentStageIndex, statusStages, handleStatusChange]);

  if (!statusField || statusStages.length === 0) {
    return (
      <div className={cn('text-center text-muted-foreground py-4', className)}>
        {t('crm.noStatusField', 'No status field configured')}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            {t('crm.statusWorkflow', 'Status Workflow')}
          </CardTitle>
          {currentStageIndex < statusStages.length - 1 && (
            <Button
              size="sm"
              onClick={handleAdvance}
              disabled={updating}
            >
              <ChevronRight className="h-4 w-4 mr-1" />
              {t('crm.advance', 'Advance')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
          <div className="flex items-center gap-2 pb-2">
            {statusStages.map((stage, index) => (
              <div key={stage.value} className="flex items-center">
                {/* Stage indicator */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleStatusChange(stage.value)}
                        disabled={updating || stage.isCurrent}
                        className={cn(
                          'flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all',
                          'min-w-[100px]',
                          stage.isCurrent && 'bg-primary/10 ring-2 ring-primary',
                          !stage.isCurrent && 'hover:bg-muted',
                          updating && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <div
                          className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center',
                            stage.isComplete && 'bg-green-500 text-white',
                            stage.isCurrent && stage.color,
                            stage.isCurrent && 'text-white',
                            !stage.isComplete && !stage.isCurrent && 'bg-muted'
                          )}
                        >
                          {stage.isComplete ? (
                            <Check className="h-4 w-4" />
                          ) : stage.isCurrent ? (
                            <Clock className="h-4 w-4" />
                          ) : (
                            <span className="text-xs font-medium">{index + 1}</span>
                          )}
                        </div>
                        <span
                          className={cn(
                            'text-xs font-medium text-center',
                            stage.isCurrent && 'text-primary',
                            !stage.isCurrent && 'text-muted-foreground'
                          )}
                        >
                          {stage.label}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {stage.isCurrent
                          ? t('crm.currentStatus', 'Current status')
                          : t('crm.clickToChange', 'Click to change status')}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Connector line */}
                {index < statusStages.length - 1 && (
                  <div
                    className={cn(
                      'h-0.5 w-8 mx-1',
                      index < currentStageIndex ? 'bg-green-500' : 'bg-muted'
                    )}
                  />
                )}
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Status dropdown for mobile/quick change */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t('crm.quickStatusChange', 'Quick status change')}:
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {currentStatus || t('crm.selectStatus', 'Select status')}
                  <MoreHorizontal className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {statusStages.map((stage) => (
                  <DropdownMenuItem
                    key={stage.value}
                    onClick={() => handleStatusChange(stage.value)}
                    disabled={stage.isCurrent}
                  >
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full mr-2',
                        stage.color || 'bg-gray-400'
                      )}
                    />
                    {stage.label}
                    {stage.isCurrent && (
                      <Check className="h-4 w-4 ml-auto" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default StatusWorkflow;
