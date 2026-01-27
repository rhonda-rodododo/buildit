# Epic 9: Messaging Hotline & Broadcast System

> Text-based hotline intake, operator chat, SMS/RCS bridge, and message blasts

## Overview

Not everyone can or wants to make a voice call. This epic adds:
1. **Messaging Hotlines** - Text-based intake where callers message in and operators respond
2. **SMS/RCS Bridge** - Allow messaging hotlines to receive texts from regular phones
3. **Message Blasts** - Broadcast important updates to groups, contacts, or public channels

All messaging uses the existing NIP-17 E2EE infrastructure for BuildIt-to-BuildIt communication.

## Dependencies

- **Epic 7**: Hotline Module Enhancement (queue patterns, operator systems)
- Existing messaging infrastructure (NIP-17)

## Unlocks

- Complete multi-channel hotline support (voice + text + phone)

---

## Part 1: Messaging Hotline Architecture

### 1.1 Why Messaging Hotlines?

```
┌─────────────────────────────────────────────────────────────────┐
│                 WHY TEXT-BASED INTAKE?                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Scenarios where messaging is preferred:                         │
│                                                                  │
│  📱 Caller in public/unsafe space - can't talk                   │
│  🔇 Hearing impaired users                                       │
│  🌐 Spotty connection - text works, voice doesn't                │
│  📝 Need to share screenshots, photos, documents                 │
│  ⏰ Non-urgent - async response acceptable                       │
│  🤐 Surveillance concern - typing less suspicious than talking   │
│  📊 Complex info - easier to type booking numbers, addresses     │
│                                                                  │
│  Both channels can coexist:                                      │
│  - Same hotline, dual intake (voice + text)                      │
│  - Different hotlines for different purposes                     │
│  - Escalate text to voice when needed                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Message Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                 MESSAGING HOTLINE FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  BUILDIT USER                                                    │
│  ┌─────────────┐     ┌─────────────────┐     ┌───────────────┐  │
│  │   User      │────▶│  Message Queue  │────▶│   Operator    │  │
│  │  Messages   │     │                 │     │   Responds    │  │
│  │  Hotline    │     │  - Priority     │     └───────┬───────┘  │
│  └─────────────┘     │  - Wait time    │             │          │
│        ▲             │  - Assignment   │             │          │
│        │             └─────────────────┘             │          │
│        │                                             │          │
│        └─────────────────────────────────────────────┘          │
│                      Threaded conversation                       │
│                      (E2EE via NIP-17)                           │
│                                                                  │
│  SMS USER (via bridge - Epic 8 adjacent)                         │
│  ┌─────────────┐     ┌─────────────────┐     ┌───────────────┐  │
│  │  SMS to     │────▶│  Twilio/Bridge  │────▶│ Message Queue │  │
│  │  Hotline #  │     │  (not E2EE)     │     │               │  │
│  └─────────────┘     └─────────────────┘     └───────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Data Model

```typescript
interface MessagingHotlineThread {
  id: string;
  hotlineId: string;
  groupId: string;

  // Contact info
  contactPubkey?: string;      // BuildIt user
  contactPhone?: string;       // SMS user
  contactName?: string;
  contactType: 'buildit' | 'sms' | 'rcs';

  // Assignment
  assignedOperator?: string;
  status: 'unassigned' | 'assigned' | 'active' | 'waiting' | 'resolved' | 'archived';
  priority: Priority;
  category?: string;

  // Threading
  messageCount: number;
  lastMessageAt: number;
  lastMessageBy: 'contact' | 'operator';
  unreadByOperator: number;

  // Metadata
  createdAt: number;
  resolvedAt?: number;
  resolutionNotes?: string;

  // Link to voice call if escalated
  linkedCallId?: string;
}

interface HotlineMessage {
  id: string;
  threadId: string;
  sender: 'contact' | 'operator';
  senderPubkey?: string;

  // Content
  content: string;
  attachments?: MessageAttachment[];

  // For canned responses
  templateId?: string;

  // Metadata
  timestamp: number;
  readAt?: number;
  deliveredAt?: number;
}

interface MessageAttachment {
  id: string;
  type: 'image' | 'document' | 'location';
  url: string;           // Encrypted blob URL
  filename?: string;
  size: number;
  thumbnailUrl?: string;
}
```

---

## Part 2: Operator Messaging Interface

### 2.1 Inbox View

```
┌─────────────────────────────────────────────────────────────────┐
│  Messaging Inbox - Legal Intake Hotline                         │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────┐ ┌─────────────────────────────────────┐ │
│ │ Filters             │ │ CONVERSATION                        │ │
│ │ ○ All (23)          │ │                                     │ │
│ │ ● Unassigned (5)    │ │ Thread: Maria G.                    │ │
│ │ ○ My Threads (8)    │ │ Status: Active  Priority: High      │ │
│ │ ○ Waiting (10)      │ │ Category: Arrest Support            │ │
│ │                     │ │                                     │ │
│ ├─────────────────────┤ │ ┌─────────────────────────────────┐ │ │
│ │ THREADS             │ │ │ Maria (2:34 PM)                 │ │ │
│ │                     │ │ │ My partner was arrested at the  │ │ │
│ │ ┌─────────────────┐ │ │ │ protest. Booking #2024-5678.   │ │ │
│ │ │ 🔴 Maria G.     │ │ │ │ They need insulin - diabetic.  │ │ │
│ │ │ 2m ago - HIGH   │ │ │ └─────────────────────────────────┘ │ │
│ │ │ "partner arrest"│ │ │                                     │ │
│ │ └─────────────────┘ │ │ ┌─────────────────────────────────┐ │ │
│ │ ┌─────────────────┐ │ │ │ You (2:36 PM)                   │ │ │
│ │ │ 🟡 James T.     │ │ │ │ I'm looking up the booking now. │ │ │
│ │ │ 15m ago - MED   │ │ │ │ Do you know which precinct?     │ │ │
│ │ │ "legal question"│ │ │ └─────────────────────────────────┘ │ │
│ │ └─────────────────┘ │ │                                     │ │
│ │ ┌─────────────────┐ │ │ ┌─────────────────────────────────┐ │ │
│ │ │ 🟢 Alex P.      │ │ │ │ Maria (2:38 PM)                 │ │ │
│ │ │ 1h ago - LOW    │ │ │ │ Downtown. Here's a photo of    │ │ │
│ │ │ waiting for reply│ │ │ │ the citation.                  │ │ │
│ │ └─────────────────┘ │ │ │ [📎 citation.jpg]               │ │ │
│ │                     │ │ └─────────────────────────────────┘ │ │
│ └─────────────────────┘ │                                     │ │
│                         │ ┌─────────────────────────────────┐ │ │
│                         │ │ Type a message...          [📎] │ │ │
│                         │ │                                 │ │ │
│                         │ │ [Templates ▼]     [Send 📤]    │ │ │
│                         │ └─────────────────────────────────┘ │ │
│                         │                                     │ │
│                         │ [📞 Call Contact] [✅ Resolve]     │ │
│                         └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Thread Component

```typescript
function MessagingThread({ thread }: { thread: MessagingHotlineThread }) {
  const { messages, sendMessage, isLoading } = useThreadMessages(thread.id);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);

  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) return;

    await sendMessage({
      threadId: thread.id,
      content: input,
      attachments,
    });

    setInput('');
    setAttachments([]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">{thread.contactName || t('anonymous')}</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ThreadStatusBadge status={thread.status} />
              <PriorityBadge priority={thread.priority} />
              {thread.category && <Badge variant="outline">{thread.category}</Badge>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => escalateToCall(thread)}>
              <Phone className="h-4 w-4 mr-1" />
              {t('call')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => resolveThread(thread.id)}>
              <CheckCircle className="h-4 w-4 mr-1" />
              {t('resolve')}
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOperator={msg.sender === 'operator'}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="p-4 border-t">
        {attachments.length > 0 && (
          <AttachmentPreview
            files={attachments}
            onRemove={(i) => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
          />
        )}

        <div className="flex gap-2">
          <TemplateDropdown
            onSelect={(template) => setInput(prev => prev + template.content)}
          />

          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('type_message')}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            className="flex-1"
          />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <input
            id="file-input"
            type="file"
            className="hidden"
            multiple
            onChange={(e) => setAttachments(Array.from(e.target.files || []))}
          />

          <Button onClick={handleSend} disabled={isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### 2.3 Canned Responses / Templates

```typescript
interface MessageTemplate {
  id: string;
  hotlineId: string;
  name: string;
  content: string;
  category: string;
  variables: string[];  // Placeholders like {{name}}, {{booking_number}}
  shortcut?: string;    // Keyboard shortcut
}

const defaultTemplates: MessageTemplate[] = [
  {
    id: 'greeting',
    name: 'Greeting',
    content: 'Thank you for contacting the {{hotline_name}}. My name is {{operator_name}} and I\'ll be helping you today. How can I assist?',
    category: 'general',
    variables: ['hotline_name', 'operator_name'],
    shortcut: 'Ctrl+G',
  },
  {
    id: 'info_request',
    name: 'Request Info',
    content: 'To help you better, could you please provide:\n- Full name of the person\n- Booking number (if known)\n- Location/precinct\n- Any immediate medical needs',
    category: 'arrest',
    variables: [],
    shortcut: 'Ctrl+I',
  },
  {
    id: 'followup',
    name: 'Follow-up Scheduled',
    content: 'I\'ve noted your case. We\'ll follow up within {{timeframe}}. If anything urgent comes up, please message back immediately.',
    category: 'general',
    variables: ['timeframe'],
  },
  {
    id: 'resolved',
    name: 'Resolution',
    content: 'I\'m glad we could help resolve this. Please don\'t hesitate to reach out again if you need anything. Stay safe.',
    category: 'closing',
    variables: [],
    shortcut: 'Ctrl+R',
  },
];

function TemplateDropdown({ onSelect }: { onSelect: (t: MessageTemplate) => void }) {
  const { templates } = useHotlineTemplates();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 mr-1" />
          {t('templates')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        {Object.entries(groupBy(templates, 'category')).map(([category, temps]) => (
          <DropdownMenuGroup key={category}>
            <DropdownMenuLabel>{category}</DropdownMenuLabel>
            {temps.map((template) => (
              <DropdownMenuItem
                key={template.id}
                onClick={() => onSelect(template)}
              >
                <span className="flex-1">{template.name}</span>
                {template.shortcut && (
                  <kbd className="text-xs text-muted-foreground">
                    {template.shortcut}
                  </kbd>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### 2.4 Assignment & Queue

```typescript
class MessagingQueueManager {
  // Auto-assign to available operator
  async assignThread(threadId: string): Promise<void> {
    const availableOperator = this.findAvailableOperator();
    if (!availableOperator) {
      // Leave in unassigned queue
      return;
    }

    await this.updateThread(threadId, {
      assignedOperator: availableOperator.pubkey,
      status: 'assigned',
    });

    // Notify operator
    await this.notifyOperator(availableOperator.pubkey, {
      type: 'thread-assigned',
      threadId,
    });
  }

  // Operator claims thread manually
  async claimThread(threadId: string, operatorPubkey: string): Promise<void> {
    const thread = await this.getThread(threadId);

    if (thread.assignedOperator && thread.assignedOperator !== operatorPubkey) {
      throw new Error('Thread already assigned');
    }

    await this.updateThread(threadId, {
      assignedOperator: operatorPubkey,
      status: 'active',
    });
  }

  // Transfer thread to another operator
  async transferThread(
    threadId: string,
    fromOperator: string,
    toOperator: string,
    reason?: string
  ): Promise<void> {
    await this.updateThread(threadId, {
      assignedOperator: toOperator,
    });

    // Add system message to thread
    await this.addSystemMessage(threadId, {
      content: `Thread transferred from ${fromOperator} to ${toOperator}${reason ? `: ${reason}` : ''}`,
    });
  }
}
```

---

## Part 3: SMS/RCS Bridge

### 3.1 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 SMS/RCS BRIDGE                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐     ┌─────────────────┐     ┌───────────────┐  │
│  │  SMS/RCS    │────▶│  Twilio/Bridge  │────▶│  BuildIt API  │  │
│  │  from Phone │     │  Worker         │     │               │  │
│  └─────────────┘     └─────────────────┘     └───────┬───────┘  │
│        ▲                                            │          │
│        │                                            ▼          │
│        │             ┌─────────────────┐     ┌───────────────┐  │
│        └─────────────│  Outbound SMS   │◀────│  Operator     │  │
│                      │  via Twilio     │     │  Response     │  │
│                      └─────────────────┘     └───────────────┘  │
│                                                                  │
│  Privacy notes:                                                  │
│  - SMS is NOT encrypted (carrier can read)                       │
│  - Phone numbers stored encrypted                                │
│  - Offer callback to BuildIt app for sensitive topics            │
│  - Clear disclosure in first response                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Inbound SMS Handler

```typescript
// workers/sms/src/inbound.ts

export async function handleInboundSMS(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();
  const from = formData.get('From') as string;
  const to = formData.get('To') as string;
  const body = formData.get('Body') as string;
  const numMedia = parseInt(formData.get('NumMedia') as string) || 0;

  // Look up hotline for this number
  const hotlineId = await env.SMS_NUMBERS.get(to);
  if (!hotlineId) {
    return twilioResponse('This number is not active.');
  }

  // Find or create thread for this phone number
  let thread = await findThreadByPhone(from, hotlineId, env);

  if (!thread) {
    thread = await createThread({
      hotlineId,
      contactPhone: from,
      contactType: 'sms',
      status: 'unassigned',
      priority: 'medium',
    }, env);

    // Send welcome message with privacy notice
    return twilioResponse(
      `Thank you for contacting us. Note: SMS is not encrypted. ` +
      `For sensitive matters, download BuildIt app for secure messaging. ` +
      `An operator will respond shortly.`
    );
  }

  // Add message to thread
  const attachments = await processMediaAttachments(formData, numMedia, env);

  await addMessageToThread(thread.id, {
    sender: 'contact',
    content: body,
    attachments,
  }, env);

  // Notify assigned operator (or trigger assignment)
  if (thread.assignedOperator) {
    await notifyOperator(thread.assignedOperator, {
      type: 'new-message',
      threadId: thread.id,
    }, env);
  } else {
    await triggerAssignment(thread.id, env);
  }

  // Don't auto-reply to every message (operator will respond)
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    headers: { 'Content-Type': 'application/xml' },
  });
}

function twilioResponse(message: string): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`,
    { headers: { 'Content-Type': 'application/xml' } }
  );
}
```

### 3.3 Outbound SMS

```typescript
// Send operator response via SMS

class SMSOutbound {
  async sendToContact(threadId: string, message: string): Promise<void> {
    const thread = await this.getThread(threadId);

    if (thread.contactType !== 'sms' || !thread.contactPhone) {
      throw new Error('Thread is not SMS-based');
    }

    // Get hotline's SMS number
    const hotlineNumber = await this.getHotlineSMSNumber(thread.hotlineId);

    // Send via Twilio
    await this.twilio.messages.create({
      to: thread.contactPhone,
      from: hotlineNumber,
      body: message,
    });

    // Log outbound message
    await this.addMessageToThread(threadId, {
      sender: 'operator',
      content: message,
      senderPubkey: this.operatorPubkey,
    });

    // Track usage for billing
    await this.trackSMSUsage(thread.hotlineId, 'outbound');
  }
}
```

### 3.4 RCS Support (Future)

```typescript
// RCS provides richer messaging than SMS
// - Read receipts
// - Typing indicators
// - High-res images
// - Suggested replies

interface RCSCapabilities {
  richCards: boolean;
  carousels: boolean;
  suggestedReplies: boolean;
  suggestedActions: boolean;
}

// Check if recipient supports RCS, fallback to SMS
async function sendMessage(to: string, content: MessageContent): Promise<void> {
  const capabilities = await checkRCSCapabilities(to);

  if (capabilities.richCards && content.type === 'card') {
    await sendRCSRichCard(to, content);
  } else if (capabilities.suggestedReplies && content.quickReplies) {
    await sendRCSWithSuggestions(to, content);
  } else {
    // Fallback to SMS
    await sendSMS(to, content.text);
  }
}
```

---

## Part 4: Message Blasts / Broadcasts

### 4.1 Broadcast Types

```
┌─────────────────────────────────────────────────────────────────┐
│                 BROADCAST TYPES                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. GROUP BROADCAST                                              │
│     Send to all members of a BuildIt group                       │
│     - E2EE via group NIP-17                                      │
│     - Instant delivery to online members                         │
│     - Queued for offline members                                 │
│                                                                  │
│  2. CONTACT LIST BROADCAST                                       │
│     Send to saved contacts (CRM)                                 │
│     - Individual E2EE messages                                   │
│     - Can include SMS contacts                                   │
│     - Segment by tags/lists                                      │
│                                                                  │
│  3. PUBLIC CHANNEL BROADCAST                                     │
│     Post to public Nostr channel                                 │
│     - Not encrypted (public)                                     │
│     - Followers see in their feed                                │
│     - Good for announcements, events                             │
│                                                                  │
│  4. EMERGENCY ALERT                                              │
│     High-priority to all group members + contacts                │
│     - Push notification required                                 │
│     - Bypasses do-not-disturb                                    │
│     - Requires elevated permission                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Broadcast Schema

```typescript
interface Broadcast {
  id: string;
  groupId: string;
  createdBy: string;

  // Content
  title?: string;
  content: string;
  attachments?: BroadcastAttachment[];

  // Targeting
  targetType: 'group' | 'contact-list' | 'public-channel' | 'emergency';
  targetIds: string[];   // Group IDs, contact list IDs, etc.
  filters?: {
    tags?: string[];
    roles?: string[];
    location?: GeoFilter;
  };

  // Scheduling
  scheduledAt?: number;   // null = immediate
  expiresAt?: number;     // Auto-delete after

  // Options
  priority: 'normal' | 'high' | 'emergency';
  allowReplies: boolean;
  trackDelivery: boolean;

  // Status
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  sentAt?: number;

  // Analytics (if tracking enabled)
  analytics?: {
    totalRecipients: number;
    delivered: number;
    read: number;
    replied: number;
  };
}

interface BroadcastAttachment {
  type: 'image' | 'document' | 'link' | 'event';
  url?: string;
  eventId?: string;  // Link to BuildIt event
  metadata?: Record<string, unknown>;
}
```

### 4.3 Broadcast Composer

```typescript
function BroadcastComposer({ groupId }: { groupId: string }) {
  const [broadcast, setBroadcast] = useState<Partial<Broadcast>>({
    targetType: 'group',
    targetIds: [groupId],
    priority: 'normal',
    allowReplies: true,
  });
  const [content, setContent] = useState('');

  const { members } = useGroupMembers(groupId);
  const { contactLists } = useContactLists(groupId);

  const estimatedRecipients = useMemo(() => {
    switch (broadcast.targetType) {
      case 'group':
        return members.length;
      case 'contact-list':
        return contactLists
          .filter(l => broadcast.targetIds?.includes(l.id))
          .reduce((sum, l) => sum + l.contactCount, 0);
      default:
        return 0;
    }
  }, [broadcast, members, contactLists]);

  const handleSend = async () => {
    if (broadcast.priority === 'emergency') {
      // Require confirmation for emergency
      const confirmed = await showConfirmDialog({
        title: t('emergency_broadcast'),
        message: t('emergency_broadcast_confirm', { count: estimatedRecipients }),
        confirmText: t('send_emergency'),
        variant: 'destructive',
      });
      if (!confirmed) return;
    }

    await sendBroadcast({
      ...broadcast,
      content,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('new_broadcast')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Target selection */}
        <div>
          <Label>{t('send_to')}</Label>
          <RadioGroup
            value={broadcast.targetType}
            onValueChange={(v) => setBroadcast({ ...broadcast, targetType: v as any })}
          >
            <RadioGroupItem value="group">{t('group_members')}</RadioGroupItem>
            <RadioGroupItem value="contact-list">{t('contact_list')}</RadioGroupItem>
            <RadioGroupItem value="public-channel">{t('public_channel')}</RadioGroupItem>
          </RadioGroup>
        </div>

        {broadcast.targetType === 'contact-list' && (
          <ContactListSelector
            lists={contactLists}
            selected={broadcast.targetIds || []}
            onChange={(ids) => setBroadcast({ ...broadcast, targetIds: ids })}
          />
        )}

        {/* Content */}
        <div>
          <Label>{t('message')}</Label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('broadcast_placeholder')}
            rows={5}
          />
          <p className="text-sm text-muted-foreground mt-1">
            {content.length} / 2000
          </p>
        </div>

        {/* Attachments */}
        <AttachmentUploader
          onUpload={(attachments) =>
            setBroadcast({ ...broadcast, attachments })
          }
        />

        {/* Priority */}
        <div>
          <Label>{t('priority')}</Label>
          <Select
            value={broadcast.priority}
            onValueChange={(v) => setBroadcast({ ...broadcast, priority: v as any })}
          >
            <SelectItem value="normal">{t('normal')}</SelectItem>
            <SelectItem value="high">{t('high_priority')}</SelectItem>
            <SelectItem value="emergency">
              {t('emergency')} ⚠️
            </SelectItem>
          </Select>
        </div>

        {/* Scheduling */}
        <div className="flex items-center gap-2">
          <Checkbox
            checked={!!broadcast.scheduledAt}
            onCheckedChange={(checked) =>
              setBroadcast({
                ...broadcast,
                scheduledAt: checked ? Date.now() + 3600000 : undefined,
              })
            }
          />
          <Label>{t('schedule_for_later')}</Label>
        </div>

        {broadcast.scheduledAt && (
          <DateTimePicker
            value={new Date(broadcast.scheduledAt)}
            onChange={(date) =>
              setBroadcast({ ...broadcast, scheduledAt: date.getTime() })
            }
          />
        )}

        {/* Summary */}
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm">
            {t('broadcast_summary', {
              count: estimatedRecipients,
              type: broadcast.targetType,
            })}
          </p>
          {broadcast.targetType !== 'group' && (
            <p className="text-sm text-muted-foreground mt-1">
              {t('includes_sms_contacts', { count: 0 })}
            </p>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button variant="outline">{t('save_draft')}</Button>
        <Button
          onClick={handleSend}
          variant={broadcast.priority === 'emergency' ? 'destructive' : 'default'}
        >
          {broadcast.scheduledAt ? t('schedule') : t('send_now')}
        </Button>
      </CardFooter>
    </Card>
  );
}
```

### 4.4 Broadcast Delivery

```typescript
class BroadcastDeliveryManager {
  async sendBroadcast(broadcast: Broadcast): Promise<void> {
    const recipients = await this.resolveRecipients(broadcast);

    // Update status
    await this.updateBroadcast(broadcast.id, { status: 'sending' });

    // Group by delivery method
    const buildItRecipients = recipients.filter(r => r.type === 'buildit');
    const smsRecipients = recipients.filter(r => r.type === 'sms');

    // Send to BuildIt users (E2EE)
    await this.sendToBuildIt(broadcast, buildItRecipients);

    // Send to SMS contacts (not encrypted)
    if (smsRecipients.length > 0) {
      await this.sendToSMS(broadcast, smsRecipients);
    }

    // Public channel
    if (broadcast.targetType === 'public-channel') {
      await this.postToNostrChannel(broadcast);
    }

    // Update analytics
    await this.updateBroadcast(broadcast.id, {
      status: 'sent',
      sentAt: Date.now(),
      analytics: {
        totalRecipients: recipients.length,
        delivered: recipients.length,  // Initial, updates as delivered
        read: 0,
        replied: 0,
      },
    });
  }

  private async sendToBuildIt(
    broadcast: Broadcast,
    recipients: Recipient[]
  ): Promise<void> {
    // For group broadcast, use single encrypted group message
    if (broadcast.targetType === 'group' && broadcast.targetIds?.length === 1) {
      await this.sendGroupMessage(broadcast.targetIds[0], {
        type: 'broadcast',
        content: broadcast.content,
        attachments: broadcast.attachments,
        priority: broadcast.priority,
        broadcastId: broadcast.id,
      });
      return;
    }

    // For contact list, send individual NIP-17 messages
    // (batched for performance)
    const batchSize = 50;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      await Promise.all(
        batch.map(r => this.sendDirectMessage(r.pubkey, {
          type: 'broadcast',
          content: broadcast.content,
          attachments: broadcast.attachments,
          priority: broadcast.priority,
          broadcastId: broadcast.id,
        }))
      );
    }
  }

  private async sendToSMS(
    broadcast: Broadcast,
    recipients: Recipient[]
  ): Promise<void> {
    // Rate limit: 1 SMS per second to avoid carrier blocking
    for (const recipient of recipients) {
      await this.smsManager.send(recipient.phone!, broadcast.content);
      await this.delay(1000);
    }
  }
}
```

---

## Part 5: Analytics & Reporting

### 5.1 Hotline Metrics Dashboard

```typescript
interface HotlineMetrics {
  // Thread metrics
  totalThreads: number;
  openThreads: number;
  avgResponseTime: number;    // Seconds
  avgResolutionTime: number;  // Seconds

  // Volume
  threadsToday: number;
  threadsByHour: { hour: number; count: number }[];
  threadsByCategory: { category: string; count: number }[];

  // Channel breakdown
  byChannel: {
    buildit: number;
    sms: number;
    voice: number;  // If using voice hotline too
  };

  // Operator performance
  operatorStats: {
    pubkey: string;
    threadsHandled: number;
    avgResponseTime: number;
    satisfaction?: number;  // If feedback collected
  }[];
}

function HotlineAnalyticsDashboard({ hotlineId }: { hotlineId: string }) {
  const { metrics, isLoading } = useHotlineMetrics(hotlineId);

  return (
    <div className="space-y-6">
      {/* Key metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label={t('open_threads')}
          value={metrics.openThreads}
          icon={<MessageCircle />}
        />
        <MetricCard
          label={t('avg_response_time')}
          value={formatDuration(metrics.avgResponseTime)}
          icon={<Clock />}
          trend={metrics.avgResponseTime < 300 ? 'good' : 'bad'}
        />
        <MetricCard
          label={t('threads_today')}
          value={metrics.threadsToday}
          icon={<TrendingUp />}
        />
        <MetricCard
          label={t('resolution_time')}
          value={formatDuration(metrics.avgResolutionTime)}
          icon={<CheckCircle />}
        />
      </div>

      {/* Volume chart */}
      <Card>
        <CardHeader>
          <CardTitle>{t('volume_by_hour')}</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart data={metrics.threadsByHour} />
        </CardContent>
      </Card>

      {/* Channel breakdown */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t('by_channel')}</CardTitle>
          </CardHeader>
          <CardContent>
            <PieChart
              data={[
                { label: 'BuildIt', value: metrics.byChannel.buildit },
                { label: 'SMS', value: metrics.byChannel.sms },
                { label: 'Voice', value: metrics.byChannel.voice },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('by_category')}</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={metrics.threadsByCategory} horizontal />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## Part 6: Integration with Existing Systems

### 6.1 CRM Integration

```typescript
// Link messaging threads to CRM contacts

class CRMIntegration {
  async linkThreadToContact(threadId: string, contactId: string): Promise<void> {
    await this.updateThread(threadId, {
      linkedContactId: contactId,
    });

    // Add activity to contact timeline
    await this.crm.addActivity(contactId, {
      type: 'hotline-message',
      threadId,
      timestamp: Date.now(),
    });
  }

  async createContactFromThread(threadId: string): Promise<string> {
    const thread = await this.getThread(threadId);

    const contact = await this.crm.createContact({
      name: thread.contactName,
      phone: thread.contactPhone,
      pubkey: thread.contactPubkey,
      source: 'hotline',
      sourceThreadId: threadId,
    });

    await this.linkThreadToContact(threadId, contact.id);

    return contact.id;
  }
}
```

### 6.2 Voice Hotline Integration

```typescript
// Seamless transition between messaging and voice

class ChannelEscalation {
  async escalateToVoice(threadId: string): Promise<string> {
    const thread = await this.getThread(threadId);

    if (!thread.contactPubkey) {
      throw new Error('Cannot call SMS-only contact');
    }

    // Create voice call
    const call = await this.voiceHotline.initiateCall({
      hotlineId: thread.hotlineId,
      callerPubkey: thread.contactPubkey,
      callerName: thread.contactName,
      operatorPubkey: thread.assignedOperator,
      linkedThreadId: threadId,
    });

    // Update thread
    await this.updateThread(threadId, {
      linkedCallId: call.id,
    });

    // Add system message
    await this.addSystemMessage(threadId, {
      content: t('escalated_to_voice_call'),
    });

    return call.id;
  }

  async deescalateToMessaging(callId: string): Promise<string> {
    const call = await this.voiceHotline.getCall(callId);

    // Find or create thread
    let thread = await this.findThreadByPubkey(
      call.callerPubkey,
      call.hotlineId
    );

    if (!thread) {
      thread = await this.createThread({
        hotlineId: call.hotlineId,
        contactPubkey: call.callerPubkey,
        contactName: call.callerName,
        assignedOperator: call.takenBy,
        status: 'active',
      });
    }

    // Link call to thread
    await this.updateThread(thread.id, {
      linkedCallId: callId,
    });

    // Add system message
    await this.addSystemMessage(thread.id, {
      content: t('continued_from_voice_call'),
    });

    return thread.id;
  }
}
```

---

## Implementation Tasks

### Phase 1: Messaging Hotline Core
- [ ] Thread data model and schema
- [ ] Message storage (NIP-17 based)
- [ ] Operator inbox UI
- [ ] Thread assignment system

### Phase 2: Operator Experience
- [ ] Conversation view component
- [ ] Canned responses/templates
- [ ] Thread transfer between operators
- [ ] Quick actions and keyboard shortcuts

### Phase 3: SMS Bridge
- [ ] Twilio SMS webhook handler
- [ ] Outbound SMS sending
- [ ] Phone number management
- [ ] SMS usage tracking

### Phase 4: Broadcasts
- [ ] Broadcast composer UI
- [ ] Recipient resolution
- [ ] Delivery system
- [ ] Scheduling

### Phase 5: Analytics
- [ ] Metrics collection
- [ ] Dashboard components
- [ ] Export/reporting

### Phase 6: Integration
- [ ] CRM contact linking
- [ ] Voice hotline handoff
- [ ] Unified operator dashboard

---

## Success Criteria

- [ ] Users can message hotlines directly in BuildIt
- [ ] Operators have efficient inbox/thread management
- [ ] SMS bridge sends/receives texts
- [ ] Broadcasts reach all intended recipients
- [ ] BuildIt-to-BuildIt messaging is E2EE
- [ ] Clear privacy warnings for SMS

## Open Questions

1. **RCS timeline**: When will RCS support be worth implementing?
2. **MMS support**: Should SMS bridge support images?
3. **Broadcast limits**: Rate limits to prevent spam?
4. **Template approval**: Should templates require admin approval?
5. **Auto-responses**: Allow bots/auto-responders?
