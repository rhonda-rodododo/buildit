import { FC, useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useEvents } from '../hooks/useEvents'
import { Event, EventPrivacy, CreateEventFormData } from '../types'
import { CustomFieldsManager } from '@/modules/custom-fields/customFieldsManager'
import type { CustomField, CustomFieldValues } from '@/modules/custom-fields/types'

interface EditEventDialogProps {
  event: Event
  open: boolean
  onOpenChange: (open: boolean) => void
  onEventUpdated?: () => void
}

export const EditEventDialog: FC<EditEventDialogProps> = ({
  event,
  open,
  onOpenChange,
  onEventUpdated,
}) => {
  const { updateEvent } = useEvents()
  const [loading, setLoading] = useState(false)
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [customFieldValues, setCustomFieldValues] = useState<CustomFieldValues>({})

  const [formData, setFormData] = useState<CreateEventFormData>({
    title: '',
    description: '',
    location: '',
    startTime: new Date(),
    privacy: 'public',
    groupId: undefined,
  })

  // Initialize form data when event changes or dialog opens
  useEffect(() => {
    if (event && open) {
      setFormData({
        title: event.title,
        description: event.description || '',
        location: event.location || '',
        startTime: new Date(event.startTime),
        endTime: event.endTime ? new Date(event.endTime) : undefined,
        privacy: event.privacy,
        capacity: event.capacity,
        tags: event.tags,
        imageUrl: event.imageUrl,
        locationRevealTime: event.locationRevealTime
          ? new Date(event.locationRevealTime)
          : undefined,
        groupId: event.groupId,
      })
      setCustomFieldValues(event.customFields || {})
    }
  }, [event, open])

  // Load custom fields for events in this group
  useEffect(() => {
    if (event.groupId && open) {
      CustomFieldsManager.loadFields(event.groupId, 'event').then(setCustomFields)
    }
  }, [event.groupId, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await updateEvent(event.id, {
        ...formData,
        customFields: customFieldValues,
      })
      onOpenChange(false)
      onEventUpdated?.()
    } catch (error) {
      console.error('Failed to update event:', error)
      alert('Failed to update event')
    } finally {
      setLoading(false)
    }
  }

  // Format date for datetime-local input (local timezone)
  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Event Title *</Label>
            <Input
              id="edit-title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              placeholder="Enter event title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Event description"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-location">Location</Label>
            <Input
              id="edit-location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Event location"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-startDate">Start Date & Time *</Label>
            <div className="flex gap-2">
              <Input
                type="datetime-local"
                value={formatDateForInput(formData.startTime)}
                onChange={(e) =>
                  setFormData({ ...formData, startTime: new Date(e.target.value) })
                }
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-endDate">End Date & Time (Optional)</Label>
            <Input
              type="datetime-local"
              value={formData.endTime ? formatDateForInput(formData.endTime) : ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  endTime: e.target.value ? new Date(e.target.value) : undefined,
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-privacy">Privacy Level</Label>
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
                <SelectItem value="public">Public - Anyone can see</SelectItem>
                <SelectItem value="group">Group - Only group members</SelectItem>
                <SelectItem value="private">Private - Invite only</SelectItem>
                <SelectItem value="direct-action">
                  Direct Action - Time-delayed location reveal
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-capacity">Capacity (Optional)</Label>
            <Input
              id="edit-capacity"
              type="number"
              min="1"
              value={formData.capacity || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  capacity: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              placeholder="Max attendees"
            />
          </div>

          {formData.privacy === 'direct-action' && (
            <div className="space-y-2">
              <Label htmlFor="edit-revealTime">Location Reveal Time</Label>
              <Input
                type="datetime-local"
                value={formData.locationRevealTime ? formatDateForInput(formData.locationRevealTime) : ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    locationRevealTime: e.target.value ? new Date(e.target.value) : undefined,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Location will be revealed at this time
              </p>
            </div>
          )}

          {customFields.length > 0 && (
            <>
              <Separator className="my-6" />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Additional Information</h3>
                {customFields.sort((a, b) => a.order - b.order).map((field) => (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={`edit-${field.name}`}>
                      {field.label}
                      {field.schema.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {field.widget.widget === 'text' && (
                      <Input
                        id={`edit-${field.name}`}
                        value={(customFieldValues[field.name] as string) || ''}
                        onChange={(e) => setCustomFieldValues({ ...customFieldValues, [field.name]: e.target.value })}
                        placeholder={field.widget.placeholder}
                      />
                    )}
                    {field.widget.widget === 'textarea' && (
                      <Textarea
                        id={`edit-${field.name}`}
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
                          <SelectValue placeholder={field.widget.placeholder || 'Select an option'} />
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
