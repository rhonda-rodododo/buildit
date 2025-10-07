/**
 * Contact Activity Log Component
 * Displays timeline of all interactions with a contact
 */

import { FC, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Mail,
  Calendar,
  FileText,
  CheckCircle,
  Clock,
  Search,
  Plus,
  TrendingUp
} from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'message' | 'event_rsvp' | 'event_attended' | 'field_update' | 'note' | 'task_completed';
  timestamp: number;
  description: string;
  details?: string;
  actor?: string; // Who performed the action
  metadata?: Record<string, unknown>;
}

interface ContactActivityLogProps {
  contactId: string;
  contactName: string;
  className?: string;
}

// Demo activity data
const DEMO_ACTIVITIES: ActivityItem[] = [
  {
    id: 'activity-1',
    type: 'message',
    timestamp: Date.now() - 2 * 60 * 60 * 1000,
    description: 'Sent message about climate rally',
    details: 'Hi Sarah! Just wanted to remind you about this Saturday\'s climate rally. Hope to see you there!',
    actor: 'Marcus Johnson'
  },
  {
    id: 'activity-2',
    type: 'event_rsvp',
    timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000,
    description: 'RSVP\'d "Going" to Climate Justice Rally',
    actor: 'Sarah Chen'
  },
  {
    id: 'activity-3',
    type: 'field_update',
    timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000,
    description: 'Support level changed',
    details: 'Passive Support → Active Support',
    actor: 'Emma Rodriguez',
    metadata: { from: 'Passive Support', to: 'Active Support' }
  },
  {
    id: 'activity-4',
    type: 'note',
    timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000,
    description: 'Added note',
    details: 'Very engaged in climate issues. Interested in learning about organizing. Good candidate for leadership development.',
    actor: 'Marcus Johnson'
  },
  {
    id: 'activity-5',
    type: 'task_completed',
    timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000,
    description: 'Completed task: Initial outreach',
    details: 'Had great conversation about climate justice and direct action. Added to outreach list.',
    actor: 'Jordan Kim'
  },
  {
    id: 'activity-6',
    type: 'message',
    timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000,
    description: 'Received message',
    details: 'Hi! I saw your post about the climate organizing group. I\'d love to learn more and get involved.',
    actor: 'Sarah Chen'
  },
  {
    id: 'activity-7',
    type: 'event_attended',
    timestamp: Date.now() - 14 * 24 * 60 * 60 * 1000,
    description: 'Attended Community Organizing Workshop',
    actor: 'Sarah Chen'
  },
  {
    id: 'activity-8',
    type: 'message',
    timestamp: Date.now() - 15 * 24 * 60 * 60 * 1000,
    description: 'Sent welcome message',
    details: 'Welcome to BuildIt Network! We\'re excited to have you join our organizing efforts.',
    actor: 'Emma Rodriguez'
  }
];

export const ContactActivityLog: FC<ContactActivityLogProps> = ({
  contactName,
  className
}) => {
  const [activities] = useState<ActivityItem[]>(DEMO_ACTIVITIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddNote, setShowAddNote] = useState(false);

  const filteredActivities = activities.filter(activity => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      activity.description.toLowerCase().includes(searchLower) ||
      activity.details?.toLowerCase().includes(searchLower)
    );
  });

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'message': return <Mail className="w-4 h-4" />;
      case 'event_rsvp': return <Calendar className="w-4 h-4" />;
      case 'event_attended': return <CheckCircle className="w-4 h-4" />;
      case 'field_update': return <TrendingUp className="w-4 h-4" />;
      case 'note': return <FileText className="w-4 h-4" />;
      case 'task_completed': return <CheckCircle className="w-4 h-4" />;
    }
  };

  const getActivityColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'message': return 'bg-blue-500';
      case 'event_rsvp': return 'bg-green-500';
      case 'event_attended': return 'bg-green-600';
      case 'field_update': return 'bg-purple-500';
      case 'note': return 'bg-yellow-500';
      case 'task_completed': return 'bg-teal-500';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Activity Timeline</h3>
          <p className="text-sm text-muted-foreground">
            All interactions with {contactName}
          </p>
        </div>

        <Button size="sm" onClick={() => setShowAddNote(!showAddNote)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Note
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search activity..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Add Note Form */}
      {showAddNote && (
        <Card className="p-4 bg-yellow-500/5 border-yellow-500/20">
          <h4 className="text-sm font-semibold mb-2">Add Note</h4>
          <textarea
            className="w-full p-2 border rounded-md bg-background text-sm"
            rows={3}
            placeholder="Add a note about this contact..."
          />
          <div className="flex gap-2 mt-2">
            <Button size="sm">Save Note</Button>
            <Button size="sm" variant="outline" onClick={() => setShowAddNote(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-border" />

        {/* Activities */}
        <div className="space-y-6">
          {filteredActivities.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No activities found</p>
            </Card>
          ) : (
            filteredActivities.map((activity, _index) => (
              <div key={activity.id} className="relative pl-12">
                {/* Icon */}
                <div
                  className={`absolute left-0 w-10 h-10 rounded-full ${getActivityColor(activity.type)} flex items-center justify-center text-white`}
                >
                  {getActivityIcon(activity.type)}
                </div>

                {/* Content */}
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{activity.description}</h4>
                      {activity.details && (
                        <p className="text-sm text-muted-foreground mt-1 bg-muted/50 p-2 rounded">
                          {activity.details}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {activity.actor && (
                      <div className="flex items-center gap-1">
                        <Avatar className="w-4 h-4">
                          <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${activity.actor}`} />
                          <AvatarFallback>{activity.actor.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span>{activity.actor}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatDistanceToNow(activity.timestamp, { addSuffix: true })}</span>
                    </div>
                    <span className="text-muted-foreground/60">
                      {format(activity.timestamp, 'MMM d, h:mm a')}
                    </span>
                  </div>
                </Card>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Stats Summary */}
      <Card className="p-4 bg-muted/50">
        <h4 className="text-sm font-semibold mb-3">Activity Summary</h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">
              {activities.filter(a => a.type === 'message').length}
            </p>
            <p className="text-xs text-muted-foreground">Messages</p>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {activities.filter(a => a.type === 'event_rsvp' || a.type === 'event_attended').length}
            </p>
            <p className="text-xs text-muted-foreground">Events</p>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {activities.filter(a => a.type === 'note').length}
            </p>
            <p className="text-xs text-muted-foreground">Notes</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
