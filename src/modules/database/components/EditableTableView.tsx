/**
 * Editable Database Table View Component
 * Fully editable spreadsheet with virtualization, inline editing, and infinite scrolling
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type Row,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import type { DatabaseRecord, DatabaseTable } from '../types';
import type { CustomField } from '@/modules/custom-fields/types';
import { ArrowUpDown, Trash2, Plus } from 'lucide-react';
import { EditableCell } from './EditableCell';

interface EditableTableViewProps {
  table: DatabaseTable;
  records: DatabaseRecord[];
  onRecordClick?: (record: DatabaseRecord) => void;
  onRecordUpdate?: (recordId: string, updates: Partial<DatabaseRecord>) => void;
  onRecordDelete?: (recordIds: string[]) => void;
  onRecordCreate?: () => void;
}

export function EditableTableView({
  table,
  records,
  onRecordClick,
  onRecordUpdate,
  onRecordDelete,
  onRecordCreate,
}: EditableTableViewProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [editingCell, setEditingCell] = useState<{ rowId: string; fieldName: string } | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Handle cell value update
  const handleCellUpdate = useCallback(
    (rowId: string, fieldName: string, value: unknown) => {
      onRecordUpdate?.(rowId, {
        customFields: {
          ...records.find((r) => r.id === rowId)?.customFields,
          [fieldName]: value,
        },
      });
      setEditingCell(null);
    },
    [onRecordUpdate, records]
  );

  // Generate columns with selection and inline editing
  const columns = useMemo<ColumnDef<DatabaseRecord>[]>(() => {
    const baseColumns: ColumnDef<DatabaseRecord>[] = [
      // Selection column
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 40,
      },
      // Field columns
      ...table.fields.map((field: CustomField) => ({
        accessorFn: (row: DatabaseRecord) => row.customFields[field.name],
        id: field.name,
        header: ({ column }: { column: any }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="h-8 px-2 -ml-2"
            >
              {field.label}
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }: { row: any }) => {
          const isEditing =
            editingCell?.rowId === row.original.id && editingCell?.fieldName === field.name;

          return (
            <EditableCell
              field={field}
              value={row.original.customFields[field.name]}
              isEditing={isEditing}
              onEdit={() => setEditingCell({ rowId: row.original.id, fieldName: field.name })}
              onSave={(value) => handleCellUpdate(row.original.id, field.name, value)}
              onCancel={() => setEditingCell(null)}
            />
          );
        },
        size: 200,
      })),
    ];

    return baseColumns;
  }, [table.fields, editingCell, handleCellUpdate]);

  const reactTable = useReactTable({
    data: records,
    columns,
    state: {
      sorting,
      columnFilters,
      rowSelection,
    },
    enableRowSelection: true,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // Virtualization
  const { rows } = reactTable.getRowModel();
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 53, // Approximate row height
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0 ? totalSize - (virtualRows[virtualRows.length - 1]?.end || 0) : 0;

  // Bulk actions
  const selectedRowIds = Object.keys(rowSelection).filter((key) => rowSelection[key]);
  const handleDeleteSelected = useCallback(() => {
    if (selectedRowIds.length > 0 && onRecordDelete) {
      const recordIds = selectedRowIds.map((index) => records[parseInt(index)].id);
      onRecordDelete(recordIds);
      setRowSelection({});
    }
  }, [selectedRowIds, onRecordDelete, records]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 overflow-x-auto">
          {table.fields.slice(0, 3).map((field) => (
            <Input
              key={field.name}
              placeholder={`Filter ${field.label}...`}
              value={(reactTable.getColumn(field.name)?.getFilterValue() as string) ?? ''}
              onChange={(event) =>
                reactTable.getColumn(field.name)?.setFilterValue(event.target.value)
              }
              className="h-8 w-40"
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {selectedRowIds.length > 0 && (
            <>
              <span className="text-sm text-muted-foreground">
                {selectedRowIds.length} selected
              </span>
              <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </>
          )}
          <Button variant="default" size="sm" onClick={onRecordCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Add Record
          </Button>
        </div>
      </div>

      {/* Virtualized Table */}
      <div
        ref={tableContainerRef}
        className="rounded-md border overflow-auto"
        style={{ height: '600px' }}
      >
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            {reactTable.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className="border-r last:border-r-0"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {paddingTop > 0 && (
              <tr>
                <td style={{ height: `${paddingTop}px` }} />
              </tr>
            )}
            {virtualRows.map((virtualRow: any) => {
              const row = rows[virtualRow.index] as Row<DatabaseRecord>;
              return (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className="cursor-pointer hover:bg-muted/50"
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  onClick={() => onRecordClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className="border-r last:border-r-0"
                      onClick={(e) => {
                        if (cell.column.id !== 'select') {
                          e.stopPropagation();
                        }
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
            {paddingBottom > 0 && (
              <tr>
                <td style={{ height: `${paddingBottom}px` }} />
              </tr>
            )}
          </TableBody>
        </Table>
        {rows.length === 0 && (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            No records found.
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="text-sm text-muted-foreground">
        Showing {rows.length} of {records.length} records
        {selectedRowIds.length > 0 && ` • ${selectedRowIds.length} selected`}
      </div>
    </div>
  );
}
