/**
 * Database Table View Component
 * Spreadsheet-like view using TanStack Table
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { DatabaseRecord, DatabaseTable, DatabaseView } from '../types';
import type { CustomField } from '@/modules/custom-fields/types';
import { ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface TableViewProps {
  table: DatabaseTable;
  view: DatabaseView;
  records: DatabaseRecord[];
  onRecordClick?: (record: DatabaseRecord) => void;
  onRecordUpdate?: (recordId: string, updates: Partial<DatabaseRecord>) => void;
}

export function TableView({ table, records, onRecordClick }: TableViewProps) {
  const { t } = useTranslation();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  // Generate columns from custom fields
  const columns = React.useMemo<ColumnDef<DatabaseRecord>[]>(() => {
    const baseColumns: ColumnDef<DatabaseRecord>[] = table.fields.map((field: CustomField) => ({
      accessorFn: (row) => row.customFields[field.name],
      id: field.name,
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 px-2"
          >
            {field.label}
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const value = row.original.customFields[field.name];
        return <div className="px-2">{formatFieldValue(value, field)}</div>;
      },
      filterFn: 'includesString',
    }));

    return baseColumns;
  }, [table.fields]);

  const reactTable = useReactTable({
    data: records,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 25,
      },
    },
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {table.fields.slice(0, 3).map((field) => (
          <Input
            key={field.name}
            placeholder={t('tableView.filterPlaceholder', { label: field.label })}
            value={(reactTable.getColumn(field.name)?.getFilterValue() as string) ?? ''}
            onChange={(event) =>
              reactTable.getColumn(field.name)?.setFilterValue(event.target.value)
            }
            className="h-8 w-40"
          />
        ))}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {reactTable.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {reactTable.getRowModel().rows?.length ? (
              reactTable.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onRecordClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {t('tableView.noRecords')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-muted-foreground">
          {t('tableView.showing', {
            from: reactTable.getState().pagination.pageIndex * reactTable.getState().pagination.pageSize + 1,
            to: Math.min(
              (reactTable.getState().pagination.pageIndex + 1) * reactTable.getState().pagination.pageSize,
              records.length
            ),
            total: records.length
          })}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => reactTable.setPageIndex(0)}
            disabled={!reactTable.getCanPreviousPage()}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => reactTable.previousPage()}
            disabled={!reactTable.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm">
            {t('tableView.page', { current: reactTable.getState().pagination.pageIndex + 1, total: reactTable.getPageCount() })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => reactTable.nextPage()}
            disabled={!reactTable.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => reactTable.setPageIndex(reactTable.getPageCount() - 1)}
            disabled={!reactTable.getCanNextPage()}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Format field value for display
 */
function formatFieldValue(value: unknown, field: CustomField): string {
  if (value === null || value === undefined) return '';

  switch (field.widget.widget) {
    case 'date':
      return value ? new Date(value as string).toLocaleDateString() : '';
    case 'datetime':
      return value ? new Date(value as string).toLocaleString() : '';
    case 'multi-select':
      return Array.isArray(value) ? value.join(', ') : '';
    case 'checkbox':
      return value ? '✓' : '';
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value);
    default:
      return String(value);
  }
}
