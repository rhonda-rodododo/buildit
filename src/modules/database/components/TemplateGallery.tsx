/**
 * Template Gallery Component
 * Browse and select database templates
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatabaseTemplateStore } from '../databaseTemplateStore';
import { DatabaseTemplate } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Edit, Trash2, Eye, Check } from 'lucide-react';
import { TemplateBuilder } from './TemplateBuilder';

interface TemplateGalleryProps {
  onSelectTemplate: (template: DatabaseTemplate) => void;
  onCreateFromScratch?: () => void;
}

export function TemplateGallery({ onSelectTemplate, onCreateFromScratch }: TemplateGalleryProps) {
  const { t } = useTranslation();
  const {
    templates,
    isLoading,
    loadTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  } = useDatabaseTemplateStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [previewTemplate, setPreviewTemplate] = useState<DatabaseTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<DatabaseTemplate | null>(null);
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Filter templates
  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      searchQuery === '' ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'all' || template.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const categories = [
    { value: 'all', label: t('templateGallery.categories.all'), count: templates.length },
    { value: 'general', label: t('templateGallery.categories.general'), count: templates.filter((tpl) => tpl.category === 'general').length },
    { value: 'crm', label: t('templateGallery.categories.crm'), count: templates.filter((tpl) => tpl.category === 'crm').length },
    { value: 'project', label: t('templateGallery.categories.project'), count: templates.filter((tpl) => tpl.category === 'project').length },
    { value: 'inventory', label: t('templateGallery.categories.inventory'), count: templates.filter((tpl) => tpl.category === 'inventory').length },
    { value: 'custom', label: t('templateGallery.categories.custom'), count: templates.filter((tpl) => tpl.category === 'custom').length },
  ];

  const handleCreateCustomTemplate = () => {
    setEditingTemplate(null);
    setShowTemplateBuilder(true);
  };

  const handleEditTemplate = (template: DatabaseTemplate) => {
    setEditingTemplate(template);
    setShowTemplateBuilder(true);
  };

  const handleSaveTemplate = async (template: DatabaseTemplate) => {
    try {
      if (editingTemplate) {
        await updateTemplate(template.id, template);
      } else {
        await createTemplate(template);
      }
      setShowTemplateBuilder(false);
      setEditingTemplate(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : t('templateGallery.errors.saveFailed'));
    }
  };

  const handleDeleteTemplate = async (template: DatabaseTemplate) => {
    if (!confirm(t('templateGallery.confirmDelete', { name: template.name }))) return;

    try {
      await deleteTemplate(template.id);
    } catch (error) {
      alert(error instanceof Error ? error.message : t('templateGallery.errors.deleteFailed'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{t('templateGallery.title')}</h2>
            <p className="text-muted-foreground">
              {t('templateGallery.description')}
            </p>
          </div>
          <div className="flex gap-2">
            {onCreateFromScratch && (
              <Button variant="outline" onClick={onCreateFromScratch}>
                {t('templateGallery.startFromScratch')}
              </Button>
            )}
            <Button onClick={handleCreateCustomTemplate}>
              <Plus className="h-4 w-4 mr-2" />
              {t('templateGallery.createTemplate')}
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('templateGallery.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Categories */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList>
          {categories.map((cat) => (
            <TabsTrigger key={cat.value} value={cat.value}>
              {cat.label} ({cat.count})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Template Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">{t('templateGallery.loading')}</div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {t('templateGallery.noTemplates')} {searchQuery && t('templateGallery.tryDifferentSearch')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription className="mt-1">{template.description}</CardDescription>
                  </div>
                  {template.isBuiltIn && (
                    <Badge variant="secondary" className="ml-2">
                      {t('templateGallery.builtIn')}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('templateGallery.details.tables')}</span>
                    <span className="font-medium">{template.tables.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('templateGallery.details.relationships')}</span>
                    <span className="font-medium">{template.relationships.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('templateGallery.details.category')}</span>
                    <Badge variant="outline">{template.category}</Badge>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={() => onSelectTemplate(template)}
                >
                  <Check className="h-4 w-4 mr-2" />
                  {t('templateGallery.actions.useTemplate')}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPreviewTemplate(template)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {!template.isBuiltIn && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEditTemplate(template)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDeleteTemplate(template)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      {previewTemplate && (
        <Dialog open onOpenChange={() => setPreviewTemplate(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{previewTemplate.name}</DialogTitle>
              <DialogDescription>{previewTemplate.description}</DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Tables */}
              <div>
                <h3 className="font-semibold mb-3">{t('templateGallery.preview.tables', { count: previewTemplate.tables.length })}</h3>
                <div className="space-y-3">
                  {previewTemplate.tables.map((table, index) => (
                    <Card key={index}>
                      <CardHeader>
                        <CardTitle className="text-base">{table.name}</CardTitle>
                        {table.description && (
                          <CardDescription>{table.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{t('templateGallery.preview.fields')}</p>
                          <div className="flex flex-wrap gap-1">
                            {table.fields.map((field) => (
                              <Badge key={field.name} variant="outline">
                                {field.label} ({field.widget.widget})
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Relationships */}
              {previewTemplate.relationships.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">
                    {t('templateGallery.preview.relationships', { count: previewTemplate.relationships.length })}
                  </h3>
                  <div className="space-y-2">
                    {previewTemplate.relationships.map((rel, index) => (
                      <Card key={index}>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium">{rel.sourceTableName}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-medium">{rel.targetTableName}</span>
                            <Badge variant="secondary">{rel.type}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewTemplate(null)}>
                {t('templateGallery.actions.close')}
              </Button>
              <Button onClick={() => {
                onSelectTemplate(previewTemplate);
                setPreviewTemplate(null);
              }}>
                {t('templateGallery.actions.useThisTemplate')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Template Builder Dialog */}
      {showTemplateBuilder && (
        <Dialog open onOpenChange={setShowTemplateBuilder}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <TemplateBuilder
              template={editingTemplate || undefined}
              onSave={handleSaveTemplate}
              onCancel={() => {
                setShowTemplateBuilder(false);
                setEditingTemplate(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
