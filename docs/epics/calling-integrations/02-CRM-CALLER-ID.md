# Calling Integration: CRM Caller ID

## Overview

The CRM ↔ Calling integration provides caller ID lookup during PSTN calls, automatic contact creation for unknown callers, call history tracking, and engagement scoring based on call interactions.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Inbound PSTN Call                             │
│  Phone: +1 (555) 123-4567                                       │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CRM Lookup Service                            │
│  1. Search contacts by phone field                               │
│  2. If found: Show contact card, history, notes                  │
│  3. If not found: Offer to create new contact                    │
│  4. After call: Log interaction, update engagement score         │
└─────────────────────────────────────────────────────────────────┘
```

## Call History Record

```typescript
interface CallHistoryRecord {
  id: string;
  contactId: string;
  direction: 'inbound' | 'outbound';
  phoneNumber: string;
  startedAt: number;
  endedAt?: number;
  duration: number;           // seconds
  status: 'completed' | 'missed' | 'voicemail' | 'failed';
  recordingUrl?: string;
  transcriptUrl?: string;
  notes?: string;
  operatorPubkey?: string;
  hotlineId?: string;
  created: number;
}
```

## Caller Lookup

```typescript
interface CallerLookupResult {
  found: boolean;
  contact?: CRMContact;
  matchedField?: 'phone' | 'mobile' | 'work_phone';
  previousCalls?: number;
  lastCallDate?: number;
}
```

### Phone Number Normalization

Lookup normalizes phone numbers for consistent matching:
- Remove all non-digit characters
- Add country code if missing (US: +1)
- E.164 format: +1XXXXXXXXXX

## CRMCallingIntegration Service

```typescript
class CRMCallingIntegration {
  // Look up contact by phone number
  async lookupByPhone(
    phone: string,
    groupId?: string
  ): Promise<CallerLookupResult>;

  // Create contact from call
  async createContactFromCall(
    data: CreateContactFromCallData,
    groupId: string
  ): Promise<CRMContact>;

  // Log call interaction
  async logCallInteraction(
    contactId: string,
    call: Omit<CallHistoryRecord, 'id' | 'contactId' | 'created'>
  ): Promise<CallHistoryRecord>;

  // Get call history for contact
  async getContactCallHistory(
    contactId: string,
    options?: {
      limit?: number;
      offset?: number;
      direction?: 'inbound' | 'outbound';
      dateFrom?: number;
      dateTo?: number;
    }
  ): Promise<CallHistoryRecord[]>;

  // Update engagement score after call
  async updateEngagementFromCall(
    contactId: string,
    callDuration: number,
    direction: 'inbound' | 'outbound'
  ): Promise<CallEngagementUpdate>;

  // Get call statistics for contact
  async getContactCallStats(contactId: string): Promise<{
    totalCalls: number;
    inboundCalls: number;
    outboundCalls: number;
    totalDuration: number;
    averageDuration: number;
    lastCallDate?: number;
    missedCalls: number;
  }>;

  // Link call recording to contact
  async linkCallRecording(
    contactId: string,
    callId: string,
    recordingUrl: string,
    transcriptUrl?: string
  ): Promise<void>;

  // Add notes to a call
  async addCallNotes(
    contactId: string,
    callId: string,
    notes: string
  ): Promise<void>;
}
```

## UI Components

### CallerInfoPopup

Displays during active calls in the calling interface.

**Known Contact View:**
- Contact avatar and name
- Phone number and email
- Organization (if available)
- Previous call count
- Recent call history (last 3)
- Notes preview
- "View Contact" button

**Unknown Caller View:**
- "Unknown Caller" label
- Phone number
- "Not in CRM" message
- "Create Contact" button

### ContactCallHistory

Tab component for contact detail page showing call history.

Features:
- Call list with direction icons
- Duration and date
- Status badges (completed/missed/voicemail/failed)
- Recording playback button
- Transcript view button
- Notes editing dialog
- Filter by direction
- Pagination

## Engagement Scoring

Call interactions affect contact engagement scores:

| Metric | Points |
|--------|--------|
| Inbound call (completed) | +10 |
| Outbound call (completed) | +5 |
| Per minute of call (max 20) | +2 |
| Missed call | 0 |
| Voicemail left | +3 |

```typescript
interface CallEngagementUpdate {
  contactId: string;
  previousScore: number;
  newScore: number;
  callDuration: number;
  callDirection: 'inbound' | 'outbound';
}
```

## Contact Creation from Call

When creating a contact from an unknown caller:

```typescript
interface CreateContactFromCallData {
  phoneNumber: string;
  name?: string;
  notes?: string;
  hotlineId?: string;
  operatorPubkey?: string;
}
```

Created contact includes:
- Phone number (auto-added)
- Source: "inbound-call"
- Source hotline ID
- First contact date
- Initial notes (if provided)

## Call History Display

### Call Direction Icons
- Inbound: Green phone with incoming arrow
- Outbound: Blue phone with outgoing arrow
- Missed: Red phone with X

### Status Badges
- Completed: Default/green
- Missed: Destructive/red
- Voicemail: Secondary
- Failed: Outline

### Time Formatting
- Today: "2:30 PM"
- Yesterday: "Yesterday"
- This week: "Tuesday"
- Older: "Jan 15"

## i18n Keys

```typescript
calling.callerInfo.unknownCaller
calling.callerInfo.notInCRM
calling.callerInfo.createContact
calling.callerInfo.viewContact
calling.callerInfo.previousCalls
calling.callerInfo.recentCalls
calling.callerInfo.createDialog.title

crm.callHistory.title
crm.callHistory.noHistory
crm.callHistory.inboundCall
crm.callHistory.outboundCall
crm.callHistory.status.completed
crm.callHistory.status.missed
crm.callHistory.status.voicemail
crm.callHistory.status.failed
crm.callHistory.notesDialog.title
```

## Privacy Considerations

- Phone numbers can be masked in display
- Recording access controlled by permissions
- Call notes are private to the group
- Engagement scores not visible to contact
