# Training Module: Certifications

## Overview

The certification system awards verifiable credentials when users complete training courses. Certifications can expire, be renewed, and are integrated with the CRM module for tracking volunteer qualifications.

## Certification Lifecycle

```
┌──────────────┐
│   Eligible   │ ← Course completed
└──────┬───────┘
       │ (all required lessons passed)
       ▼
┌──────────────┐
│    Earned    │ ← Certificate issued
└──────┬───────┘
       │ (time passes)
       ▼
┌──────────────┐
│   Expiring   │ ← 30 days before expiry
└──────┬───────┘
       │ (expiry date reached)
       ▼
┌──────────────┐     ┌──────────────┐
│   Expired    │ ←── │   Renewed    │
└──────────────┘     └──────────────┘
       ↑                    │
       └────────────────────┘
         (recomplete course)
```

## Certification Type

```typescript
interface Certification {
  id: string;
  courseId: string;
  pubkey: string;
  earnedAt: number;
  expiresAt?: number;           // Optional expiration
  revokedAt?: number;           // If manually revoked
  revokedBy?: string;
  revokedReason?: string;
  verificationCode: string;     // Unique verification code
  version: number;              // Course version at time of earning
  metadata?: {
    completionTime?: number;    // Total time to complete
    quizAverage?: number;       // Average quiz score
    instructorPubkey?: string;  // If live sessions involved
  };
}
```

## Verification Code

Unique, short code for certificate verification:

```typescript
// Format: XXXX-XXXX-XXXX (12 alphanumeric chars)
function generateVerificationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars
  const segments = 3;
  const segmentLength = 4;
  // ... generation logic
}
```

## Earning Criteria

### Automatic Award

Certification automatically awarded when:

1. All required lessons completed
2. All quizzes passed (above passing score)
3. All assignments submitted (and reviewed if required)
4. All live sessions attended (if applicable)

### Manual Award

Trainers can manually award certification for:
- Prior learning recognition
- External training equivalency
- Assessment-only paths

## Expiration System

### Configuration

```typescript
interface Course {
  // ...
  certificationEnabled: boolean;
  certificationExpiryDays?: number; // null = never expires
}
```

### Expiration Handling

| Days Until Expiry | Action |
|-------------------|--------|
| 30 | Email reminder |
| 14 | In-app notification |
| 7 | Urgent notification |
| 0 | Status → Expired |

### Renewal

Options for renewal:
1. **Recomplete course** - Full course completion again
2. **Refresher quiz** - Pass final assessment only
3. **Attend live session** - Attend a refresh session

## CRM Integration

### TrainingCRMIntegration Service

```typescript
class TrainingCRMIntegration {
  // Add certification to CRM contact
  async addCertificationToContact(
    contactId: string,
    certification: Certification
  ): Promise<void>;

  // Get contact's training status
  async getContactTrainingStatus(
    contactId: string,
    pubkey: string
  ): Promise<ContactTrainingInfo>;

  // Filter contacts by certification
  async filterContactsByCertification(
    courseId: string,
    includeExpired?: boolean
  ): Promise<string[]>;

  // Check training requirements
  async checkTrainingRequirements(
    pubkey: string,
    requiredCourseIds: string[]
  ): Promise<{ met: boolean; requirements: TrainingRequirement[] }>;

  // Get contacts with expiring certifications
  async getContactsWithExpiringCertifications(
    daysThreshold: number
  ): Promise<Array<{ pubkey: string; certification: Certification }>>;
}
```

### Contact Training Info

```typescript
interface ContactTrainingInfo {
  contactId: string;
  pubkey: string;
  enrolledCourses: number;
  completedCourses: number;
  certifications: Certification[];
  certificationsExpiring: Certification[];
  totalTimeSpent: number;
  lastActivity?: number;
}
```

## Volunteer Requirements

Training requirements for volunteer roles:

```typescript
interface TrainingRequirement {
  courseId: string;
  courseName: string;
  required: boolean;
  currentlyMet: boolean;
  certificationExpired?: boolean;
  certificationExpiresAt?: number;
}
```

Example: Hotline Operator Role
```typescript
const hotlineOperatorRequirements = [
  { courseId: 'jail-support', required: true },
  { courseId: 'de-escalation', required: true },
  { courseId: 'opsec-basics', required: true },
];
```

## Certificate Display

### CertificateBadge Component

Displays:
- Course name and completion date
- Expiration status (valid/expiring/expired)
- Verification code
- Print/Download options

### Verification Page

Public verification endpoint:
- Enter verification code
- Shows: Course, Holder (optional), Date, Status
- No login required

## Database Tables

```typescript
// Certifications
trainingCertifications: '++id, courseId, pubkey, earnedAt, expiresAt, verificationCode, [courseId+pubkey]'
```

## API Endpoints (Future)

```
GET  /api/certifications/:code     # Verify certification
GET  /api/certifications/user      # List user's certifications
POST /api/certifications           # Award certification (admin)
PUT  /api/certifications/:id/revoke # Revoke certification
```

## Privacy Considerations

- Verification shows minimal info by default
- Full details require certificate holder's consent
- Bulk verification only for authorized roles
- Revocation reasons kept private
