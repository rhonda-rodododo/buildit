import { FC, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useEvents } from '../hooks/useEvents'
import { EventPrivacy, CreateEventFormData } from '../types'
import { Plus } from 'lucide-react'
import { CustomFieldsManager } from '@/modules/custom-fields/customFieldsManager'
import type { CustomField, CustomFieldValues, LocationValue } from '@/modules/custom-fields/types'
import { LocationInput } from '@/modules/custom-fields/components/inputs/LocationInput'

interface CreateEventDialogProps {
  groupId?: string
  onEventCreated?: () => void
}

export const CreateEventDialog: FC<CreateEventDialogProps> = ({ groupId, onEventCreated }) => {
  const { t } = useTranslation()
  const { createEvent } = useEvents()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [customFieldValues, setCustomFieldValues] = useState<CustomFieldValues>({})
  const [locationValue, setLocationValue] = useState<LocationValue | undefined>(undefined)

  const [formData, setFormData] = useState<CreateEventFormData>({
    title: '',
    description: '',
    location: '',
    startTime: new Date(),
    privacy: 'public',
    groupId,
  })

  // When location changes, update both the LocationValue and the form's text location field
  const handleLocationChange = useCallback((value: unknown) => {
    const loc = value as LocationValue
    setLocationValue(loc)
    if (loc) {
      setFormData((prev) => ({ ...prev, location: loc.label }))
    }
  }, [])

  // Load custom fields for events in this group
  useEffect(() => {
    if (groupId && open) {
      CustomFieldsManager.loadFields(groupId, 'event').then(setCustomFields)
    }
  }, [groupId, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Include location data in custom fields if set
      const allCustomFields = { ...customFieldValues };
      if (locationValue) {
        allCustomFields._location = locationValue;
      }

      await createEvent({
        ...formData,
        customFields: allCustomFields,
      })
      setOpen(false)
      setFormData({
        title: '',
        description: '',
        location: '',
        startTime: new Date(),
        privacy: 'public',
        groupId,
      })
      setCustomFieldValues({})
      setLocationValue(undefined)
      onEventCreated?.()
    } catch (error) {
      console.error('Failed to create event:', error)
      alert(t('createEventDialog.errors.createFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {t('createEventDialog.triggerButton')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('createEventDialog.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t('createEventDialog.fields.titleLabel')}</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              placeholder={t('createEventDialog.fields.titlePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('createEventDialog.fields.descriptionLabel')}</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('createEventDialog.fields.descriptionPlaceholder')}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <LocationInput
              field={{
                id: 'event-location',
                groupId: groupId || '',
                entityType: 'event',
                name: 'location',
                label: t('createEventDialog.fields.locationLabel'),
                schema: { type: 'object' },
                widget: {
                  widget: 'location',
                  placeholder: t('createEventDialog.fields.locationPlaceholder'),
                  defaultPrecision: 'neighborhood',
                  allowExactLocation: true,
                  showMapPreview: true,
                },
                order: 0,
                created: 0,
                createdBy: '',
                updated: 0,
              }}
              register={() => ({} as any)}
              value={locationValue}
              onChange={handleLocationChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="startDate">{t('createEventDialog.fields.startDateLabel')}</Label>
            <div className="flex gap-2">
              <Input
                type="datetime-local"
                value={formData.startTime.toISOString().slice(0, 16)}
                onChange={(e) =>
                  setFormData({ ...formData, startTime: new Date(e.target.value) })
                }
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">{t('createEventDialog.fields.endDateLabel')}</Label>
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

          <div className="space-y-2">
            <Label htmlFor="privacy">{t('createEventDialog.fields.privacyLabel')}</Label>
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
                <SelectItem value="public">{t('createEventDialog.privacy.public')}</SelectItem>
                <SelectItem value="group">{t('createEventDialog.privacy.group')}</SelectItem>
                <SelectItem value="private">{t('createEventDialog.privacy.private')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="capacity">{t('createEventDialog.fields.capacityLabel')}</Label>
            <Input
              id="capacity"
              type="number"
              min="1"
              value={formData.capacity || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  capacity: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              placeholder={t('createEventDialog.fields.capacityPlaceholder')}
            />
          </div>

          {customFields.length > 0 && (
            <>
              <Separator className="my-6" />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('createEventDialog.customFields.title')}</h3>
                {customFields.sort((a, b) => a.order - b.order).map((field) => (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={field.name}>
                      {field.label}
                      {field.schema.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {field.widget.widget === 'text' && (
                      <Input
                        id={field.name}
                        value={(customFieldValues[field.name] as string) || ''}
                        onChange={(e) => setCustomFieldValues({ ...customFieldValues, [field.name]: e.target.value })}
                        placeholder={field.widget.placeholder}
                      />
                    )}
                    {field.widget.widget === 'textarea' && (
                      <Textarea
                        id={field.name}
                        value={(customFieldValues[field.name] as string) || ''}
                        onChange={(e) => setCustomFieldValues({ ...customFieldValues, [field.name]: e.target.value })}
                        placeholder={field.widget.placeholder}
                      />
                    )}
                    {field.widget.widget === 'select' && field.widget.options && (
                      <Select
                        value={(customFieldValues[field.name] as string) || ''}
                        onValueChange={(value) => setCustomFieldValues({ ...customFieldValues, [field.name]: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={field.widget.placeholder || t('createEventDialog.customFields.selectPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.widget.options.map((option) => (
                            <SelectItem key={String(option.value)} value={String(option.value)}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {field.widget.helpText && (
                      <p className="text-sm text-muted-foreground">{field.widget.helpText}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('createEventDialog.buttons.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('createEventDialog.buttons.creating') : t('createEventDialog.buttons.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
