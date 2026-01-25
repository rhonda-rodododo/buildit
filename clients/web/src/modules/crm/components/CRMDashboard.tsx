/**
 * CRM Dashboard Component
 * Enhanced dashboard with template gallery, quick stats, search, and activity feed
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { crmTemplateManager } from '../crmTemplateManager';
import { useTemplateStore } from '../templateStore';
import type { CRMMultiTableTemplate, CRMTemplateCategory } from '../types';
import { useDatabaseStore } from '@/modules/database/databaseStore';
import { databaseManager } from '@/modules/database/databaseManager';
import { DatabaseDashboard } from '@/modules/database/components/DatabaseDashboard';
import type { DatabaseRecord, RecordActivity } from '@/modules/database/types';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Plus,
  Users,
  FileText,
  Calendar,
  Activity,
  Loader2,
  ArrowRight,
  Clock,
  Grid3X3,
  LayoutGrid,
  Settings2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface CRMDashboardProps {
  groupId: string;
  userPubkey: string;
}

const CATEGORY_LABELS: Record<CRMTemplateCategory, { label: string; icon: string }> = {
  organizing: { label: 'Organizing', icon: '✊' },
  fundraising: { label: 'Fundraising', icon: '💰' },
  legal: { label: 'Legal', icon: '⚖️' },
  volunteer: { label: 'Volunteer', icon: '🤝' },
  'civil-defense': { label: 'Civil Defense', icon: '🛡️' },
  tenant: { label: 'Tenant', icon: '🏠' },
  nonprofit: { label: 'Nonprofit', icon: '❤️' },
  member: { label: 'Member', icon: '👥' },
  sales: { label: 'Sales', icon: '📈' },
};

export function CRMDashboard({ groupId, userPubkey }: CRMDashboardProps) {
  const { t } = useTranslation();
  const { tables, getRecordsByTable } = useDatabaseStore();

  // State
  const [view, setView] = useState<'dashboard' | 'templates' | 'tables'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [applying, setApplying] = useState(false);
  const [recentActivities, setRecentActivities] = useState<RecordActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Load custom templates for group
  useEffect(() => {
    useTemplateStore.getState().loadCustomTemplates(groupId);
  }, [groupId]);

  // Get templates
  const allTemplates = useMemo(() => {
    return crmTemplateManager.getAvailableTemplates(groupId);
  }, [groupId]);

  // Get group tables
  const groupTables = useMemo(() => {
    return Array.from(tables.values()).filter((t) => t.groupId === groupId);
  }, [tables, groupId]);

  // Get group records (from all tables in this group)
  const groupRecords = useMemo(() => {
    const allRecords: DatabaseRecord[] = [];
    for (const table of groupTables) {
      const tableRecords = getRecordsByTable(table.id);
      allRecords.push(...tableRecords);
    }
    return allRecords;
  }, [groupTables, getRecordsByTable]);

  // Quick stats
  const stats = useMemo(() => {
    const totalRecords = groupRecords.length;
    const totalTables = groupTables.length;

    // Get records by table for more specific stats
    const recordsByTable = new Map<string, DatabaseRecord[]>();
    for (const record of groupRecords) {
      const list = recordsByTable.get(record.tableId) || [];
      list.push(record);
      recordsByTable.set(record.tableId, list);
    }

    // Try to find a "contacts" table
    const contactsTable = groupTables.find(
      (t) => t.name.toLowerCase().includes('contact')
    );
    const contactsCount = contactsTable
      ? recordsByTable.get(contactsTable.id)?.length || 0
      : 0;

    // Find recent records (last 7 days)
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentRecords = groupRecords.filter((r) => r.created > weekAgo);

    return {
      totalRecords,
      totalTables,
      contactsCount,
      recentRecords: recentRecords.length,
    };
  }, [groupTables, groupRecords]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    const results: Array<{ record: DatabaseRecord; tableName: string; matchField: string }> = [];

    for (const record of groupRecords) {
      const table = tables.get(record.tableId);
      if (!table) continue;

      // Search in custom fields
      for (const [fieldName, value] of Object.entries(record.customFields)) {
        if (value && String(value).toLowerCase().includes(query)) {
          const field = table.fields.find((f) => f.name === fieldName);
          results.push({
            record,
            tableName: table.name,
            matchField: field?.label || fieldName,
          });
          break; // Only add once per record
        }
      }
    }

    return results.slice(0, 20); // Limit results
  }, [searchQuery, groupRecords, tables]);

  // Load recent activities
  useEffect(() => {
    const loadActivities = async () => {
      if (groupTables.length === 0) return;

      setLoadingActivities(true);
      try {
        const allActivities: RecordActivity[] = [];

        // Get activities from first few tables
        for (const table of groupTables.slice(0, 5)) {
          const tableRecords = groupRecords.filter((r) => r.tableId === table.id);
          for (const record of tableRecords.slice(0, 5)) {
            const activities = await databaseManager.getRecordActivities(record.id, table.id, 5);
            allActivities.push(...activities);
          }
        }

        // Sort by time and take most recent
        allActivities.sort((a, b) => b.createdAt - a.createdAt);
        setRecentActivities(allActivities.slice(0, 10));
      } catch (error) {
        console.error('Failed to load activities:', error);
      } finally {
        setLoadingActivities(false);
      }
    };

    loadActivities();
  }, [groupTables, groupRecords]);

  // Apply template
  const handleApplyTemplate = useCallback(
    async (template: CRMMultiTableTemplate) => {
      setApplying(true);
      try {
        await crmTemplateManager.applyTemplate(groupId, template.id, userPubkey, {
          includeSeedData: true,
        });
        setView('tables');
      } catch (error) {
        console.error('Failed to apply template:', error);
      } finally {
        setApplying(false);
      }
    },
    [groupId, userPubkey]
  );

  // Render quick stats
  const renderStats = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {t('crm.totalRecords', 'Total Records')}
            </span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.totalRecords}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <Grid3X3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {t('crm.tables', 'Tables')}
            </span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.totalTables}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {t('crm.contacts', 'Contacts')}
            </span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.contactsCount}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {t('crm.thisWeek', 'This Week')}
            </span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.recentRecords}</p>
        </CardContent>
      </Card>
    </div>
  );

  // Render search
  const renderSearch = () => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Search className="h-4 w-4" />
          {t('crm.globalSearch', 'Global Search')}
        </CardTitle>
        <CardDescription>
          {t('crm.searchAllTables', 'Search across all CRM tables')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Input
          placeholder={t('crm.searchPlaceholder', 'Search contacts, cases, records...')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mb-4"
        />

        {searchQuery && (
          <div className="space-y-2">
            {searchResults.length > 0 ? (
              searchResults.map((result) => (
                <div
                  key={result.record.id}
                  className="flex items-center justify-between p-2 border rounded hover:bg-muted/50 cursor-pointer"
                >
                  <div>
                    <p className="font-medium">
                      {String(Object.values(result.record.customFields)[0] || result.record.id)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {result.tableName} • {t('crm.matchedIn', 'Matched in')}: {result.matchField}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('crm.noResults', 'No results found')}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Render activity feed
  const renderActivityFeed = () => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-4 w-4" />
          {t('crm.recentActivity', 'Recent Activity')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loadingActivities ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : recentActivities.length > 0 ? (
          <ScrollArea className="h-64">
            <div className="space-y-3">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <Badge variant="outline" className="mr-2">
                        {activity.type}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(activity.createdAt, { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            {t('crm.noActivity', 'No recent activity')}
          </p>
        )}
      </CardContent>
    </Card>
  );

  // Render template gallery
  const renderTemplateGallery = () => {
    // Group templates by category
    const templatesByCategory = new Map<CRMTemplateCategory, CRMMultiTableTemplate[]>();
    for (const template of allTemplates) {
      const list = templatesByCategory.get(template.category) || [];
      list.push(template);
      templatesByCategory.set(template.category, list);
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{t('crm.templateGallery', 'Template Gallery')}</h2>
            <p className="text-muted-foreground">
              {t('crm.chooseTemplate', 'Choose a template to get started with your CRM')}
            </p>
          </div>
          {groupTables.length > 0 && (
            <Button variant="outline" onClick={() => setView('dashboard')}>
              {t('crm.backToDashboard', 'Back to Dashboard')}
            </Button>
          )}
        </div>

        {Array.from(templatesByCategory.entries()).map(([category, templates]) => (
          <div key={category} className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <span>{CATEGORY_LABELS[category]?.icon}</span>
              {CATEGORY_LABELS[category]?.label || category}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => !applying && handleApplyTemplate(template)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-2xl">{template.icon}</span>
                      {template.name}
                    </CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {template.tables && (
                        <Badge variant="secondary">
                          {template.tables.length} {t('crm.tables', 'tables')}
                        </Badge>
                      )}
                      {template.relationships && template.relationships.length > 0 && (
                        <Badge variant="outline">
                          {template.relationships.length} {t('crm.relationships', 'relationships')}
                        </Badge>
                      )}
                    </div>
                    <Button className="w-full" disabled={applying}>
                      {applying ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      {t('crm.useTemplate', 'Use Template')}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render main dashboard
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('crm.title', 'CRM')}</h2>
          <p className="text-muted-foreground">
            {t('crm.subtitle', 'Manage your contacts, cases, and relationships')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setView('templates')}>
            <LayoutGrid className="h-4 w-4 mr-2" />
            {t('crm.browseTemplates', 'Templates')}
          </Button>
          <Button variant="outline" onClick={() => setView('tables')}>
            <Settings2 className="h-4 w-4 mr-2" />
            {t('crm.manageTables', 'Tables')}
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      {renderStats()}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Search */}
        {renderSearch()}

        {/* Activity Feed */}
        {renderActivityFeed()}
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t('crm.quickActions', 'Quick Actions')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {groupTables.slice(0, 4).map((table) => (
              <Button
                key={table.id}
                variant="outline"
                className="flex items-center gap-2 h-auto py-3"
                onClick={() => setView('tables')}
              >
                <span className="text-xl">{table.icon || '📋'}</span>
                <div className="text-left">
                  <p className="font-medium">{t('crm.new', 'New')} {table.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {getRecordsByTable(table.id).length} records
                  </p>
                </div>
              </Button>
            ))}
            {groupTables.length === 0 && (
              <Button
                variant="outline"
                className="col-span-4 flex items-center gap-2 h-auto py-3"
                onClick={() => setView('templates')}
              >
                <Plus className="h-4 w-4" />
                {t('crm.createFromTemplate', 'Create CRM from Template')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Render based on view state
  if (view === 'templates') {
    return renderTemplateGallery();
  }

  if (view === 'tables') {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">{t('crm.manageTables', 'Manage Tables')}</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setView('templates')}>
              {t('crm.browseTemplates', 'Templates')}
            </Button>
            <Button variant="outline" onClick={() => setView('dashboard')}>
              {t('crm.backToDashboard', 'Dashboard')}
            </Button>
          </div>
        </div>
        <DatabaseDashboard groupId={groupId} userPubkey={userPubkey} />
      </div>
    );
  }

  // Show template gallery if no tables exist
  if (groupTables.length === 0) {
    return renderTemplateGallery();
  }

  return renderDashboard();
}
