/**
 * Database Dashboard Component
 * Main dashboard for database module
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatabaseStore } from '../databaseStore';
import { databaseManager } from '../databaseManager';
import { TableView } from './TableView';
import { BoardView } from './BoardView';
import { CalendarView } from './CalendarView';
import { GalleryView } from './GalleryView';
import { RecordDetailView } from './RecordDetailView';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Plus, Table2, Kanban, Calendar, Grid } from 'lucide-react';
import type { DatabaseRecord } from '../types';

interface DatabaseDashboardProps {
  groupId: string;
  userPubkey: string;
}

export function DatabaseDashboard({ groupId, userPubkey }: DatabaseDashboardProps) {
  const { t } = useTranslation();
  const {
    tables,
    currentTableId,
    setCurrentTable,
    views,
    currentViewId,
    setCurrentView,
    getRecordsByTable,
    getViewsByTable,
  } = useDatabaseStore();

  const groupTables = Array.from(tables.values()).filter((t) => t.groupId === groupId);
  const currentTable = currentTableId ? tables.get(currentTableId) : groupTables[0];
  const tableViews = currentTable ? getViewsByTable(currentTable.id) : [];
  const currentView = currentViewId ? views.get(currentViewId) : tableViews[0];
  const records = currentTable ? getRecordsByTable(currentTable.id) : [];

  // Load data on mount
  React.useEffect(() => {
    databaseManager.loadTablesForGroup(groupId);
  }, [groupId]);

  // Load views and records when table changes
  React.useEffect(() => {
    if (currentTable) {
      databaseManager.loadViewsForTable(currentTable.id);
      databaseManager.loadRecordsForTable(currentTable.id);
    }
  }, [currentTable?.id]);

  const handleCreateTable = async () => {
    const name = prompt(t('databaseDashboard.tableNamePrompt'));
    if (!name) return;
    const table = await databaseManager.createTable(groupId, userPubkey, name);
    setCurrentTable(table.id);
  };

  const handleCreateRecord = async () => {
    if (!currentTable) return;
    // This would open a dialog in a real implementation
    await databaseManager.createRecord(currentTable.id, groupId, userPubkey, {});
  };

  const [selectedRecord, setSelectedRecord] = useState<DatabaseRecord | null>(null);
  const [recordDetailOpen, setRecordDetailOpen] = useState(false);

  const handleRecordClick = (record: DatabaseRecord) => {
    setSelectedRecord(record);
    setRecordDetailOpen(true);
  };

  if (groupTables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold">{t('databaseDashboard.noTablesTitle')}</h3>
          <p className="text-sm text-muted-foreground mt-2">
            {t('databaseDashboard.noTablesDescription')}
          </p>
        </div>
        <Button onClick={handleCreateTable}>
          <Plus className="h-4 w-4 mr-2" />
          {t('databaseDashboard.createTable')}
        </Button>
      </div>
    );
  }

  if (!currentTable || !currentView) {
    return <div className="p-4 text-muted-foreground">{t('databaseDashboard.loading')}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Table selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={currentTable.id}
            onChange={(e) => setCurrentTable(e.target.value)}
            className="text-lg font-semibold bg-transparent border-none outline-none cursor-pointer"
          >
            {groupTables.map((table) => (
              <option key={table.id} value={table.id}>
                {table.icon} {table.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCreateTable}>
            <Plus className="h-4 w-4 mr-2" />
            {t('databaseDashboard.newTable')}
          </Button>
          <Button onClick={handleCreateRecord}>
            <Plus className="h-4 w-4 mr-2" />
            {t('databaseDashboard.newRecord')}
          </Button>
        </div>
      </div>

      {/* View tabs */}
      <Tabs value={currentView.id} onValueChange={setCurrentView}>
        <TabsList>
          {tableViews.map((view) => (
            <TabsTrigger key={view.id} value={view.id} className="gap-2">
              {view.type === 'table' && <Table2 className="h-4 w-4" />}
              {view.type === 'board' && <Kanban className="h-4 w-4" />}
              {view.type === 'calendar' && <Calendar className="h-4 w-4" />}
              {view.type === 'gallery' && <Grid className="h-4 w-4" />}
              {view.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {tableViews.map((view) => (
          <TabsContent key={view.id} value={view.id} className="mt-4">
            {view.type === 'table' && (
              <TableView
                table={currentTable}
                view={view}
                records={records}
                onRecordClick={handleRecordClick}
              />
            )}
            {view.type === 'board' && (
              <BoardView
                table={currentTable}
                view={view}
                records={records}
                onRecordClick={handleRecordClick}
              />
            )}
            {view.type === 'calendar' && (
              <CalendarView
                table={currentTable}
                view={view}
                records={records}
                onRecordClick={handleRecordClick}
              />
            )}
            {view.type === 'gallery' && (
              <GalleryView
                table={currentTable}
                view={view}
                records={records}
                onRecordClick={handleRecordClick}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Record Detail Dialog */}
      <Dialog open={recordDetailOpen} onOpenChange={setRecordDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedRecord && currentTable && (
            <RecordDetailView
              record={selectedRecord}
              table={currentTable}
              onEdit={() => {
                setRecordDetailOpen(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
