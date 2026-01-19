/**
 * Contact Detail Page
 * Comprehensive view of a contact with activity log and conversation history
 */

import { FC, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PageMeta } from '@/components/PageMeta';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContactActivityLog } from '@/components/activity-log/ContactActivityLog';
import { ConversationHistory } from '@/components/activity-log/ConversationHistory';
import {
  Mail,
  Phone,
  MapPin,
  Tag,
  Edit,
  UserPlus,
  MessageSquare,
  Clock,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';

interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  avatar?: string;
  supportLevel: 'Neutral' | 'Passive Support' | 'Active Support' | 'Core Organizer';
  tags: string[];
  joinedDate: number;
  lastContact: number;
  notes?: string;
  customFields?: Record<string, unknown>;
}

// Demo contact data
const DEMO_CONTACTS: Record<string, Contact> = {
  'contact-1': {
    id: 'contact-1',
    name: 'Sarah Chen',
    email: 'sarah.chen@email.com',
    phone: '(555) 123-4567',
    location: 'Oakland, CA',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah Chen',
    supportLevel: 'Active Support',
    tags: ['climate', 'outreach', 'volunteer'],
    joinedDate: Date.now() - 15 * 24 * 60 * 60 * 1000,
    lastContact: Date.now() - 2 * 60 * 60 * 1000,
    notes: 'Very engaged in climate issues. Interested in learning about organizing. Good candidate for leadership development.',
    customFields: {
      skills: ['Event Planning', 'Sound System', 'Permit Applications'],
      availability: 'Weekends',
      dietary: 'Vegetarian'
    }
  }
};

export const ContactDetailPage: FC = () => {
  const { contactId } = useParams<{ contactId: string }>();
  const [contact, _setContact] = useState<Contact | null>(
    contactId ? DEMO_CONTACTS[contactId] : null
  );

  // Current user info (in real app, this would come from auth store)
  const currentUserId = 'user-1';
  const currentUserName = 'Emma Rodriguez';

  if (!contact) {
    return (
      <div className="space-y-6">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Contact not found</p>
          <Button className="mt-4">Back to Contacts</Button>
        </Card>
      </div>
    );
  }

  const getSupportLevelColor = (level: Contact['supportLevel']) => {
    switch (level) {
      case 'Core Organizer': return 'bg-purple-500 text-white';
      case 'Active Support': return 'bg-green-500 text-white';
      case 'Passive Support': return 'bg-blue-500 text-white';
      case 'Neutral': return 'bg-gray-500 text-white';
    }
  };

  const getSupportLevelPercentage = (level: Contact['supportLevel']) => {
    switch (level) {
      case 'Core Organizer': return '100%';
      case 'Active Support': return '70%';
      case 'Passive Support': return '40%';
      case 'Neutral': return '30%';
    }
  };

  return (
    <div className="space-y-6">
      <PageMeta
        title={contact.name}
        descriptionKey="meta.crm"
        path={`/app/contacts/${contact.id}`}
      />
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Contact Details</h1>
        <p className="text-muted-foreground">
          Complete history and communication with this contact
        </p>
      </div>

      {/* Contact Info Card */}
      <Card className="p-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <Avatar className="w-24 h-24 shrink-0">
            <AvatarImage src={contact.avatar} />
            <AvatarFallback className="text-2xl">{contact.name.charAt(0)}</AvatarFallback>
          </Avatar>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h2 className="text-2xl font-bold mb-1">{contact.name}</h2>
                <Badge className={`${getSupportLevelColor(contact.supportLevel)} mb-2`}>
                  {contact.supportLevel} ({getSupportLevelPercentage(contact.supportLevel)})
                </Badge>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <Edit className="w-4 h-4" />
                  Edit
                </Button>
                <Button size="sm" className="gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Send Message
                </Button>
              </div>
            </div>

            {/* Contact Details Grid */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                  {contact.email}
                </a>
              </div>
              {contact.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <a href={`tel:${contact.phone}`} className="text-primary hover:underline">
                    {contact.phone}
                  </a>
                </div>
              )}
              {contact.location && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{contact.location}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <UserPlus className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Joined {format(contact.joinedDate, 'MMM d, yyyy')}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Last contact {format(contact.lastContact, 'MMM d, yyyy')}
                </span>
              </div>
            </div>

            {/* Tags */}
            {contact.tags.length > 0 && (
              <div className="flex items-start gap-2 mb-4">
                <Tag className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
                <div className="flex flex-wrap gap-1">
                  {contact.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {contact.notes && (
              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Latest Note:</strong> {contact.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Custom Fields */}
        {contact.customFields && Object.keys(contact.customFields).length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-sm font-semibold mb-3">Additional Information</h3>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(contact.customFields).map(([key, value]) => (
                <div key={key}>
                  <p className="text-xs text-muted-foreground capitalize mb-1">{key}</p>
                  <p className="text-sm font-medium">
                    {Array.isArray(value) ? value.join(', ') : String(value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Activity & Conversation Tabs */}
      <Tabs defaultValue="activity" className="w-full">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="activity" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Activity Timeline
          </TabsTrigger>
          <TabsTrigger value="conversation" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Conversation History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="mt-6">
          <ContactActivityLog
            contactId={contact.id}
            contactName={contact.name}
          />
        </TabsContent>

        <TabsContent value="conversation" className="mt-6">
          <ConversationHistory
            contactId={contact.id}
            contactName={contact.name}
            contactAvatar={contact.avatar}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
