/**
 * Template Gallery Component
 * Browse and select form templates
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Search, FileText, Users, Mail, MessageSquare, UserPlus, Plus } from 'lucide-react';
import { BUILT_IN_TEMPLATES, type FormTemplate } from './templates';

interface TemplateGalleryProps {
  onSelectTemplate: (template: FormTemplate) => void;
  onCreateBlank: () => void;
}

const CATEGORY_ICONS = {
  event: FileText,
  volunteer: Users,
  contact: Mail,
  survey: MessageSquare,
  membership: UserPlus,
};

export function TemplateGallery({ onSelectTemplate, onCreateBlank }: TemplateGalleryProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const filteredTemplates = BUILT_IN_TEMPLATES.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePreview = (template: FormTemplate) => {
    setSelectedTemplate(template);
    setPreviewOpen(true);
  };

  const handleSelectTemplate = () => {
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate);
      setPreviewOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">{t('templateGallery.title')}</h2>
        <p className="text-muted-foreground mt-1">
          {t('templateGallery.description')}
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('templateGallery.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Create Blank */}
      <Card
        className="p-6 cursor-pointer hover:border-primary transition-colors border-2 border-dashed"
        onClick={onCreateBlank}
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Plus className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">{t('templateGallery.startFromScratch')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('templateGallery.startFromScratchDescription')}
            </p>
          </div>
        </div>
      </Card>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((template) => {
          const Icon = CATEGORY_ICONS[template.category];
          return (
            <Card
              key={template.id}
              className="p-6 cursor-pointer hover:border-primary transition-colors"
              onClick={() => handlePreview(template)}
            >
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{template.name}</h3>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {template.category}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {template.description}
                </p>
                <div className="text-xs text-muted-foreground">
                  {t('templateGallery.fields', { count: Object.keys(template.schema.properties || {}).length })}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              {selectedTemplate?.description}
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">{t('templateGallery.preview.includedFields')}</h4>
                <div className="space-y-1">
                  {Object.entries(selectedTemplate.schema.properties || {}).map(([key, prop]) => {
                    const property = prop as { title?: string; type?: string };
                    const isRequired = selectedTemplate.schema.required?.includes(key);
                    return (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{property.title || key}</span>
                        <span className="text-muted-foreground">({property.type})</span>
                        {isRequired && (
                          <Badge variant="destructive" className="text-xs">{t('templateGallery.preview.required')}</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedTemplate.schema.required && selectedTemplate.schema.required.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  {t('templateGallery.preview.requiredFields', { count: selectedTemplate.schema.required.length })}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              {t('templateGallery.preview.cancel')}
            </Button>
            <Button onClick={handleSelectTemplate}>
              {t('templateGallery.preview.useTemplate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
