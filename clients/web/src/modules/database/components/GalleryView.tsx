/**
 * Database Gallery View Component
 * Grid view for image-based records
 */

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DatabaseRecord, DatabaseTable, DatabaseView } from '../types';

interface GalleryViewProps {
  table: DatabaseTable;
  view: DatabaseView;
  records: DatabaseRecord[];
  onRecordClick?: (record: DatabaseRecord) => void;
}

export function GalleryView({ table, view, records, onRecordClick }: GalleryViewProps) {
  const { t } = useTranslation('database');
  // Get config from view
  const imageField = view.config.galleryImageField || table.fields.find((f) => f.widget.widget === 'file')?.name;
  const titleField = view.config.galleryTitleField || table.fields[0]?.name;
  const descriptionField = view.config.galleryDescriptionField || table.fields[1]?.name;
  const columns = view.config.galleryColumns || 4;

  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {records.map((record) => {
        const imageUrl = record.customFields[imageField || ''] as string | undefined;
        const title = String(record.customFields[titleField || ''] || 'Untitled');
        const description = String(record.customFields[descriptionField || ''] || '');

        return (
          <Card
            key={record.id}
            className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
            onClick={() => onRecordClick?.(record)}
          >
            {imageUrl && (
              <div className="aspect-video bg-muted overflow-hidden">
                <img
                  src={imageUrl}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            {!imageUrl && (
              <div className="aspect-video bg-muted flex items-center justify-center">
                <div className="text-muted-foreground text-sm">{t('noImage')}</div>
              </div>
            )}
            <CardHeader className="pb-3">
              <CardTitle className="text-sm line-clamp-2">{title}</CardTitle>
            </CardHeader>
            {description && (
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground line-clamp-3">{description}</p>
              </CardContent>
            )}
          </Card>
        );
      })}

      {records.length === 0 && (
        <div className="col-span-full text-center text-muted-foreground py-12">
          {t('noRecordsFound')}
        </div>
      )}
    </div>
  );
}
