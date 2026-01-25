/**
 * Edit Event Page
 * Full-page version of the event editing form
 * Route: /app/groups/:groupId/events/:eventId/edit
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
import { ArrowLeft, Calendar, Loader2, Trash2 } from 'lucide-react';
import { CustomFieldsManager } from '@/modules/custom-fields/customFieldsManager';
import type { CustomField, CustomFieldValues } from '@/modules/custom-fields/types';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export const EditEventPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { groupId, eventId } = useParams<{ groupId: string; eventId: string }>();
  const { getEventById, updateEvent, deleteEvent } = useEvents();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  // Load event and custom fields
  useEffect(() => {
    const loadEvent = async () => {
      if (!eventId || !groupId) return;

      try {
        setLoading(true);
        const event = getEventById(eventId);
        if (event) {
          setFormData({
            title: event.title,
            description: event.description || '',
            location: event.location || '',
            startTime: new Date(event.startTime),
            endTime: event.endTime ? new Date(event.endTime) : undefined,
            privacy: event.privacy,
            capacity: event.capacity,
            groupId: event.groupId,
          });
          setCustomFieldValues(event.customFields || {});
        }

        const fields = await CustomFieldsManager.loadFields(groupId, 'event');
        setCustomFields(fields);
      } catch (error) {
        console.error('Failed to load event:', error);
        toast.error(t('editEventPage.errors.loadFailed', 'Failed to load event'));
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [eventId, groupId, getEventById, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) return;

    setSaving(true);

    try {
      await updateEvent(eventId, {
        ...formData,
        customFields: customFieldValues,
      });
      toast.success(t('editEventPage.success', 'Event updated successfully'));
      navigate(`/app/groups/${groupId}/events`);
    } catch (error) {
      console.error('Failed to update event:', error);
      toast.error(t('editEventPage.errors.updateFailed', 'Failed to update event'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!eventId) return;

    try {
      await deleteEvent(eventId);
      toast.success(t('editEventPage.deleted', 'Event deleted'));
      navigate(`/app/groups/${groupId}/events`);
    } catch (error) {
      console.error('Failed to delete event:', error);
      toast.error(t('editEventPage.errors.deleteFailed', 'Failed to delete event'));
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="container max-w-2xl py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8">
      {/* Back button */}
      <Button variant="ghost" onClick={handleCancel} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        {t('common.back', 'Back')}
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>{t('editEventPage.title', 'Edit Event')}</CardTitle>
                <CardDescription>
                  {t('editEventPage.description', 'Update the event details')}
                </CardDescription>
              </div>
            </div>

            {/* Delete button */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('common.delete', 'Delete')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t('editEventPage.deleteDialog.title', 'Delete Event?')}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t(
                      'editEventPage.deleteDialog.description',
                      'This action cannot be undone. The event and all RSVPs will be permanently deleted.'
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    {t('common.delete', 'Delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('createEventDialog.fields.descriptionLabel', 'Description')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">{t('createEventDialog.fields.locationLabel', 'Location')}</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
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
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('editEventPage.submit', 'Save Changes')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default EditEventPage;
