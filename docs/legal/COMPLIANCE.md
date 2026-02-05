# Regulatory Compliance

**Last Updated: January 2026**

## Overview

BuildIt's privacy-first, local-first architecture inherently addresses many
data protection requirements by design.

## GDPR (EU General Data Protection Regulation)

### Data Controller

For data stored on our relay infrastructure, BuildIt Network acts as a data
processor. Users are the data controllers of their own data.

### Lawful Basis

- **Consent**: Users opt in to relay usage
- **Legitimate interest**: Relay infrastructure for decentralized communication

### Data Subject Rights

| Right | How BuildIt Addresses It |
|-------|--------------------------|
| **Right to access** | All data is stored locally on user devices. Users have direct access. |
| **Right to erasure** | Delete local database. Relay stores only encrypted blobs with no PII. |
| **Right to portability** | Nostr events are portable by protocol design. Export is built-in. |
| **Right to rectification** | Users can update their profile and data locally at any time. |
| **Right to restriction** | Users control what data they share via encryption and relay selection. |

### Data Minimization

Servers store only:
- Encrypted event blobs (Nostr events wrapped in NIP-17 gift wrap)
- Event metadata: public keys, timestamps, event kind numbers
- No personally identifiable information in plaintext

### Data Protection Impact Assessment

Given BuildIt's E2EE architecture, the risk to data subjects from our
processing is minimal. We cannot access message content or personal data.

## CCPA (California Consumer Privacy Act)

BuildIt does not:
- Collect personal information as defined by CCPA
- Sell personal information
- Share personal information for cross-context behavioral advertising

Users with questions about their data may contact: privacy@buildit.network

## Data Breach Notification

In the event of a breach of our relay infrastructure:
- Exposed data would be encrypted event blobs (unreadable without user keys)
- We would notify affected users within 72 hours per GDPR requirements
- The practical impact is minimal due to E2EE architecture

## Contact

Data Protection inquiries: privacy@buildit.network
