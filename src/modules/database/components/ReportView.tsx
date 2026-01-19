/**
 * Report View Component
 * Renders data summaries, charts, and pivot tables for database records
 * Supports configurable aggregations and visualizations
 */

import { useMemo, useState } from 'react';
import type { DatabaseRecord, DatabaseView, ViewConfig, ReportAggregation } from '../types';
import type { CustomField } from '@/modules/custom-fields/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3,
  LineChart,
  PieChart,
  Table2,
  TrendingUp,
  Hash,
  Calculator,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface ReportViewProps {
  records: DatabaseRecord[];
  view: DatabaseView;
  fields: CustomField[];
  className?: string;
  onConfigChange?: (config: Partial<ViewConfig>) => void;
}

interface AggregateResult {
  value: number;
  label: string;
  field: string;
  operation: string;
}

interface GroupedData {
  group: string;
  count: number;
  aggregates: AggregateResult[];
  records: DatabaseRecord[];
}

interface PivotCell {
  row: string;
  column: string;
  value: number;
}

export function ReportView({
  records,
  view,
  fields,
  className,
  onConfigChange: _onConfigChange,
}: ReportViewProps) {
  const { t } = useTranslation();
  const config = view.config;

  const [selectedReportType, setSelectedReportType] = useState<'summary' | 'chart' | 'pivot'>(
    config.reportType || 'summary'
  );
  const [selectedChartType, setSelectedChartType] = useState<'bar' | 'line' | 'pie' | 'donut'>(
    config.reportChartType || 'bar'
  );

  // Build field lookup
  const fieldsByName = useMemo(() => {
    const map = new Map<string, CustomField>();
    for (const field of fields) {
      map.set(field.name, field);
    }
    return map;
  }, [fields]);

  // Note: Numeric fields for aggregations and categorical fields for grouping
  // are available via the fields prop for use in configuration UI (Phase 4.5.6)

  // Get groupBy fields
  const groupByFields = config.reportGroupBy || [];

  // Get aggregations
  const aggregations: ReportAggregation[] = config.reportAggregations || [
    { field: '_count', operation: 'count', label: 'Count' },
  ];

  // Calculate aggregates for a group of records
  const calculateAggregates = (groupRecords: DatabaseRecord[]): AggregateResult[] => {
    return aggregations.map((agg) => {
      let value = 0;

      if (agg.operation === 'count') {
        value = groupRecords.length;
      } else if (agg.operation === 'countDistinct') {
        const uniqueValues = new Set(
          groupRecords.map((r) => r.customFields[agg.field])
        );
        value = uniqueValues.size;
      } else {
        const values = groupRecords
          .map((r) => {
            const v = r.customFields[agg.field];
            return typeof v === 'number' ? v : parseFloat(String(v));
          })
          .filter((v) => !isNaN(v));

        if (values.length > 0) {
          switch (agg.operation) {
            case 'sum':
              value = values.reduce((a, b) => a + b, 0);
              break;
            case 'avg':
              value = values.reduce((a, b) => a + b, 0) / values.length;
              break;
            case 'min':
              value = Math.min(...values);
              break;
            case 'max':
              value = Math.max(...values);
              break;
          }
        }
      }

      return {
        value,
        label: agg.label || `${agg.operation} of ${agg.field}`,
        field: agg.field,
        operation: agg.operation,
      };
    });
  };

  // Group data by fields
  const groupedData = useMemo((): GroupedData[] => {
    if (groupByFields.length === 0) {
      // No grouping - single group with all records
      return [
        {
          group: t('database.allRecords', 'All Records'),
          count: records.length,
          aggregates: calculateAggregates(records),
          records,
        },
      ];
    }

    // Group by first field (multi-level grouping could be added later)
    const groupField = groupByFields[0];
    const groups = new Map<string, DatabaseRecord[]>();

    for (const record of records) {
      const value = record.customFields[groupField];
      const key = value != null ? String(value) : t('common.unknown', 'Unknown');

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(record);
    }

    return Array.from(groups.entries())
      .map(([group, groupRecords]) => ({
        group,
        count: groupRecords.length,
        aggregates: calculateAggregates(groupRecords),
        records: groupRecords,
      }))
      .sort((a, b) => b.count - a.count);
  }, [records, groupByFields, aggregations, t]);

  // Calculate pivot data
  const pivotData = useMemo((): { rows: string[]; columns: string[]; cells: PivotCell[] } => {
    const rowField = config.reportPivotRowField;
    const columnField = config.reportPivotColumnField;
    const valueField = config.reportPivotValueField;
    const aggOperation = config.reportPivotAggregation || 'count';

    if (!rowField || !columnField) {
      return { rows: [], columns: [], cells: [] };
    }

    const rowValues = new Set<string>();
    const columnValues = new Set<string>();
    const cellMap = new Map<string, { values: number[]; records: DatabaseRecord[] }>();

    for (const record of records) {
      const rowVal = String(record.customFields[rowField] ?? t('common.unknown', 'Unknown'));
      const colVal = String(record.customFields[columnField] ?? t('common.unknown', 'Unknown'));

      rowValues.add(rowVal);
      columnValues.add(colVal);

      const key = `${rowVal}|${colVal}`;
      if (!cellMap.has(key)) {
        cellMap.set(key, { values: [], records: [] });
      }

      const cell = cellMap.get(key)!;
      cell.records.push(record);

      if (valueField && record.customFields[valueField] != null) {
        const val = Number(record.customFields[valueField]);
        if (!isNaN(val)) {
          cell.values.push(val);
        }
      }
    }

    const rows = Array.from(rowValues).sort();
    const columns = Array.from(columnValues).sort();
    const cells: PivotCell[] = [];

    for (const [key, cell] of cellMap) {
      const [row, column] = key.split('|');
      let value = 0;

      switch (aggOperation) {
        case 'count':
          value = cell.records.length;
          break;
        case 'sum':
          value = cell.values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          value = cell.values.length > 0
            ? cell.values.reduce((a, b) => a + b, 0) / cell.values.length
            : 0;
          break;
        case 'min':
          value = cell.values.length > 0 ? Math.min(...cell.values) : 0;
          break;
        case 'max':
          value = cell.values.length > 0 ? Math.max(...cell.values) : 0;
          break;
      }

      cells.push({ row, column, value });
    }

    return { rows, columns, cells };
  }, [records, config, t]);

  // Get field label
  const getFieldLabel = (fieldName: string): string => {
    const field = fieldsByName.get(fieldName);
    return field?.label || fieldName;
  };

  // Format number
  const formatNumber = (value: number, operation?: string): string => {
    if (operation === 'avg') {
      return value.toFixed(2);
    }
    if (Number.isInteger(value)) {
      return value.toLocaleString();
    }
    return value.toFixed(2);
  };

  // Render summary report
  const renderSummaryReport = () => (
    <div className="space-y-4">
      {/* Overall stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {t('database.totalRecords', 'Total Records')}
              </span>
            </div>
            <p className="text-2xl font-bold">{records.length.toLocaleString()}</p>
          </CardContent>
        </Card>

        {aggregations.slice(0, 3).map((agg, i) => {
          const totalAgg = calculateAggregates(records).find(
            (a) => a.field === agg.field && a.operation === agg.operation
          );
          return (
            <Card key={i}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground truncate">
                    {agg.label || `${agg.operation} of ${getFieldLabel(agg.field)}`}
                  </span>
                </div>
                <p className="text-2xl font-bold">
                  {formatNumber(totalAgg?.value || 0, agg.operation)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Grouped data table */}
      {groupByFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {t('database.groupedBy', 'Grouped by {{field}}', {
                field: getFieldLabel(groupByFields[0]),
              })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{getFieldLabel(groupByFields[0])}</TableHead>
                  <TableHead className="text-right">
                    {t('database.count', 'Count')}
                  </TableHead>
                  {aggregations
                    .filter((a) => a.operation !== 'count')
                    .map((agg, i) => (
                      <TableHead key={i} className="text-right">
                        {agg.label || `${agg.operation} of ${getFieldLabel(agg.field)}`}
                      </TableHead>
                    ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedData.map((group, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{group.group}</TableCell>
                    <TableCell className="text-right">{group.count}</TableCell>
                    {group.aggregates
                      .filter((a) => a.operation !== 'count')
                      .map((agg, j) => (
                        <TableCell key={j} className="text-right">
                          {formatNumber(agg.value, agg.operation)}
                        </TableCell>
                      ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );

  // Render chart report (simplified - would use real charting library in production)
  const renderChartReport = () => {
    const maxValue = Math.max(...groupedData.map((g) => g.count));

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {groupByFields.length > 0
                ? t('database.distributionBy', 'Distribution by {{field}}', {
                    field: getFieldLabel(groupByFields[0]),
                  })
                : t('database.recordDistribution', 'Record Distribution')}
            </CardTitle>
            <Select
              value={selectedChartType}
              onValueChange={(v) => setSelectedChartType(v as 'bar' | 'line' | 'pie' | 'donut')}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    {t('database.barChart', 'Bar')}
                  </div>
                </SelectItem>
                <SelectItem value="line">
                  <div className="flex items-center gap-2">
                    <LineChart className="h-4 w-4" />
                    {t('database.lineChart', 'Line')}
                  </div>
                </SelectItem>
                <SelectItem value="pie">
                  <div className="flex items-center gap-2">
                    <PieChart className="h-4 w-4" />
                    {t('database.pieChart', 'Pie')}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {/* Simple bar chart visualization */}
          {(selectedChartType === 'bar' || selectedChartType === 'line') && (
            <div className="space-y-2">
              {groupedData.map((group, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-24 text-sm truncate">{group.group}</span>
                  <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${(group.count / maxValue) * 100}%` }}
                    />
                  </div>
                  <Badge variant="secondary" className="min-w-[3rem] justify-center">
                    {group.count}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Simple pie chart visualization */}
          {(selectedChartType === 'pie' || selectedChartType === 'donut') && (
            <div className="flex flex-wrap gap-2 justify-center">
              {groupedData.map((group, i) => {
                const percentage = ((group.count / records.length) * 100).toFixed(1);
                const colors = [
                  'bg-blue-500',
                  'bg-green-500',
                  'bg-yellow-500',
                  'bg-red-500',
                  'bg-purple-500',
                  'bg-pink-500',
                ];
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-1 border rounded"
                  >
                    <div className={cn('w-3 h-3 rounded-full', colors[i % colors.length])} />
                    <span className="text-sm">{group.group}</span>
                    <Badge variant="outline">{percentage}%</Badge>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-sm text-muted-foreground mt-4 text-center">
            {t(
              'database.chartNote',
              'Note: For production use, integrate a charting library like Recharts or Chart.js'
            )}
          </p>
        </CardContent>
      </Card>
    );
  };

  // Render pivot table
  const renderPivotReport = () => {
    const { rows, columns, cells } = pivotData;

    if (!config.reportPivotRowField || !config.reportPivotColumnField) {
      return (
        <Card>
          <CardContent className="py-8 text-center">
            <Table2 className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {t('database.configurePivot', 'Configure row and column fields for pivot table')}
            </p>
          </CardContent>
        </Card>
      );
    }

    // Create lookup for quick access
    const cellMap = new Map<string, number>();
    for (const cell of cells) {
      cellMap.set(`${cell.row}|${cell.column}`, cell.value);
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t('database.pivotTable', 'Pivot Table')}
          </CardTitle>
          <CardDescription>
            {t('database.pivotDescription', '{{rows}} vs {{columns}}', {
              rows: getFieldLabel(config.reportPivotRowField),
              columns: getFieldLabel(config.reportPivotColumnField),
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-muted">
                    {getFieldLabel(config.reportPivotRowField)} / {getFieldLabel(config.reportPivotColumnField)}
                  </TableHead>
                  {columns.map((col) => (
                    <TableHead key={col} className="text-right bg-muted">
                      {col}
                    </TableHead>
                  ))}
                  <TableHead className="text-right bg-muted font-bold">
                    {t('database.total', 'Total')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const rowTotal = columns.reduce(
                    (sum, col) => sum + (cellMap.get(`${row}|${col}`) || 0),
                    0
                  );
                  return (
                    <TableRow key={row}>
                      <TableCell className="font-medium bg-muted/50">{row}</TableCell>
                      {columns.map((col) => (
                        <TableCell key={col} className="text-right">
                          {formatNumber(cellMap.get(`${row}|${col}`) || 0)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-bold bg-muted/50">
                        {formatNumber(rowTotal)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* Column totals */}
                <TableRow className="bg-muted/50">
                  <TableCell className="font-bold">{t('database.total', 'Total')}</TableCell>
                  {columns.map((col) => {
                    const colTotal = rows.reduce(
                      (sum, row) => sum + (cellMap.get(`${row}|${col}`) || 0),
                      0
                    );
                    return (
                      <TableCell key={col} className="text-right font-bold">
                        {formatNumber(colTotal)}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right font-bold">
                    {formatNumber(cells.reduce((sum, c) => sum + c.value, 0))}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Report type selector */}
      <Tabs value={selectedReportType} onValueChange={(v) => setSelectedReportType(v as 'summary' | 'chart' | 'pivot')}>
        <TabsList>
          <TabsTrigger value="summary" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            {t('database.summary', 'Summary')}
          </TabsTrigger>
          <TabsTrigger value="chart" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            {t('database.chart', 'Chart')}
          </TabsTrigger>
          <TabsTrigger value="pivot" className="gap-2">
            <Table2 className="h-4 w-4" />
            {t('database.pivot', 'Pivot')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary">{renderSummaryReport()}</TabsContent>
        <TabsContent value="chart">{renderChartReport()}</TabsContent>
        <TabsContent value="pivot">{renderPivotReport()}</TabsContent>
      </Tabs>
    </div>
  );
}

export default ReportView;
