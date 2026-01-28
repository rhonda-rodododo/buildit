# Calling Integration: Volunteer Roles

## Overview

The Forms ↔ Calling integration enables volunteer signup for roles that require calling capabilities. When volunteers sign up for hotline operator or dispatcher positions, the system checks training requirements and automatically grants hotline access upon confirmation.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Volunteer Role Definition                     │
│  Role: "Hotline Operator"                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Requirements:                                            │    │
│  │ - Training completed: "Jail Support Protocol" ✓         │    │
│  │ - Training completed: "De-escalation" ✓                 │    │
│  │ - Calling access: "hotline:jail-support"                │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Volunteer Signup Flow                         │
│  1. Volunteer signs up via form                                  │
│  2. System checks training requirements                          │
│  3. If requirements met: Auto-grant hotline access               │
│  4. If not: Show required trainings to complete                  │
│  5. Add to operator pool for selected shifts                     │
└─────────────────────────────────────────────────────────────────┘
```

## Volunteer Calling Roles

```typescript
type VolunteerCallingRole =
  | 'hotline-operator'    // Answers hotline calls
  | 'dispatcher'          // Dispatches calls to operators
  | 'medic'               // Medical response coordinator
  | 'coordinator'         // Event/action coordinator
  | 'lead';               // Team lead with elevated access
```

## Enhanced Volunteer Role

```typescript
interface EventVolunteerRole {
  id: string;
  eventId: string;
  name: string;
  description?: string;
  spotsNeeded: number;
  spotsFilled: number;
  requiredTrainings?: string[];      // Training course IDs
  shiftStart?: number;
  shiftEnd?: number;
  created: number;
  createdBy: string;

  // Calling requirements
  callingRoleRequired?: VolunteerCallingRole;
  hotlineAccess?: string[];          // Hotline IDs to grant access to
  requiresPSTN?: boolean;            // Whether role needs PSTN access
}
```

## Requirements Checking

```typescript
interface TrainingRequirementStatus {
  courseId: string;
  courseName: string;
  required: boolean;
  met: boolean;
  certificationExpired?: boolean;
  expiresAt?: number;
}

interface VolunteerRequirementsResult {
  met: boolean;
  missingTrainings: TrainingRequirementStatus[];
  missingCallingAccess: boolean;
  callingRoleRequired?: VolunteerCallingRole;
  message?: string;
}
```

## VolunteerCallingIntegration Service

```typescript
class VolunteerCallingIntegration {
  // Check if volunteer meets requirements
  async checkRequirements(
    contactId: string,
    pubkey: string,
    role: EventVolunteerRole
  ): Promise<VolunteerRequirementsResult>;

  // Grant hotline access on signup confirmation
  async grantHotlineAccess(
    contactId: string,
    pubkey: string,
    hotlineIds: string[],
    role: VolunteerCallingRole,
    grantedBy: string
  ): Promise<void>;

  // Revoke hotline access
  async revokeHotlineAccess(
    pubkey: string,
    hotlineId: string,
    reason?: string
  ): Promise<void>;

  // Add to operator pool for shifts
  async addToOperatorPool(
    contactId: string,
    pubkey: string,
    hotlineId: string,
    shifts: ShiftConfig[]
  ): Promise<void>;

  // Remove from operator pool
  async removeFromOperatorPool(
    pubkey: string,
    hotlineId: string,
    shiftIds?: string[]
  ): Promise<void>;

  // Get operators for a hotline
  getHotlineOperators(hotlineId: string): OperatorPoolEntry[];

  // Get available operators for a time slot
  getAvailableOperators(
    hotlineId: string,
    time: number
  ): OperatorPoolEntry[];

  // Process signup confirmation
  async processSignupConfirmation(
    signup: EventVolunteerSignup,
    role: EventVolunteerRole,
    confirmedBy: string
  ): Promise<{ accessGranted: boolean; message: string }>;
}
```

## Shift Configuration

```typescript
interface ShiftConfig {
  hotlineId: string;
  startTime: number;
  endTime: number;
  role: VolunteerCallingRole;
  isRecurring?: boolean;
  recurringPattern?: 'daily' | 'weekly' | 'monthly';
}
```

## Operator Pool Entry

```typescript
interface OperatorPoolEntry {
  pubkey: string;
  contactId: string;
  hotlineId: string;
  role: VolunteerCallingRole;
  shifts: ShiftConfig[];
  addedAt: number;
  addedBy: string;
  status: 'active' | 'inactive' | 'suspended';
}
```

## Signup Flow

### 1. Role Selection

Volunteer selects a role with calling requirements:
- Role name and description displayed
- Required trainings listed
- Shift times shown
- Hotline info if applicable

### 2. Requirements Check

System verifies:
- All required training certifications
- Certifications not expired
- Previous calling access (if any)

### 3. Confirmation Handling

On signup confirmation:
```typescript
async processSignupConfirmation(signup, role, confirmedBy) {
  // Check requirements
  const requirements = await checkRequirements(
    signup.contactId,
    signup.contactPubkey,
    role
  );

  if (!requirements.met) {
    return {
      accessGranted: false,
      message: requirements.message
    };
  }

  // Grant hotline access
  if (role.hotlineAccess && role.callingRoleRequired) {
    await grantHotlineAccess(
      signup.contactId,
      signup.contactPubkey,
      role.hotlineAccess,
      role.callingRoleRequired,
      confirmedBy
    );
  }

  // Add to operator pool for shifts
  if (role.shiftStart && role.shiftEnd) {
    await addToOperatorPool(
      signup.contactId,
      signup.contactPubkey,
      role.hotlineAccess[0],
      [{ startTime: role.shiftStart, endTime: role.shiftEnd, ... }]
    );
  }

  return { accessGranted: true, message: 'Access granted' };
}
```

## UI Considerations

### Role Configuration Form

When creating volunteer roles:
- Toggle "Requires Calling Access"
- Select calling role type
- Select hotlines to grant access to
- Add training requirements
- Configure shift times

### Volunteer Signup Form

When signing up:
- Display training requirements
- Show completion status
- Link to incomplete trainings
- Disable signup if requirements not met

### Confirmation Workflow

When confirming signups:
- Show requirements status
- Confirm access will be granted
- Display shift schedule
- Send confirmation notification

## Notifications

| Event | Notification |
|-------|--------------|
| Signup submitted | "Signup received - pending confirmation" |
| Requirements not met | "Complete required trainings: [list]" |
| Signup confirmed | "Confirmed! You now have hotline access" |
| Shift reminder | "Your hotline shift starts in 1 hour" |

## Security Considerations

- Access granted only after explicit confirmation
- Training certifications verified against expiration
- Access automatically revoked if signup declined
- Audit log for access grants/revocations
- Role-based access levels (operator vs dispatcher vs lead)
