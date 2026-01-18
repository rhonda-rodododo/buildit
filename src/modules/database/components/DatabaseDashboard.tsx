/**
 * Database Dashboard Component
 * Main dashboard for database module
 */

import React from 'react';
import { useDatabaseStore } from '../databaseStore';
import { databaseManager } from '../databaseManager';
import { TableView } from './TableView';
import { BoardView } from './BoardView';
import { CalendarView } from './CalendarView';
import { GalleryView } from './GalleryView';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Table2, Kanban, Calendar, Grid } from 'lucide-react';
import type { DatabaseRecord } from '../types';

interface DatabaseDashboardProps {
  groupId: string;
  userPubkey: string;
}

export function DatabaseDashboard({ groupId, userPubkey }: DatabaseDashboardProps) {
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
    const name = prompt('Table name:');
    if (!name) return;
    const table = await databaseManager.createTable(groupId, userPubkey, name);
    setCurrentTable(table.id);
  };

  const handleCreateRecord = async () => {
    if (!currentTable) return;
    // This would open a dialog in a real implementation
    await databaseManager.createRecord(currentTable.id, groupId, userPubkey, {});
  };

  const handleRecordClick = (_record: DatabaseRecord) => {
    // TODO: Open a record detail dialog
  };

  if (groupTables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold">No tables yet</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Create your first table to get started
          </p>
        </div>
        <Button onClick={handleCreateTable}>
          <Plus className="h-4 w-4 mr-2" />
          Create Table
        </Button>
      </div>
    );
  }

  if (!currentTable || !currentView) {
    return <div className="p-4 text-muted-foreground">Loading...</div>;
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
            New Table
          </Button>
          <Button onClick={handleCreateRecord}>
            <Plus className="h-4 w-4 mr-2" />
            New Record
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
    </div>
  );
}
