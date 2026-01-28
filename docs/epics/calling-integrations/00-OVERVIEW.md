# Calling Integrations Epic

## Overview

This epic covers cross-module integrations that extend the Calling module's capabilities by connecting it with Events, CRM, Forms, and Training modules. These integrations enable hybrid events, caller ID lookup, volunteer management, and live training sessions.

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Calling Module                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ 1:1 Call │ │ Group    │ │ Hotline  │ │ PSTN     │           │
│  │          │ │ Call     │ │ Queue    │ │ Gateway  │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│    Events     │   │     CRM       │   │   Training    │
│  - Virtual    │   │  - Caller ID  │   │  - Live       │
│    events     │   │  - Call       │   │    sessions   │
│  - Hybrid     │   │    history    │   │  - Recording  │
│    attendance │   │  - Engagement │   │    playback   │
└───────────────┘   └───────────────┘   └───────────────┘
        │
        ▼
┌───────────────┐
│    Forms      │
│  - Volunteer  │
│    signups    │
│  - Hotline    │
│    access     │
└───────────────┘
```

## Integration Summary

| Integration | Source Module | Target Module | Purpose |
|-------------|--------------|---------------|---------|
| Events ↔ Calling | Events | Calling | Hybrid/virtual events with video conferencing |
| CRM ↔ Calling | CRM | Calling | Caller ID lookup, call history tracking |
| Forms ↔ Calling | Events/Forms | Calling | Volunteer signup with hotline access |
| Training ↔ Calling | Training | Calling | Live training sessions |

## Files Created

### Events Module
- `integrations/callingIntegration.ts` - EventCallingIntegration service
- `integrations/volunteerCallingIntegration.ts` - VolunteerCallingIntegration service
- `components/VirtualEventConfig.tsx` - Virtual event configuration form
- `components/EventJoinButton.tsx` - Join button for virtual events

### CRM Module
- `integrations/callingIntegration.ts` - CRMCallingIntegration service
- `components/ContactCallHistory.tsx` - Call history tab for contacts

### Calling Module
- `components/CallerInfoPopup.tsx` - CRM contact info during calls

### Training Module
- `integrations/callingIntegration.ts` - TrainingCallingIntegration service
- `integrations/crmIntegration.ts` - TrainingCRMIntegration service
- `integrations/eventsIntegration.ts` - TrainingEventsIntegration service

## Key Features

### 1. Hybrid Events
- Enable video conferencing for event attendees
- Auto-start conference before event
- Track virtual attendance
- Record sessions for later viewing

### 2. CRM Caller ID
- Look up contacts by phone number
- Display contact info during calls
- Create contacts from unknown callers
- Log call interactions

### 3. Volunteer Hotline Access
- Define calling requirements for roles
- Check training prerequisites
- Auto-grant hotline access on confirmation
- Manage operator pool shifts

### 4. Live Training Sessions
- Schedule video training sessions
- Track attendance for completion
- Save recordings for playback
- Integrate with certification system

## Implementation Status

| Integration | Status |
|-------------|--------|
| Events ↔ Calling | Complete |
| CRM ↔ Calling | Complete |
| Forms ↔ Calling | Complete |
| Training ↔ Calling | Complete |

## Related Epics

- [01-EVENTS-VIDEO.md](./01-EVENTS-VIDEO.md) - Virtual/hybrid events
- [02-CRM-CALLER-ID.md](./02-CRM-CALLER-ID.md) - Caller ID and call history
- [03-FORMS-VOLUNTEERS.md](./03-FORMS-VOLUNTEERS.md) - Volunteer calling roles
- [04-TRAINING-LIVE.md](./04-TRAINING-LIVE.md) - Live training sessions

## Dependencies

All integrations require the Calling module to be enabled. Individual integrations also require:

| Integration | Required Modules |
|-------------|-----------------|
| Events Video | Events, Calling |
| CRM Caller ID | CRM, Calling |
| Volunteer Access | Events, Forms, Calling |
| Training Live | Training, Calling |
