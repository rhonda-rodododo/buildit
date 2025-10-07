/**
 * Conversation History Component
 * Displays message thread view and conversation timeline with a contact
 */

import { FC, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Mail,
  Send,
  Search,
  Filter,
  Hash,
  Users,
  Lock
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Message {
  id: string;
  type: 'direct' | 'group' | 'mention';
  content: string;
  timestamp: number;
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
  recipient?: {
    id: string;
    name: string;
  };
  groupContext?: {
    groupId: string;
    groupName: string;
  };
  read: boolean;
  encrypted: boolean;
}

interface ConversationHistoryProps {
  contactId: string;
  contactName: string;
  contactAvatar?: string;
  currentUserId: string;
  currentUserName: string;
  className?: string;
}

// Demo message data
const DEMO_MESSAGES: Message[] = [
  {
    id: 'msg-1',
    type: 'direct',
    content: 'Hi! I saw your post about the climate organizing group. I\'d love to learn more and get involved.',
    timestamp: Date.now() - 15 * 24 * 60 * 60 * 1000,
    sender: {
      id: 'contact-1',
      name: 'Sarah Chen',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah Chen'
    },
    read: true,
    encrypted: true
  },
  {
    id: 'msg-2',
    type: 'direct',
    content: 'Welcome to BuildIt Network! We\'re excited to have you join our organizing efforts. Let me tell you about our current campaigns...',
    timestamp: Date.now() - 15 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000,
    sender: {
      id: 'user-1',
      name: 'Emma Rodriguez',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma Rodriguez'
    },
    recipient: {
      id: 'contact-1',
      name: 'Sarah Chen'
    },
    read: true,
    encrypted: true
  },
  {
    id: 'msg-3',
    type: 'group',
    content: '@Sarah Chen - Great point about direct action! Would you be interested in helping coordinate the next rally?',
    timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000,
    sender: {
      id: 'user-2',
      name: 'Marcus Johnson',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus Johnson'
    },
    groupContext: {
      groupId: 'group-1',
      groupName: 'Climate Justice Action'
    },
    read: true,
    encrypted: true
  },
  {
    id: 'msg-4',
    type: 'mention',
    content: 'I\'d be happy to help! I have experience with permit applications and sound system setup.',
    timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000,
    sender: {
      id: 'contact-1',
      name: 'Sarah Chen',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah Chen'
    },
    groupContext: {
      groupId: 'group-1',
      groupName: 'Climate Justice Action'
    },
    read: true,
    encrypted: true
  },
  {
    id: 'msg-5',
    type: 'direct',
    content: 'Hi Sarah! Just wanted to remind you about this Saturday\'s climate rally. Hope to see you there!',
    timestamp: Date.now() - 2 * 60 * 60 * 1000,
    sender: {
      id: 'user-1',
      name: 'Marcus Johnson',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus Johnson'
    },
    recipient: {
      id: 'contact-1',
      name: 'Sarah Chen'
    },
    read: true,
    encrypted: true
  },
  {
    id: 'msg-6',
    type: 'direct',
    content: 'Thanks for the reminder! I\'ll be there. I\'m bringing two friends who are also interested in getting involved.',
    timestamp: Date.now() - 1 * 60 * 60 * 1000,
    sender: {
      id: 'contact-1',
      name: 'Sarah Chen',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah Chen'
    },
    read: true,
    encrypted: true
  }
];

export const ConversationHistory: FC<ConversationHistoryProps> = ({
  contactId,
  contactName,
  contactAvatar,
  currentUserId,
  currentUserName,
  className
}) => {
  const [messages, setMessages] = useState<Message[]>(DEMO_MESSAGES);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'direct' | 'group' | 'mention'>('all');
  const [newMessage, setNewMessage] = useState('');

  const filteredMessages = messages.filter(message => {
    // Filter by type
    if (filterType !== 'all' && message.type !== filterType) {
      return false;
    }

    // Filter by search query
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      return (
        message.content.toLowerCase().includes(searchLower) ||
        message.sender.name.toLowerCase().includes(searchLower) ||
        message.groupContext?.groupName.toLowerCase().includes(searchLower)
      );
    }

    return true;
  });

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const message: Message = {
      id: `msg-${Date.now()}`,
      type: 'direct',
      content: newMessage,
      timestamp: Date.now(),
      sender: {
        id: currentUserId,
        name: currentUserName
      },
      recipient: {
        id: contactId,
        name: contactName
      },
      read: false,
      encrypted: true
    };

    setMessages([...messages, message]);
    setNewMessage('');
  };

  const getMessageIcon = (type: Message['type']) => {
    switch (type) {
      case 'direct': return <Mail className="w-3 h-3" />;
      case 'group': return <Users className="w-3 h-3" />;
      case 'mention': return <Hash className="w-3 h-3" />;
    }
  };

  const getMessageTypeLabel = (type: Message['type']) => {
    switch (type) {
      case 'direct': return 'Direct Message';
      case 'group': return 'Group Message';
      case 'mention': return 'Mentioned';
    }
  };

  const isCurrentUser = (senderId: string) => senderId === currentUserId;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={contactAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contactName}`} />
            <AvatarFallback>{contactName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-lg font-semibold">Conversation with {contactName}</h3>
            <p className="text-sm text-muted-foreground">
              {filteredMessages.length} messages
            </p>
          </div>
        </div>

        {/* Filter Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="w-4 h-4" />
              {filterType === 'all' ? 'All Messages' : getMessageTypeLabel(filterType)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Filter Messages</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setFilterType('all')}>
              All Messages
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterType('direct')}>
              <Mail className="w-4 h-4 mr-2" />
              Direct Messages
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterType('group')}>
              <Users className="w-4 h-4 mr-2" />
              Group Messages
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterType('mention')}>
              <Hash className="w-4 h-4 mr-2" />
              Mentions
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search conversation..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Message Thread */}
      <Card className="p-4 max-h-[600px] overflow-y-auto">
        <div className="space-y-4">
          {filteredMessages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No messages found</p>
            </div>
          ) : (
            filteredMessages.map((message, index) => {
              const fromCurrentUser = isCurrentUser(message.sender.id);
              const showDateDivider = index === 0 ||
                format(message.timestamp, 'yyyy-MM-dd') !== format(filteredMessages[index - 1].timestamp, 'yyyy-MM-dd');

              return (
                <div key={message.id}>
                  {/* Date Divider */}
                  {showDateDivider && (
                    <div className="flex items-center gap-3 my-6">
                      <div className="flex-1 h-px bg-border" />
                      <div className="text-xs text-muted-foreground font-medium">
                        {format(message.timestamp, 'MMMM d, yyyy')}
                      </div>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div className={`flex gap-3 ${fromCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    <Avatar className="w-8 h-8 shrink-0">
                      <AvatarImage src={message.sender.avatar} />
                      <AvatarFallback>{message.sender.name.charAt(0)}</AvatarFallback>
                    </Avatar>

                    <div className={`flex-1 max-w-[70%] ${fromCurrentUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      {/* Message Header */}
                      <div className={`flex items-center gap-2 text-xs ${fromCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className="font-medium">{message.sender.name}</span>
                        {message.encrypted && (
                          <Lock className="w-3 h-3 text-green-500" title="End-to-end encrypted" />
                        )}
                        {message.type !== 'direct' && (
                          <Badge variant="outline" className="text-xs gap-1">
                            {getMessageIcon(message.type)}
                            {message.groupContext?.groupName}
                          </Badge>
                        )}
                      </div>

                      {/* Message Content */}
                      <div className={`rounded-2xl px-4 py-2 ${
                        fromCurrentUser
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                      </div>

                      {/* Message Footer */}
                      <div className={`text-xs text-muted-foreground ${fromCurrentUser ? 'text-right' : 'text-left'}`}>
                        {formatDistanceToNow(message.timestamp, { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Message Input */}
      <Card className="p-4">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <textarea
              className="w-full p-3 border rounded-lg bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
              placeholder={`Send a message to ${contactName}...`}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className="gap-2"
          >
            <Send className="w-4 h-4" />
            Send
          </Button>
        </div>
      </Card>

      {/* Conversation Stats */}
      <Card className="p-4 bg-muted/50">
        <h4 className="text-sm font-semibold mb-3">Conversation Summary</h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">
              {messages.filter(m => m.type === 'direct').length}
            </p>
            <p className="text-xs text-muted-foreground">Direct Messages</p>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {messages.filter(m => m.type === 'group' || m.type === 'mention').length}
            </p>
            <p className="text-xs text-muted-foreground">Group Interactions</p>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {Math.floor((Date.now() - messages[0]?.timestamp) / (24 * 60 * 60 * 1000)) || 0}
            </p>
            <p className="text-xs text-muted-foreground">Days Since First Contact</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
