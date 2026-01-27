/**
 * Messaging Hotline View
 * Operator interface for text-based hotline intake with thread management
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MessageSquare,
  Phone,
  CheckCircle,
  Clock,
  AlertTriangle,
  Send,
  Paperclip,
  ChevronDown,
  Filter,
  Search,
  MoreVertical,
  PhoneForwarded,
  User,
  Smartphone,
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { MessagingThread, ThreadMessage } from '../services/messagingQueueManager';
import type { MessageTemplate, TemplateContext } from '../services/templateManager';
import type { MessagingHotlineThreadStatus, MessagingHotlineThreadPriority } from '../types';

interface MessagingHotlineViewProps {
  threads: MessagingThread[];
  selectedThread: MessagingThread | null;
  templates: MessageTemplate[];
  operatorName: string;
  hotlineName: string;
  onSelectThread: (thread: MessagingThread) => void;
  onClaimThread: (threadId: string) => void;
  onSendMessage: (threadId: string, content: string) => void;
  onResolveThread: (threadId: string, summary?: string) => void;
  onTransferThread: (threadId: string, targetPubkey: string, reason?: string) => void;
  onEscalateToVoice: (threadId: string) => void;
  onSetPriority: (threadId: string, priority: MessagingHotlineThreadPriority) => void;
  onSetCategory: (threadId: string, category: string) => void;
  onApplyTemplate: (template: MessageTemplate, context: TemplateContext) => string;
}

type FilterType = 'all' | 'unassigned' | 'my-threads' | 'waiting';

const PRIORITY_COLORS: Record<MessagingHotlineThreadPriority, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-gray-400',
};

const STATUS_ICONS: Record<MessagingHotlineThreadStatus, React.ReactNode> = {
  unassigned: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  assigned: <User className="h-4 w-4 text-blue-500" />,
  active: <MessageCircle className="h-4 w-4 text-green-500" />,
  waiting: <Clock className="h-4 w-4 text-yellow-500" />,
  resolved: <CheckCircle className="h-4 w-4 text-gray-500" />,
  archived: <CheckCircle className="h-4 w-4 text-gray-400" />,
};

const CONTACT_TYPE_ICONS: Record<string, React.ReactNode> = {
  buildit: <MessageSquare className="h-4 w-4" />,
  sms: <Smartphone className="h-4 w-4" />,
  rcs: <MessageCircle className="h-4 w-4" />,
};

export function MessagingHotlineView({
  threads,
  selectedThread,
  templates,
  operatorName,
  hotlineName,
  onSelectThread,
  onClaimThread,
  onSendMessage,
  onResolveThread,
  onTransferThread,
  onEscalateToVoice,
  onSetPriority,
  onSetCategory,
  onApplyTemplate,
}: MessagingHotlineViewProps) {
  const { t } = useTranslation('calling');
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [resolveSummary, setResolveSummary] = useState('');
  const [transferTarget, setTransferTarget] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Filter threads
  const filteredThreads = threads.filter((thread) => {
    // Apply status filter
    if (filter === 'unassigned' && thread.status !== 'unassigned') return false;
    if (filter === 'my-threads' && !thread.assignedTo) return false;
    if (filter === 'waiting' && thread.status !== 'waiting') return false;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = thread.callerName?.toLowerCase().includes(query);
      const matchesContent = thread.messages.some((m) =>
        m.content.toLowerCase().includes(query)
      );
      if (!matchesName && !matchesContent) return false;
    }

    // Exclude archived
    return thread.status !== 'archived';
  });

  // Count threads by filter
  const threadCounts = {
    all: threads.filter((t) => t.status !== 'archived').length,
    unassigned: threads.filter((t) => t.status === 'unassigned').length,
    myThreads: threads.filter((t) => !!t.assignedTo).length,
    waiting: threads.filter((t) => t.status === 'waiting').length,
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedThread?.messages.length]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const template = templates.find((t) => {
          if (!t.shortcut) return false;
          const parts = t.shortcut.split('+');
          const key = parts[parts.length - 1];
          return key === e.key.toUpperCase();
        });

        if (template && selectedThread) {
          e.preventDefault();
          const content = onApplyTemplate(template, {
            hotline_name: hotlineName,
            operator_name: operatorName,
            caller_name: selectedThread.callerName,
          });
          setMessageInput(content);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [templates, selectedThread, onApplyTemplate, hotlineName, operatorName]);

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedThread) return;
    onSendMessage(selectedThread.threadId, messageInput);
    setMessageInput('');
  };

  const handleApplyTemplate = (template: MessageTemplate) => {
    if (!selectedThread) return;
    const content = onApplyTemplate(template, {
      hotline_name: hotlineName,
      operator_name: operatorName,
      caller_name: selectedThread.callerName,
    });
    setMessageInput(content);
    setShowTemplates(false);
  };

  const handleResolve = () => {
    if (!selectedThread) return;
    onResolveThread(selectedThread.threadId, resolveSummary || undefined);
    setShowResolveDialog(false);
    setResolveSummary('');
  };

  const handleTransfer = () => {
    if (!selectedThread || !transferTarget) return;
    onTransferThread(selectedThread.threadId, transferTarget, transferReason || undefined);
    setShowTransferDialog(false);
    setTransferTarget('');
    setTransferReason('');
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - timestamp;

    if (diff < 60000) return t('justNow');
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex h-full">
      {/* Thread List Panel */}
      <div className="w-80 border-r flex flex-col">
        {/* Filters */}
        <div className="p-4 border-b space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('searchThreads')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              {t('all')} ({threadCounts.all})
            </Button>
            <Button
              variant={filter === 'unassigned' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('unassigned')}
            >
              {t('unassigned')} ({threadCounts.unassigned})
            </Button>
            <Button
              variant={filter === 'my-threads' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('my-threads')}
            >
              {t('myThreads')} ({threadCounts.myThreads})
            </Button>
            <Button
              variant={filter === 'waiting' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('waiting')}
            >
              {t('waiting')} ({threadCounts.waiting})
            </Button>
          </div>
        </div>

        {/* Thread List */}
        <ScrollArea className="flex-1">
          {filteredThreads.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              {t('noThreads')}
            </div>
          ) : (
            filteredThreads.map((thread) => (
              <div
                key={thread.threadId}
                className={cn(
                  'p-3 border-b cursor-pointer hover:bg-muted/50 transition-colors',
                  selectedThread?.threadId === thread.threadId && 'bg-muted'
                )}
                onClick={() => onSelectThread(thread)}
              >
                <div className="flex items-start gap-3">
                  {/* Priority indicator */}
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full mt-2',
                      PRIORITY_COLORS[thread.priority]
                    )}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">
                        {thread.callerName || t('unknownCaller')}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(thread.lastActivityAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      {STATUS_ICONS[thread.status]}
                      <span className="text-xs text-muted-foreground capitalize">
                        {thread.status.replace('_', ' ')}
                      </span>
                      {thread.contactType && CONTACT_TYPE_ICONS[thread.contactType]}
                    </div>

                    {thread.lastMessage && (
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {thread.lastMessage.senderType === 'operator' && 'You: '}
                        {thread.lastMessage.content}
                      </p>
                    )}

                    {thread.unreadCount > 0 && (
                      <Badge variant="destructive" className="mt-1">
                        {thread.unreadCount} {t('unread')}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Conversation Panel */}
      <div className="flex-1 flex flex-col">
        {selectedThread ? (
          <>
            {/* Thread Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>
                    {(selectedThread.callerName || '?')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">
                    {selectedThread.callerName || t('unknownCaller')}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge
                      variant="outline"
                      className={cn('capitalize', {
                        'border-green-500 text-green-500': selectedThread.status === 'active',
                        'border-yellow-500 text-yellow-500': selectedThread.status === 'waiting',
                        'border-orange-500 text-orange-500': selectedThread.status === 'unassigned',
                      })}
                    >
                      {selectedThread.status}
                    </Badge>
                    <Select
                      value={selectedThread.priority}
                      onValueChange={(v) => onSetPriority(selectedThread.threadId, v as MessagingHotlineThreadPriority)}
                    >
                      <SelectTrigger className="h-7 w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urgent">{t('urgent')}</SelectItem>
                        <SelectItem value="high">{t('high')}</SelectItem>
                        <SelectItem value="medium">{t('medium')}</SelectItem>
                        <SelectItem value="low">{t('low')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedThread.status === 'unassigned' && (
                  <Button onClick={() => onClaimThread(selectedThread.threadId)}>
                    {t('claimThread')}
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onEscalateToVoice(selectedThread.threadId)}
                  title={t('escalateToVoice')}
                >
                  <Phone className="h-4 w-4" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setShowTransferDialog(true)}>
                      <PhoneForwarded className="h-4 w-4 mr-2" />
                      {t('transfer')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShowResolveDialog(true)}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {t('resolve')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {selectedThread.messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    formatTime={formatTime}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t">
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <Textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder={t('typeMessage')}
                    className="min-h-[80px] pr-24"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <div className="absolute bottom-2 right-2 flex items-center gap-1">
                    <DropdownMenu open={showTemplates} onOpenChange={setShowTemplates}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <ChevronDown className="h-4 w-4 mr-1" />
                          {t('templates')}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64">
                        {templates.map((template) => (
                          <DropdownMenuItem
                            key={template.id}
                            onClick={() => handleApplyTemplate(template)}
                          >
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span>{template.name}</span>
                                {template.shortcut && (
                                  <span className="text-xs text-muted-foreground">
                                    {template.shortcut}
                                  </span>
                                )}
                              </div>
                            </div>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="ghost" size="icon">
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button onClick={handleSendMessage} disabled={!messageInput.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('selectThreadToStart')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Resolve Dialog */}
      <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('resolveThread')}</DialogTitle>
            <DialogDescription>{t('resolveThreadDescription')}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={resolveSummary}
            onChange={(e) => setResolveSummary(e.target.value)}
            placeholder={t('resolutionSummary')}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolveDialog(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleResolve}>{t('resolve')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('transferThread')}</DialogTitle>
            <DialogDescription>{t('transferThreadDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={transferTarget}
              onChange={(e) => setTransferTarget(e.target.value)}
              placeholder={t('operatorPubkey')}
            />
            <Textarea
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              placeholder={t('transferReasonOptional')}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferDialog(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleTransfer} disabled={!transferTarget}>
              {t('transfer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Message Bubble Component
function MessageBubble({
  message,
  formatTime,
}: {
  message: ThreadMessage;
  formatTime: (ts: number) => string;
}) {
  const isOperator = message.senderType === 'operator';
  const isSystem = message.senderType === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex', isOperator ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[70%] rounded-lg px-4 py-2',
          isOperator
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <span
          className={cn(
            'text-xs mt-1 block',
            isOperator ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}
        >
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

export default MessagingHotlineView;
