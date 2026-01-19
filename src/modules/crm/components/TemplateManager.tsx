/**
 * Template Manager Component
 * Browse, clone, export, and import CRM templates
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { useTemplateStore } from '../templateStore';
import { crmTemplateManager } from '../crmTemplateManager';
import type { CRMMultiTableTemplate, CRMTemplateCategory } from '../types';
import {
  exportTemplate,
  importTemplate,
  serializeExport,
  deserializeExport,
  getExportFilename,
  parseUserIdentifier,
  isVersionCompatible,
  type EncryptedTemplateExport,
} from '../templateExport';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Download,
  Upload,
  Copy,
  Trash2,
  Plus,
  Search,
  FileJson,
  Loader2,
  AlertCircle,
  Check,
  Lock,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { builtInTemplates } from '../templates/index';

interface TemplateManagerProps {
  groupId: string;
  userPubkey: string;
  userPrivkey?: string; // Required for export/import
  className?: string;
  onApplyTemplate?: (templateId: string) => void;
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

export function TemplateManager({
  groupId,
  userPubkey,
  userPrivkey,
  className,
  onApplyTemplate,
}: TemplateManagerProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CRMTemplateCategory | 'all'>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<CRMMultiTableTemplate | null>(null);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Clone dialog state
  const [cloneName, setCloneName] = useState('');
  const [cloneDescription, setCloneDescription] = useState('');

  // Export dialog state
  const [allowedUsers, setAllowedUsers] = useState('');

  // Import dialog state
  const [_importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<EncryptedTemplateExport | null>(null);

  // Get templates from store
  const customTemplates = useTemplateStore((s) => s.customTemplates);

  // Combine built-in and custom templates
  const allTemplates = useMemo(() => {
    const templates: CRMMultiTableTemplate[] = [...builtInTemplates];
    customTemplates.forEach((template) => templates.push(template));
    return templates;
  }, [customTemplates]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return allTemplates.filter((template) => {
      // Category filter
      if (selectedCategory !== 'all' && template.category !== selectedCategory) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          template.name.toLowerCase().includes(query) ||
          template.description.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [allTemplates, selectedCategory, searchQuery]);

  // Check if template is custom (user-created)
  const isCustomTemplate = useCallback(
    (templateId: string): boolean => {
      return customTemplates.has(templateId);
    },
    [customTemplates]
  );

  // Clone template
  const handleClone = async () => {
    if (!selectedTemplate || !cloneName.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const newTemplateId = await crmTemplateManager.cloneTemplate(
        selectedTemplate.id,
        cloneName.trim(),
        groupId,
        userPubkey,
        cloneDescription ? { description: cloneDescription } : undefined
      );

      setSuccess(t('crm.templateCloned', 'Template cloned successfully'));
      setShowCloneDialog(false);
      setCloneName('');
      setCloneDescription('');

      // Load custom templates
      await useTemplateStore.getState().loadCustomTemplates(groupId);

      // Select the new template
      const newTemplate = useTemplateStore.getState().customTemplates.get(newTemplateId);
      if (newTemplate) {
        setSelectedTemplate(newTemplate);
      }
    } catch (err) {
      setError(t('crm.cloneError', 'Failed to clone template'));
      console.error('Clone error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Export template
  const handleExport = async () => {
    if (!selectedTemplate || !userPrivkey) return;

    setLoading(true);
    setError(null);

    try {
      // Parse allowed pubkeys
      let allowedPubkeys: string[] | undefined;
      if (allowedUsers.trim()) {
        const userIds = allowedUsers.split(',').map((s) => s.trim());
        allowedPubkeys = userIds
          .map((id) => parseUserIdentifier(id))
          .filter((pk): pk is string => pk !== null);

        if (allowedPubkeys.length !== userIds.length) {
          throw new Error('Invalid user identifier(s)');
        }
      }

      const encryptedExport = await exportTemplate(
        selectedTemplate,
        userPubkey,
        userPrivkey,
        {
          allowedPubkeys,
          sourceGroupId: groupId,
        }
      );

      // Create download
      const content = serializeExport(encryptedExport);
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const filename = getExportFilename(selectedTemplate.name, 'template');

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess(t('crm.templateExported', 'Template exported successfully'));
      setShowExportDialog(false);
      setAllowedUsers('');
    } catch (err) {
      setError(t('crm.exportError', 'Failed to export template'));
      console.error('Export error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle file selection for import
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setError(null);

    try {
      const content = await file.text();
      const parsed = deserializeExport(content);

      // Check version compatibility
      if (!isVersionCompatible(parsed.meta.version)) {
        throw new Error('Incompatible export version');
      }

      setImportPreview(parsed);
    } catch (err) {
      setError(t('crm.invalidImportFile', 'Invalid import file'));
      setImportPreview(null);
      console.error('Import preview error:', err);
    }
  };

  // Import template
  const handleImport = async () => {
    if (!importPreview || !userPrivkey) return;

    setLoading(true);
    setError(null);

    try {
      const importData = await importTemplate(importPreview, userPrivkey, userPubkey);

      // Save the imported template
      const templateId = await useTemplateStore.getState().saveAsTemplate(
        groupId,
        importData.template,
        userPubkey,
        {
          sourceTemplateId: importData.template.id,
        }
      );

      setSuccess(t('crm.templateImported', 'Template imported successfully'));
      setShowImportDialog(false);
      setImportFile(null);
      setImportPreview(null);

      // Load custom templates
      await useTemplateStore.getState().loadCustomTemplates(groupId);

      // Select the imported template
      const newTemplate = useTemplateStore.getState().customTemplates.get(templateId);
      if (newTemplate) {
        setSelectedTemplate(newTemplate);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('crm.importError', 'Failed to import template')
      );
      console.error('Import error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Delete custom template
  const handleDelete = async (templateId: string) => {
    if (!confirm(t('crm.confirmDeleteTemplate', 'Are you sure you want to delete this template?'))) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await useTemplateStore.getState().deleteTemplate(templateId);
      setSuccess(t('crm.templateDeleted', 'Template deleted'));

      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null);
      }
    } catch (err) {
      setError(t('crm.deleteError', 'Failed to delete template'));
      console.error('Delete error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t('crm.templateManager', 'Template Manager')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('crm.templateManagerDesc', 'Browse, customize, and share CRM templates')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImportDialog(true)}
            disabled={!userPrivkey}
          >
            <Upload className="h-4 w-4 mr-2" />
            {t('common.import', 'Import')}
          </Button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <Check className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Template list */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('crm.searchTemplates', 'Search templates...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={selectedCategory}
              onValueChange={(v) => setSelectedCategory(v as CRMTemplateCategory | 'all')}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t('common.category', 'Category')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all', 'All')}</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([key, { label, icon }]) => (
                  <SelectItem key={key} value={key}>
                    {icon} {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Template grid */}
          <ScrollArea className="h-[500px]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-4">
              {filteredTemplates.map((template) => (
                <Card
                  key={template.id}
                  className={cn(
                    'cursor-pointer transition-colors hover:bg-muted/50',
                    selectedTemplate?.id === template.id && 'ring-2 ring-primary'
                  )}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <CardHeader className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{template.icon}</span>
                        <div>
                          <CardTitle className="text-sm">{template.name}</CardTitle>
                          <div className="flex items-center gap-1 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {CATEGORY_LABELS[template.category]?.label || template.category}
                            </Badge>
                            {isCustomTemplate(template.id) && (
                              <Badge variant="outline" className="text-xs">
                                {t('common.custom', 'Custom')}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <CardDescription className="text-xs line-clamp-2 mt-2">
                      {template.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}

              {filteredTemplates.length === 0 && (
                <div className="col-span-2 text-center py-8 text-muted-foreground">
                  {t('crm.noTemplatesFound', 'No templates found')}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Template detail */}
        <div className="lg:col-span-1">
          {selectedTemplate ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedTemplate.icon}</span>
                  <div>
                    <CardTitle>{selectedTemplate.name}</CardTitle>
                    <CardDescription>{selectedTemplate.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {CATEGORY_LABELS[selectedTemplate.category]?.label || selectedTemplate.category}
                  </Badge>
                  {selectedTemplate.tables && (
                    <Badge variant="outline">
                      {selectedTemplate.tables.length} {t('crm.tables', 'tables')}
                    </Badge>
                  )}
                  {selectedTemplate.relationships && (
                    <Badge variant="outline">
                      {selectedTemplate.relationships.length} {t('crm.relationships', 'relationships')}
                    </Badge>
                  )}
                </div>

                <Separator />

                {/* Tables preview */}
                {selectedTemplate.tables && selectedTemplate.tables.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">{t('crm.includedTables', 'Included Tables')}</h4>
                    <div className="space-y-1">
                      {selectedTemplate.tables.map((table) => (
                        <div key={table.key} className="flex items-center gap-2 text-sm">
                          <span>{table.icon || '📋'}</span>
                          <span>{table.name}</span>
                          <span className="text-muted-foreground">
                            ({table.fields.length} {t('common.fields', 'fields')})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  {onApplyTemplate && (
                    <Button
                      size="sm"
                      onClick={() => onApplyTemplate(selectedTemplate.id)}
                      className="flex-1"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t('crm.applyTemplate', 'Apply')}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCloneName(`${selectedTemplate.name} (Copy)`);
                      setCloneDescription(selectedTemplate.description);
                      setShowCloneDialog(true);
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    {t('common.clone', 'Clone')}
                  </Button>
                  {userPrivkey && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowExportDialog(true)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {t('common.export', 'Export')}
                    </Button>
                  )}
                  {isCustomTemplate(selectedTemplate.id) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(selectedTemplate.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileJson className="h-8 w-8 mx-auto mb-4 opacity-50" />
                <p>{t('crm.selectTemplate', 'Select a template to view details')}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Clone Dialog */}
      <Dialog open={showCloneDialog} onOpenChange={setShowCloneDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('crm.cloneTemplate', 'Clone Template')}</DialogTitle>
            <DialogDescription>
              {t('crm.cloneTemplateDesc', 'Create a custom copy of this template')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('common.name', 'Name')}</Label>
              <Input
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                placeholder={t('crm.templateName', 'Template name')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('common.description', 'Description')}</Label>
              <Textarea
                value={cloneDescription}
                onChange={(e) => setCloneDescription(e.target.value)}
                placeholder={t('crm.templateDesc', 'Describe this template')}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloneDialog(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleClone} disabled={loading || !cloneName.trim()}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              {t('common.clone', 'Clone')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('crm.exportTemplate', 'Export Template')}</DialogTitle>
            <DialogDescription>
              {t('crm.exportTemplateDesc', 'Export this template as an encrypted file')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>
                {t('crm.exportEncrypted', 'The export will be encrypted with your key')}
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label>{t('crm.allowedUsers', 'Allowed Users (optional)')}</Label>
              <Textarea
                value={allowedUsers}
                onChange={(e) => setAllowedUsers(e.target.value)}
                placeholder={t('crm.allowedUsersPlaceholder', 'Enter npub or hex pubkeys, comma-separated')}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                {t('crm.allowedUsersHelp', 'Leave empty to allow only yourself to import')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleExport} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {t('common.export', 'Export')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('crm.importTemplate', 'Import Template')}</DialogTitle>
            <DialogDescription>
              {t('crm.importTemplateDesc', 'Import a template from an encrypted file')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('common.file', 'File')}</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".json,.buildit.json"
                onChange={handleFileSelect}
              />
            </div>

            {importPreview && (
              <div className="space-y-2">
                <Label>{t('common.preview', 'Preview')}</Label>
                <Card>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('common.type', 'Type')}</span>
                      <Badge variant="outline">{importPreview.meta.type}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('common.exported', 'Exported')}</span>
                      <span>{new Date(importPreview.meta.exportedAt).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('common.from', 'From')}</span>
                      <span className="font-mono text-xs">
                        {importPreview.meta.exportedBy.slice(0, 8)}...
                      </span>
                    </div>
                    {importPreview.meta.allowedPubkeys && (
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{importPreview.meta.allowedPubkeys.length} allowed users</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowImportDialog(false);
                setImportFile(null);
                setImportPreview(null);
              }}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleImport} disabled={loading || !importPreview}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {t('common.import', 'Import')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TemplateManager;
