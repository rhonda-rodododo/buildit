/**
 * Forms Page Component
 * Main page for managing forms
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { nanoid } from 'nanoid';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { Plus, MoreVertical, Edit, Eye, Trash2, Copy, BarChart } from 'lucide-react';
import { FormBuilder } from './FormBuilder/FormBuilder';
import { PublicFormView } from './PublicFormView/PublicFormView';
import { TemplateGallery } from './FormTemplates/TemplateGallery';
import { SubmissionsList } from './FormSubmissions/SubmissionsList';
import { AnalyticsDashboard } from '@/modules/public/components/Analytics/AnalyticsDashboard';
import { useFormsStore } from '../formsStore';
import { useDatabaseStore } from '@/modules/database/databaseStore';
import { useGroupContext } from '@/contexts/GroupContext';
import { useAuthStore } from '@/stores/authStore';
import type { Form, FormSubmission } from '../types';
import type { JSONSchema7 } from 'json-schema';
import { format } from 'date-fns';
import { toast } from 'sonner';

type ViewMode = 'list' | 'builder' | 'preview' | 'submissions' | 'analytics' | 'templates';

export function FormsPage() {
  const { t } = useTranslation();
  const { groupId } = useGroupContext();
  const currentIdentity = useAuthStore((state) => state.currentIdentity);
  const forms = useFormsStore((state) => state.getFormsByGroup(groupId));
  const addForm = useFormsStore((state) => state.addForm);
  const updateForm = useFormsStore((state) => state.updateForm);
  const deleteForm = useFormsStore((state) => state.deleteForm);
  const addSubmission = useFormsStore((state) => state.addSubmission);
  const getSubmissionsByForm = useFormsStore((state) => state.getSubmissionsByForm);
  const flagSubmissionAsSpam = useFormsStore((state) => state.flagSubmissionAsSpam);
  const markSubmissionProcessed = useFormsStore((state) => state.markSubmissionProcessed);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<Form | null>(null);
  const [submissionDetailOpen, setSubmissionDetailOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);

  // Database tables for form-database linking
  const databaseTables = useDatabaseStore((state) => state.getTablesByGroup(groupId));

  const [selectedTableId, setSelectedTableId] = useState<string>('default-table');

  const handleCreateForm = () => {
    setSelectedForm(null);
    setViewMode('builder');
  };

  const handleEditForm = (form: Form) => {
    setSelectedForm(form);
    setViewMode('builder');
  };

  const handlePreviewForm = (form: Form) => {
    setSelectedForm(form);
    setViewMode('preview');
  };

  const handleViewSubmissions = (form: Form) => {
    setSelectedForm(form);
    setViewMode('submissions');
  };

  const handleViewAnalytics = (form: Form) => {
    setSelectedForm(form);
    setViewMode('analytics');
  };

  const handleSaveForm = (formData: {
    title: string;
    description?: string;
    schema: JSONSchema7;
    uiSchema?: Record<string, unknown>;
    fields: Array<{
      id: string;
      type: string;
      label: string;
      required?: boolean;
      placeholder?: string;
      helpText?: string;
      options?: string[];
      validation?: Record<string, unknown>;
      conditional?: Record<string, unknown>;
      page?: number;
    }>;
  }) => {
    if (selectedForm) {
      // Update existing form
      updateForm(selectedForm.id, {
        title: formData.title,
        description: formData.description,
        schema: formData.schema,
        uiSchema: formData.uiSchema || {},
        fields: formData.fields.map((field, index) => ({
          fieldId: field.id,
          label: field.label,
          placeholder: field.placeholder,
          helpText: field.helpText,
          required: field.required,
          conditionals: field.conditional ? [field.conditional as any] : [],
          order: index,
          page: field.page,
        })),
        updated: Date.now(),
      });
    } else {
      // Create new form
      const newForm: Form = {
        id: nanoid(),
        groupId,
        tableId: selectedTableId,
        title: formData.title,
        description: formData.description,
        status: 'draft',
        schema: formData.schema,
        uiSchema: formData.uiSchema || {},
        fields: formData.fields.map((field, index) => ({
          fieldId: field.id,
          label: field.label,
          placeholder: field.placeholder,
          helpText: field.helpText,
          required: field.required,
          conditionals: field.conditional ? [field.conditional as any] : [],
          order: index,
          page: field.page,
        })),
        settings: {
          allowAnonymous: true,
          requireEmail: false,
          multiPage: false,
          confirmationMessage: 'Thank you for your submission!',
          redirectUrl: undefined,
          sendAutoResponse: false,
          notifyOnSubmission: false,
          notificationEmails: [],
          enableWebhook: false,
          webhookUrl: undefined,
          webhookEvents: [],
          limitSubmissions: false,
          maxSubmissions: undefined,
          limitPerUser: false,
          maxPerUser: undefined,
          closeOnDate: false,
          closeDate: undefined,
          antiSpam: {
            enableHoneypot: true,
            enableRateLimit: true,
            rateLimitCount: 5,
            enableCaptcha: false,
            captchaType: 'hcaptcha',
            captchaSiteKey: undefined,
          },
          customCss: undefined,
          hideBranding: false,
        },
        created: Date.now(),
        createdBy: currentIdentity?.publicKey || '',
        updated: Date.now(),
      };
      addForm(newForm);
    }
    setViewMode('list');
  };

  const handlePublishToggle = (form: Form) => {
    updateForm(form.id, {
      status: form.status === 'published' ? 'draft' : 'published',
      updated: Date.now(),
    });
  };

  const handleDelete = (form: Form) => {
    setFormToDelete(form);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (formToDelete) {
      deleteForm(formToDelete.id);
      setFormToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleCopyLink = (form: Form) => {
    const url = `${window.location.origin}/forms/${form.id}`;
    navigator.clipboard.writeText(url);
  };

  const handleFormSubmit = async (formId: string, _data: Record<string, unknown>) => {
    const form = forms.find(f => f.id === formId);
    if (!form) return;

    const submission = {
      id: nanoid(),
      formId,
      tableId: form.tableId,
      groupId: form.groupId,
      recordId: nanoid(), // Would be created in Database module
      submittedBy: currentIdentity?.publicKey,
      submittedAt: Date.now(),
      flaggedAsSpam: false,
      processed: false,
    };

    addSubmission(submission);
  };

  // Builder/Preview/Submissions views
  if (viewMode === 'builder') {
    return (
      <FormBuilder
        form={selectedForm || undefined}
        onSave={handleSaveForm}
        onCancel={() => setViewMode('list')}
      />
    );
  }

  if (viewMode === 'preview' && selectedForm) {
    return (
      <div className="h-full p-4 overflow-y-auto"><div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button variant="outline" onClick={() => setViewMode('list')}>
            ← {t('forms.backToForms')}
          </Button>
        </div>
        <PublicFormView
          form={selectedForm}
          onSubmit={(data) => handleFormSubmit(selectedForm.id, data)}
        />
      </div></div>
    );
  }

  if (viewMode === 'submissions' && selectedForm) {
    const submissions = getSubmissionsByForm(selectedForm.id);

    const handleExportSubmissions = () => {
      if (submissions.length === 0) {
        toast.info(t('forms.noSubmissionsToExport', 'No submissions to export'));
        return;
      }

      const headers = [
        'ID',
        'Submitted At',
        'Name',
        'Email',
        'Submitted By',
        'Status',
        'Flagged as Spam',
        'Processed',
      ];

      const csvRows = submissions.map((sub) => [
        sub.id,
        format(sub.submittedAt, 'yyyy-MM-dd HH:mm:ss'),
        sub.submittedByName || '',
        sub.submittedByEmail || '',
        sub.submittedBy || '',
        sub.processed ? 'processed' : sub.flaggedAsSpam ? 'spam' : 'new',
        sub.flaggedAsSpam ? 'yes' : 'no',
        sub.processed ? 'yes' : 'no',
      ]);

      const escapeCsvField = (field: string): string => {
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      };

      const csv = [
        headers.map(escapeCsvField).join(','),
        ...csvRows.map((row) => row.map(escapeCsvField).join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedForm.title}-submissions-${format(Date.now(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(t('forms.exportSuccess', 'Submissions exported successfully'));
    };

    const handleViewSubmissionDetail = (submission: FormSubmission) => {
      setSelectedSubmission(submission);
      setSubmissionDetailOpen(true);
    };

    return (
      <div className="h-full p-4 space-y-6 overflow-y-auto">
        <div>
          <Button variant="outline" onClick={() => setViewMode('list')}>
            ← {t('forms.backToForms')}
          </Button>
        </div>
        <SubmissionsList
          submissions={submissions}
          onViewDetails={handleViewSubmissionDetail}
          onFlagSpam={flagSubmissionAsSpam}
          onMarkProcessed={markSubmissionProcessed}
          onExport={handleExportSubmissions}
        />

        {/* Submission Detail Dialog */}
        <Dialog open={submissionDetailOpen} onOpenChange={setSubmissionDetailOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('forms.submissionDetail', 'Submission Detail')}</DialogTitle>
              <DialogDescription>
                {selectedSubmission && format(selectedSubmission.submittedAt, 'MMM d, yyyy h:mm a')}
              </DialogDescription>
            </DialogHeader>
            {selectedSubmission && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">{t('forms.submissionId', 'Submission ID')}</Label>
                    <p className="text-sm font-mono">{selectedSubmission.id}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">{t('forms.formId', 'Form ID')}</Label>
                    <p className="text-sm font-mono">{selectedSubmission.formId}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">{t('forms.submittedBy', 'Submitted By')}</Label>
                    <p className="text-sm">{selectedSubmission.submittedByName || selectedSubmission.submittedBy || t('forms.anonymous', 'Anonymous')}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">{t('forms.email', 'Email')}</Label>
                    <p className="text-sm">{selectedSubmission.submittedByEmail || '-'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">{t('forms.status', 'Status')}</Label>
                    <div className="flex gap-1 mt-1">
                      {selectedSubmission.flaggedAsSpam && (
                        <Badge variant="destructive">{t('forms.spam', 'Spam')}</Badge>
                      )}
                      {selectedSubmission.processed && (
                        <Badge variant="secondary">{t('forms.processed', 'Processed')}</Badge>
                      )}
                      {!selectedSubmission.processed && !selectedSubmission.flaggedAsSpam && (
                        <Badge>{t('forms.new', 'New')}</Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">{t('forms.recordId', 'Database Record')}</Label>
                    <p className="text-sm font-mono">{selectedSubmission.recordId}</p>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <div className="flex gap-2 w-full">
                {selectedSubmission && !selectedSubmission.flaggedAsSpam && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      flagSubmissionAsSpam(selectedSubmission.id);
                      setSubmissionDetailOpen(false);
                    }}
                  >
                    {t('forms.flagAsSpam', 'Flag as Spam')}
                  </Button>
                )}
                {selectedSubmission && !selectedSubmission.processed && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      markSubmissionProcessed(selectedSubmission.id);
                      setSubmissionDetailOpen(false);
                    }}
                  >
                    {t('forms.markProcessed', 'Mark Processed')}
                  </Button>
                )}
                <div className="flex-1" />
                <Button variant="default" onClick={() => setSubmissionDetailOpen(false)}>
                  {t('common.close', 'Close')}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (viewMode === 'analytics' && selectedForm) {
    return (
      <div className="h-full p-4 overflow-y-auto"><div className="max-w-4xl mx-auto space-y-6">
        <div>
          <Button variant="outline" onClick={() => setViewMode('list')}>
            ← {t('forms.backToForms')}
          </Button>
        </div>
        <AnalyticsDashboard resourceType="form" resourceId={selectedForm.id} />
      </div></div>
    );
  }

  if (viewMode === 'templates') {
    return (
      <div className="h-full p-4 space-y-6 overflow-y-auto">
        <div>
          <Button variant="outline" onClick={() => setViewMode('list')}>
            ← {t('forms.backToForms')}
          </Button>
        </div>
        <TemplateGallery
          onSelectTemplate={(template) => {
            // Create form from template - extract fields from schema
            const schemaProperties = template.schema.properties || {};
            const fields = Object.entries(schemaProperties).map(([key, prop], index) => ({
              fieldId: key,
              label: (prop as any).title || key,
              placeholder: undefined,
              helpText: undefined,
              required: template.schema.required?.includes(key),
              conditionals: [],
              order: index,
            }));

            const newForm: Form = {
              id: nanoid(),
              groupId,
              tableId: selectedTableId,
              title: template.name,
              description: template.description,
              status: 'draft',
              schema: template.schema,
              uiSchema: template.uiSchema,
              fields,
              settings: {
                allowAnonymous: true,
                requireEmail: false,
                multiPage: false,
                confirmationMessage: 'Thank you for your submission!',
                sendAutoResponse: false,
                notifyOnSubmission: false,
                notificationEmails: [],
                enableWebhook: false,
                webhookEvents: [],
                limitSubmissions: false,
                limitPerUser: false,
                closeOnDate: false,
                antiSpam: {
                  enableHoneypot: true,
                  enableRateLimit: true,
                  rateLimitCount: 5,
                  enableCaptcha: false,
                  captchaType: 'hcaptcha',
                },
                hideBranding: false,
              },
              created: Date.now(),
              createdBy: currentIdentity?.publicKey || '',
              updated: Date.now(),
            };
            addForm(newForm);
            setViewMode('list');
          }}
          onCreateBlank={() => {
            handleCreateForm();
          }}
        />
      </div>
    );
  }

  // Forms List View
  return (
    <div className="h-full p-4 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('forms.title')}</h1>
          <p className="text-muted-foreground">
            {t('forms.description')}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {/* Database Table Selector */}
          {databaseTables.length > 0 && (
            <Select value={selectedTableId} onValueChange={setSelectedTableId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t('forms.selectTable', 'Select table')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default-table">{t('forms.defaultTable', 'Default Table')}</SelectItem>
                {databaseTables.map((table) => (
                  <SelectItem key={table.id} value={table.id}>
                    {table.icon} {table.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={() => setViewMode('templates')}>
            {t('forms.viewTemplates')}
          </Button>
          <Button onClick={handleCreateForm}>
            <Plus className="h-4 w-4 mr-2" />
            {t('forms.newForm')}
          </Button>
        </div>
      </div>

      {/* Forms Grid */}
      {forms.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <h3 className="text-lg font-semibold">{t('forms.noForms')}</h3>
            <p className="text-muted-foreground">
              {t('forms.noFormsDescription')}
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={handleCreateForm}>
                <Plus className="h-4 w-4 mr-2" />
                {t('forms.createForm')}
              </Button>
              <Button variant="outline" onClick={() => setViewMode('templates')}>
                {t('forms.browseTemplates')}
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => (
            <Card key={form.id} className="p-6 hover:border-primary transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">{form.title}</h3>
                  {form.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {form.description}
                    </p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEditForm(form)}>
                      <Edit className="h-4 w-4 mr-2" />
                      {t('forms.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handlePreviewForm(form)}>
                      <Eye className="h-4 w-4 mr-2" />
                      {t('forms.preview')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleViewSubmissions(form)}>
                      <BarChart className="h-4 w-4 mr-2" />
                      {t('forms.submissions')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleViewAnalytics(form)}>
                      <BarChart className="h-4 w-4 mr-2" />
                      {t('forms.analytics')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCopyLink(form)}>
                      <Copy className="h-4 w-4 mr-2" />
                      {t('forms.copyLink')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handlePublishToggle(form)}>
                      {form.status === 'published' ? t('forms.unpublish') : t('forms.publish')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(form)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('common.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant={form.status === 'published' ? 'default' : 'secondary'}>
                  {form.status}
                </Badge>
                <span>•</span>
                <span>{form.fields.length} {t('forms.fields')}</span>
              </div>

              <div className="mt-4 pt-4 border-t flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleEditForm(form)}>
                  <Edit className="h-3 w-3 mr-1" />
                  {t('forms.edit')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handlePreviewForm(form)}>
                  <Eye className="h-3 w-3 mr-1" />
                  {t('forms.preview')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('forms.deleteForm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('forms.deleteFormConfirm', { title: formToDelete?.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
