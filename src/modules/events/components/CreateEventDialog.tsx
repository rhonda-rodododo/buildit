import { FC, useState, useEffect } from 'react'
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
import type { CustomField, CustomFieldValues } from '@/modules/custom-fields/types'

interface CreateEventDialogProps {
  groupId?: string
  onEventCreated?: () => void
}

export const CreateEventDialog: FC<CreateEventDialogProps> = ({ groupId, onEventCreated }) => {
  const { createEvent } = useEvents()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [customFieldValues, setCustomFieldValues] = useState<CustomFieldValues>({})

  const [formData, setFormData] = useState<CreateEventFormData>({
    title: '',
    description: '',
    location: '',
    startTime: new Date(),
    privacy: 'public',
    groupId,
  })

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
      await createEvent({
        ...formData,
        customFields: customFieldValues,
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
      onEventCreated?.()
    } catch (error) {
      console.error('Failed to create event:', error)
      alert('Failed to create event')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Event
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Event</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Event Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              placeholder="Enter event title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Event description"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Event location"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date & Time *</Label>
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
            <Label htmlFor="endDate">End Date & Time (Optional)</Label>
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
            <Label htmlFor="privacy">Privacy Level</Label>
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
            <Label htmlFor="capacity">Capacity (Optional)</Label>
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
              placeholder="Max attendees"
            />
          </div>

          {formData.privacy === 'direct-action' && (
            <div className="space-y-2">
              <Label htmlFor="revealTime">Location Reveal Time</Label>
              <Input
                type="datetime-local"
                value={formData.locationRevealTime?.toISOString().slice(0, 16) || ''}
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Event'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
