 Privacy & Security

## Threat Model

### Adversaries
1. **State surveillance**: Mass metadata collection, targeted monitoring
2. **Device seizure**: Physical access to devices
3. **Legal pressure**: Subpoenas, relay operator coercion
4. **Infiltration**: Bad actors joining groups
5. **Network analysis**: Social graph reconstruction

### Assets to Protect
- User identities and associations
- Message content
- Group membership
- Event attendance
- Voting records
- Contact databases

## Security Architecture

### Data Classification

**Public (Nostr events)**
- Profile metadata
- Public posts
- Public event announcements
- Stored unencrypted on relays

**Encrypted (NIP-17)**
- Direct messages
- Group messages
- Private events
- Voting ballots
- CRM data
- Encrypted before sending to relays

**Local-only**
- Private keys
- Personal notes
- Cached decrypted data
- Never leaves device

### Encryption Scheme

**Key Derivation**
```
User Master Key (from nostr nsec)
  ↓
Group Key = HKDF(master, group_id, "group-key")
  ↓
Message Key = HKDF(group_key, nonce, "message")
```

**Group Encryption Flow**
1. Generate random nonce
2. Derive message key from group key + nonce
3. Encrypt with XChaCha20-Poly1305
4. Publish encrypted blob to Nostr
5. Only group members can derive keys to decrypt

### Metadata Protection

**Measures**
- Message timing obfuscation (random delays)
- Batch message sending
- Tor integration for IP protection
- Relay rotation
- Encrypted group membership lists

**Limitations**
- Relay operators see: timestamps, sender pubkey, event size
- Traffic analysis can reveal: message volume, timing patterns
- Social graphs partially visible through public interactions

## Operational Security

### For Regular Members

**Device Security**
- Use full-disk encryption
- Strong device passwords/biometrics
- Regular OS updates
- Trusted devices only

**Key Management**
- Backup keys securely offline
- Use password managers
- Consider hardware wallets for high-security groups

**Communication Hygiene**
- Verify identities out-of-band for sensitive groups
- Be cautious about metadata (don't discuss sensitive topics near events)
- Use separate identities for different risk levels

### For Group Administrators

**Group Setup**
- Choose appropriate privacy level per module
- Configure member permissions carefully
- Regular member audits
- Document security policies

**Incident Response**
- Plan for device seizure scenarios
- Key rotation procedures
- Member removal protocols
- Communication chain if primary channel compromised

### For High-Risk Organizing

**Additional Measures**
- Mandatory Tor usage
- Anonymous voting only
- Time-limited event location disclosure
- Separate identities per campaign
- Regular key rotation
- Hardware wallet requirement
- Out-of-band identity verification

**Avoid**
- Discussing illegal activities on platform
- Storing sensitive plans long-term
- Using real names/locations unnecessarily
- Trusting new members immediately

## Technical Mitigations

### Built-in Protections
✓ E2E encryption prevents relay snooping
✓ Decentralized relays (no single point of failure)
✓ Local-first storage (keys never sent)
✓ Zero-knowledge relay architecture
✓ Optional Tor integration

### User Responsibilities
⚠ Device security and physical safety
⚠ Key backup and recovery
⚠ OPSEC practices and discipline
⚠ Social engineering awareness
⚠ Regular security audits

## Compliance & Legal

### What We Can't Protect Against
- Compromised devices (keyloggers, screen capture)
- Physical coercion (rubber-hose cryptanalysis)
- Social engineering and infiltration
- Comprehensive surveillance (if you're a target)
- Legal compulsion in hostile jurisdictions

### Legal Considerations
- Encryption may be illegal/restricted in some regions
- Check local laws before deployment
- Consult legal experts for high-risk contexts
- No platform provides absolute protection

## Recommendations by Risk Level

### Low Risk (Public advocacy, mutual aid)
- Standard encryption sufficient
- Public profiles okay
- Focus on usability

### Medium Risk (Workplace organizing, local activism)
- Use pseudonyms
- Separate identity per group
- Enable all privacy features
- Regular security reviews

### High Risk (Direct action, repressive contexts)
- Mandatory Tor usage
- Hardware wallets required
- Anonymous identities only
- Time-limited sensitive data
- Additional out-of-band protocols
- Professional security consultation

---

**Remember**: No technology is 100% secure. This platform provides strong protections but requires proper operational security from users. High-risk activities need additional safeguards beyond what any app can provide.