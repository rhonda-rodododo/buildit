/**
 * Smart Notifications Component
 * Context-aware notifications based on user activity and engagement level
 */

import { FC, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  Calendar,
  Users,
  MessageSquare,
  Target,
  TrendingUp,
  Megaphone,
  AlertCircle,
  X,
  Check,
  Clock
} from 'lucide-react';

interface Notification {
  id: string;
  type: 'action-alert' | 'event-reminder' | 'engagement-milestone' | 'group-activity' | 'direct-message' | 'security-alert';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actionable: boolean;
  actionText?: string;
  actionUrl?: string;
  context?: {
    engagementLevel?: string;
    userActivity?: string;
    relevanceScore?: number;
  };
}

interface SmartNotificationsProps {
  currentEngagementLevel: 'Neutral' | 'Passive Support' | 'Active Support' | 'Core Organizer';
  className?: string;
}

// Context-aware notifications based on engagement level
const DEMO_NOTIFICATIONS: Record<string, Notification[]> = {
  'Neutral': [
    {
      id: 'notif-1',
      type: 'event-reminder',
      priority: 'medium',
      title: 'Beginner-Friendly Workshop Tomorrow',
      message: 'Join our "Introduction to Organizing" workshop. Perfect for newcomers!',
      timestamp: Date.now() - 2 * 60 * 60 * 1000,
      read: false,
      actionable: true,
      actionText: 'RSVP Now',
      context: {
        engagementLevel: 'Neutral',
        userActivity: 'Browsing events',
        relevanceScore: 0.9
      }
    },
    {
      id: 'notif-2',
      type: 'group-activity',
      priority: 'low',
      title: 'New Resources in Climate Wiki',
      message: 'Check out beginner guides on climate organizing',
      timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000,
      read: false,
      actionable: true,
      actionText: 'Read Now',
      context: {
        engagementLevel: 'Neutral',
        userActivity: 'Interested in climate',
        relevanceScore: 0.7
      }
    }
  ],
  'Passive Support': [
    {
      id: 'notif-3',
      type: 'action-alert',
      priority: 'high',
      title: 'Rally This Weekend - Your First Action?',
      message: 'Climate Justice Rally on Saturday. Great opportunity to take your first direct action!',
      timestamp: Date.now() - 1 * 60 * 60 * 1000,
      read: false,
      actionable: true,
      actionText: 'Learn More',
      context: {
        engagementLevel: 'Passive Support',
        userActivity: 'Attended 2 events',
        relevanceScore: 0.95
      }
    },
    {
      id: 'notif-4',
      type: 'engagement-milestone',
      priority: 'medium',
      title: 'You\'re Making Progress! 🎉',
      message: 'Attend one more event to unlock Active Support level and new opportunities',
      timestamp: Date.now() - 3 * 60 * 60 * 1000,
      read: false,
      actionable: true,
      actionText: 'See Next Steps',
      context: {
        engagementLevel: 'Passive Support',
        userActivity: 'Progress tracked',
        relevanceScore: 0.85
      }
    },
    {
      id: 'notif-5',
      type: 'group-activity',
      priority: 'low',
      title: 'Your Working Group is Planning',
      message: 'Climate Justice Action is organizing next month\'s campaign',
      timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000,
      read: true,
      actionable: false
    }
  ],
  'Active Support': [
    {
      id: 'notif-6',
      type: 'action-alert',
      priority: 'urgent',
      title: '🚨 Urgent: City Council Vote Tomorrow',
      message: 'We need everyone at City Hall by 9 AM. This vote determines our campaign success.',
      timestamp: Date.now() - 30 * 60 * 1000,
      read: false,
      actionable: true,
      actionText: 'Confirm Attendance',
      context: {
        engagementLevel: 'Active Support',
        userActivity: 'Active in campaigns',
        relevanceScore: 1.0
      }
    },
    {
      id: 'notif-7',
      type: 'group-activity',
      priority: 'medium',
      title: 'Volunteer Role Available',
      message: 'We need a communications coordinator for the housing campaign. Interested?',
      timestamp: Date.now() - 4 * 60 * 60 * 1000,
      read: false,
      actionable: true,
      actionText: 'Apply',
      context: {
        engagementLevel: 'Active Support',
        userActivity: 'Regular participant',
        relevanceScore: 0.8
      }
    },
    {
      id: 'notif-8',
      type: 'direct-message',
      priority: 'medium',
      title: 'Message from Marcus Johnson',
      message: 'Thanks for helping with outreach yesterday! Can you lead next week?',
      timestamp: Date.now() - 6 * 60 * 60 * 1000,
      read: false,
      actionable: true,
      actionText: 'Reply'
    }
  ],
  'Core Organizer': [
    {
      id: 'notif-9',
      type: 'security-alert',
      priority: 'urgent',
      title: '🔒 Security Alert: Unusual Activity',
      message: 'Multiple failed login attempts on your account. Review recent activity.',
      timestamp: Date.now() - 15 * 60 * 1000,
      read: false,
      actionable: true,
      actionText: 'Review Now',
      context: {
        engagementLevel: 'Core Organizer',
        userActivity: 'Account security',
        relevanceScore: 1.0
      }
    },
    {
      id: 'notif-10',
      type: 'action-alert',
      priority: 'high',
      title: 'Campaign Strategy Meeting Tonight',
      message: 'Core organizers meeting at 7 PM to finalize our demands for City Council',
      timestamp: Date.now() - 2 * 60 * 60 * 1000,
      read: false,
      actionable: true,
      actionText: 'Add to Calendar',
      context: {
        engagementLevel: 'Core Organizer',
        userActivity: 'Leadership',
        relevanceScore: 0.95
      }
    },
    {
      id: 'notif-11',
      type: 'group-activity',
      priority: 'medium',
      title: 'New Member Needs Mentorship',
      message: 'Sarah Chen has been paired with you as their mentor. Reach out to introduce yourself!',
      timestamp: Date.now() - 5 * 60 * 60 * 1000,
      read: false,
      actionable: true,
      actionText: 'Send Message',
      context: {
        engagementLevel: 'Core Organizer',
        userActivity: 'Mentorship',
        relevanceScore: 0.85
      }
    },
    {
      id: 'notif-12',
      type: 'engagement-milestone',
      priority: 'low',
      title: 'Leadership Impact Report',
      message: 'You\'ve helped develop 3 new organizers this month! 🌟',
      timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000,
      read: true,
      actionable: false
    }
  ]
};

export const SmartNotifications: FC<SmartNotificationsProps> = ({
  currentEngagementLevel,
  className
}) => {
  const [notifications, setNotifications] = useState<Notification[]>(
    DEMO_NOTIFICATIONS[currentEngagementLevel] || []
  );
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');

  const filteredNotifications = notifications.filter(n =>
    filter === 'all' ? true : !n.read
  );

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleDismiss = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'action-alert': return <Megaphone className="w-5 h-5" />;
      case 'event-reminder': return <Calendar className="w-5 h-5" />;
      case 'engagement-milestone': return <TrendingUp className="w-5 h-5" />;
      case 'group-activity': return <Users className="w-5 h-5" />;
      case 'direct-message': return <MessageSquare className="w-5 h-5" />;
      case 'security-alert': return <AlertCircle className="w-5 h-5" />;
    }
  };

  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-blue-500';
      case 'low': return 'bg-gray-500';
    }
  };

  const getPriorityBadge = (priority: Notification['priority']) => {
    if (priority === 'urgent' || priority === 'high') {
      return (
        <Badge variant="outline" className={`${getPriorityColor(priority)} text-white border-0 text-xs`}>
          {priority.toUpperCase()}
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6" />
          <div>
            <h3 className="font-semibold">Smart Notifications</h3>
            <p className="text-xs text-muted-foreground">
              Personalized for {currentEngagementLevel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={filter === 'unread' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('unread')}
          >
            Unread ({unreadCount})
          </Button>
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="text-xs"
            >
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-2">
        {filteredNotifications.length === 0 ? (
          <Card className="p-8 text-center">
            <Bell className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              {filter === 'unread' ? 'All caught up! No unread notifications.' : 'No notifications yet'}
            </p>
          </Card>
        ) : (
          filteredNotifications.map((notification) => {
            const Icon = getNotificationIcon(notification.type);
            return (
              <Card
                key={notification.id}
                className={`p-4 ${!notification.read ? 'bg-primary/5 border-primary/20' : 'opacity-75'}`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`p-2 rounded-lg ${getPriorityColor(notification.priority)} text-white shrink-0`}>
                    {Icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-medium text-sm">{notification.title}</h4>
                      {getPriorityBadge(notification.priority)}
                    </div>

                    <p className="text-sm text-muted-foreground mb-2">
                      {notification.message}
                    </p>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatDistanceToNow(notification.timestamp, { addSuffix: true })}</span>
                      </div>

                      {notification.context?.relevanceScore && (
                        <Badge variant="outline" className="text-xs">
                          {Math.round(notification.context.relevanceScore * 100)}% relevant
                        </Badge>
                      )}
                    </div>

                    {/* Actions */}
                    {(notification.actionable || !notification.read) && (
                      <div className="flex items-center gap-2 mt-3">
                        {notification.actionable && notification.actionText && (
                          <Button size="sm" variant="outline" className="h-7 text-xs">
                            {notification.actionText}
                          </Button>
                        )}
                        {!notification.read && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="h-7 text-xs gap-1"
                          >
                            <Check className="w-3 h-3" />
                            Mark read
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDismiss(notification.id)}
                          className="h-7 text-xs gap-1 ml-auto"
                        >
                          <X className="w-3 h-3" />
                          Dismiss
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Info */}
      <Card className="p-3 bg-blue-500/5 border-blue-500/20">
        <h4 className="text-xs font-medium mb-1">Smart Notification Features</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Notifications personalized based on your engagement level</li>
          <li>• Priority filtering puts urgent items first</li>
          <li>• Relevance scoring shows why you're seeing each notification</li>
          <li>• Context-aware: what you see changes as you grow as an organizer</li>
        </ul>
      </Card>
    </div>
  );
};
