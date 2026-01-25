/**
 * Create Event Page
 * Full-page version of the event creation form
 * Route: /app/groups/:groupId/events/new
 */

import { FC, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEvents } from '../hooks/useEvents';
import { EventPrivacy, CreateEventFormData } from '../types';
import { ArrowLeft, Calendar, Loader2 } from 'lucide-react';
import { CustomFieldsManager } from '@/modules/custom-fields/customFieldsManager';
import type { CustomField, CustomFieldValues } from '@/modules/custom-fields/types';
import { toast } from 'sonner';

export const CreateEventPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();
  const { createEvent } = useEvents();

  const [loading, setLoading] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<CustomFieldValues>({});

  const [formData, setFormData] = useState<CreateEventFormData>({
    title: '',
    description: '',
    location: '',
    startTime: new Date(),
    privacy: 'public',
    groupId,
  });

  // Load custom fields for events in this group
  useEffect(() => {
    if (groupId) {
      CustomFieldsManager.loadFields(groupId, 'event').then(setCustomFields);
    }
  }, [groupId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await createEvent({
        ...formData,
        customFields: customFieldValues,
      });
      toast.success(t('createEventPage.success', 'Event created successfully'));
      navigate(`/app/groups/${groupId}/events`);
    } catch (error) {
      console.error('Failed to create event:', error);
      toast.error(t('createEventPage.errors.createFailed', 'Failed to create event'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  return (
    <div className="container max-w-2xl py-8">
      {/* Back button */}
      <Button variant="ghost" onClick={handleCancel} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        {t('common.back', 'Back')}
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>{t('createEventPage.title', 'Create Event')}</CardTitle>
              <CardDescription>
                {t('createEventPage.description', 'Fill in the details to create a new event')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">{t('createEventDialog.fields.titleLabel', 'Title')}</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder={t('createEventDialog.fields.titlePlaceholder', 'Event title')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('createEventDialog.fields.descriptionLabel', 'Description')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('createEventDialog.fields.descriptionPlaceholder', 'Describe your event')}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">{t('createEventDialog.fields.locationLabel', 'Location')}</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder={t('createEventDialog.fields.locationPlaceholder', 'Event location')}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">{t('createEventDialog.fields.startDateLabel', 'Start Date')}</Label>
                <Input
                  type="datetime-local"
                  value={formData.startTime.toISOString().slice(0, 16)}
                  onChange={(e) =>
                    setFormData({ ...formData, startTime: new Date(e.target.value) })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">{t('createEventDialog.fields.endDateLabel', 'End Date')}</Label>
                <Input
                  type="datetime-local"
                  value={formData.endTime?.toISOString().slice(0, 16) || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      endTime: e.target.value ? new Date(e.target.value) : undefined,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="privacy">{t('createEventDialog.fields.privacyLabel', 'Privacy')}</Label>
              <Select
                value={formData.privacy}
                onValueChange={(value: EventPrivacy) =>
                  setFormData({ ...formData, privacy: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    {t('createEventDialog.privacy.public', 'Public')}
                  </SelectItem>
                  <SelectItem value="group">
                    {t('createEventDialog.privacy.group', 'Group Only')}
                  </SelectItem>
                  <SelectItem value="private">
                    {t('createEventDialog.privacy.private', 'Private')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacity">{t('createEventDialog.fields.capacityLabel', 'Capacity')}</Label>
              <Input
                id="capacity"
                type="number"
                min="1"
                value={formData.capacity || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    capacity: e.target.value ? parseInt(e.target.value, 10) : undefined,
                  })
                }
                placeholder={t('createEventDialog.fields.capacityPlaceholder', 'Maximum attendees')}
              />
            </div>

            {/* Custom Fields */}
            {customFields.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">
                    {t('createEventDialog.customFields.title', 'Additional Fields')}
                  </h3>
                  {customFields.map((field) => (
                    <div key={field.id} className="space-y-2">
                      <Label htmlFor={`custom-${field.id}`}>
                        {field.label}
                        {field.schema.required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                      <Input
                        id={`custom-${field.id}`}
                        value={(customFieldValues[field.id] as string) || ''}
                        onChange={(e) =>
                          setCustomFieldValues({
                            ...customFieldValues,
                            [field.id]: e.target.value,
                          })
                        }
                        required={field.schema.required}
                        placeholder={field.widget.placeholder}
                      />
                      {field.schema.description && (
                        <p className="text-xs text-muted-foreground">{field.schema.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            <Separator />

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={handleCancel}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('createEventPage.submit', 'Create Event')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateEventPage;
