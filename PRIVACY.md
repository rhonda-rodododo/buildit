# Privacy & Security

**Version**: 0.30.0
**Last Updated**: 2025-10-07
**Status**: Production-Ready for Security Audit

## Table of Contents

1. [Threat Model](#threat-model)
2. [Security Architecture](#security-architecture)
3. [Operational Security](#operational-security)
4. [Technical Mitigations](#technical-mitigations)
5. [Compliance & Legal](#compliance--legal)
6. [Risk Recommendations](#recommendations-by-risk-level)

---

## Threat Model

### Adversaries

#### 1. State Surveillance (High Capability)
**Capabilities**:
- Mass metadata collection (NSA, GCHQ style)
- Targeted monitoring of individuals/groups
- Relay operator coercion via legal process
- Traffic analysis at ISP/backbone level
- International data sharing (Five Eyes, etc.)

**Attack Vectors**:
- Passive network observation
- Relay compromise or legal compulsion
- Traffic correlation across multiple relays
- Timing analysis of message patterns
- Social graph reconstruction from public events

**Mitigation**:
- NIP-17 metadata protection (ephemeral keys, timestamp randomization)
- End-to-end encryption (relays see ciphertext only)
- Tor integration option (hides IP address)
- Multiple relay usage (no single point of observation)
- Operational security guidance for high-risk users

**Effectiveness**: Moderate (metadata partially visible, content protected)

#### 2. Device Seizure (Physical Access)
**Capabilities**:
- Full device access (post-arrest, border crossing)
- Forensic data extraction
- Cold boot attacks (if device powered on)
- Brute force password/PIN attacks
- Biometric bypass (depends on implementation)

**Attack Vectors**:
- Keys stored in IndexedDB (accessible with device access)
- Cached decrypted messages in memory/disk
- Browser history and local storage
- System backups (iCloud, Google Drive)

**Mitigation**:
- Device encryption (full-disk encryption)
- Strong device password/passphrase
- Biometric lock (fingerprint/face recognition)
- Key derivation from password (future: PBKDF2)
- WebAuthn-protected keys (future: requires biometric to decrypt)
- Data wipe after failed unlock attempts (OS-level)

**Effectiveness**: Low (once device accessed, keys are readable)

**Recommendation**: High-risk users should use separate devices, hardware wallets, or encrypted backups only.

#### 3. Legal Pressure (Relay Operators, Service Providers)
**Capabilities**:
- Subpoena relay operators for stored data
- National Security Letters (NSLs) in US
- Data retention mandates (EU, other jurisdictions)
- Gag orders preventing disclosure
- International legal cooperation (MLAT)

**Attack Vectors**:
- Relay logs (if kept) - IPs, timestamps, event metadata
- Service provider cooperation (if using hosted relays)
- Payment records (if using paid services)

**Mitigation**:
- Use community-run relays (no logs policy)
- Relay rotation and redundancy
- Zero-knowledge relay architecture (encrypted content)
- Tor usage (hides IP from relay)
- Cryptocurrency payments (if needed)

**Effectiveness**: High (E2E encryption means relays can't access content)

#### 4. Infiltration (Bad Actors in Groups)
**Capabilities**:
- Join groups with fake identity
- Access all group content (if admitted)
- Screenshot/copy sensitive information
- Social engineering and manipulation
- Leak information to adversaries

**Attack Vectors**:
- Open groups with no vetting
- Social engineering to gain trust
- Long-term undercover operations
- Insider threats (members turning informant)

**Mitigation**:
- Invitation-only groups with vetting
- Out-of-band identity verification
- Permission-based access controls
- Time-limited event location disclosure
- Regular member audits
- Operational security training

**Effectiveness**: Low (technical measures can't prevent trusted insider threats)

**Recommendation**: Vetting and operational security are critical.

#### 5. Network Analysis (Traffic Patterns)
**Capabilities**:
- Analyze message timing and frequency
- Correlate activity across multiple relays
- Identify communication patterns
- Build social graphs from public interactions
- Deanonymize users via timing attacks

**Attack Vectors**:
- Message timing correlation (even with randomization)
- Message size patterns (short vs. long messages)
- Activity bursts (coordinated action planning)
- Public profile associations (follows, likes)

**Mitigation**:
- Timestamp randomization (±2 days in NIP-17)
- Message batching and padding (future)
- Tor usage (breaks timing correlation)
- Dummy traffic generation (future)
- Separate identities per context

**Effectiveness**: Moderate (some patterns still visible)

#### 6. Supply Chain Attacks (Software Compromise)
**Capabilities**:
- Malicious JavaScript in dependencies
- Compromised CDNs or NPM packages
- Build pipeline manipulation
- Browser extension malware
- Man-in-the-middle attacks (if no HTTPS)

**Attack Vectors**:
- Dependency vulnerabilities (see DEPENDENCIES.md)
- XSS attacks on web application
- Malicious browser extensions reading localStorage/IndexedDB
- Compromised build artifacts

**Mitigation**:
- Subresource Integrity (SRI) for CDN assets
- Content Security Policy (CSP) - see vite.config.ts
- Regular dependency audits (`bun audit`)
- Code signing for builds
- Open-source transparency (public code review)

**Effectiveness**: Moderate (web apps inherently vulnerable to JavaScript attacks)

**Recommendation**: High-security users should audit source code and self-host.

---

### Assets to Protect

#### Critical Assets (Compromise = Catastrophic)
1. **Private Keys**
   - Risk: Full identity compromise, message decryption
   - Storage: IndexedDB (browser-sandboxed)
   - Protection: Device encryption, future password/WebAuthn protection

2. **Group Encryption Keys**
   - Risk: All group messages decryptable
   - Storage: Derived from private key + group ID
   - Protection: Same as private keys

#### High-Value Assets (Compromise = Severe)
3. **Message Content**
   - Risk: Surveillance, legal exposure, social harm
   - Protection: NIP-44/NIP-17 encryption, E2E encrypted
   - Visibility: Encrypted at rest on relays and in local DB

4. **Group Membership Lists**
   - Risk: Association with high-risk groups, social graph
   - Protection: Encrypted storage, not published publicly
   - Visibility: Group admins only

5. **Voting Records**
   - Risk: Retaliation for voting positions
   - Protection: Anonymous ballots (optional identity verification)
   - Visibility: Aggregated results only

6. **Event Attendance (High-Risk Events)**
   - Risk: Arrest, surveillance, harassment
   - Protection: Direct-action privacy level, time-limited disclosure
   - Visibility: Private invite-only RSVPs

7. **Contact Databases (CRM)**
   - Risk: Membership lists, organizer networks exposed
   - Protection: Encrypted fields, group-scoped access
   - Visibility: Group admins with CRM permission

#### Medium-Value Assets (Compromise = Moderate)
8. **User Identities and Associations**
   - Risk: Pseudonym linking, social graph analysis
   - Protection: Separate identities per context
   - Visibility: Public profiles visible, private associations hidden

9. **Event Metadata**
   - Risk: Planning patterns, activity timing
   - Protection: Timestamp randomization, private events
   - Visibility: Public events visible, private events encrypted

10. **Message Metadata**
    - Risk: Communication patterns, social network
    - Protection: NIP-17 ephemeral keys, timestamp randomization
    - Visibility: Partial (recipient visible, sender hidden)

---

### Attack Scenarios

#### Scenario 1: Mass Surveillance
**Adversary**: State-level intelligence agency (NSA, FSB, MSS)

**Attack**:
1. Monitor all traffic to/from known Nostr relays
2. Collect encrypted messages and metadata
3. Perform traffic analysis and social graph reconstruction
4. Store encrypted data for future decryption (post-quantum threat)

**Impact**:
- Social graphs partially revealed (who talks to whom)
- Activity timing patterns visible
- Encrypted content stored (future decryption risk)

**Defenses**:
- ✅ E2E encryption (content protected)
- ✅ NIP-17 metadata protection (sender anonymity)
- ⚠️ Timestamp randomization (some timing patterns remain)
- ⚠️ Tor integration (hides IP, breaks correlation)
- ❌ No post-quantum encryption (future risk)

**Residual Risk**: Medium (metadata partially visible)

#### Scenario 2: Targeted Investigation
**Adversary**: Law enforcement with warrant/subpoena

**Attack**:
1. Subpoena relay operators for user's message data
2. Seize user's device
3. Extract IndexedDB and localStorage
4. Decrypt messages with recovered private key

**Impact**:
- All messages readable (if device accessed)
- Group memberships revealed
- Contact lists exposed
- Past and future messages compromised (no forward secrecy)

**Defenses**:
- ✅ Device encryption (requires password)
- ⚠️ Strong device password (depends on user)
- ❌ No forward secrecy (all messages compromised)
- ❌ Keys in plaintext in IndexedDB (with device access)

**Residual Risk**: High (device access = full compromise)

#### Scenario 3: Group Infiltration
**Adversary**: Undercover officer or informant

**Attack**:
1. Gain trust and join organizing group
2. Access all group communications
3. Screenshot/copy sensitive information
4. Report to law enforcement or leak publicly

**Impact**:
- All group content exposed (to infiltrator)
- Member identities known
- Planning documents visible
- Trust within group damaged

**Defenses**:
- ⚠️ Invitation-only groups (depends on vetting)
- ⚠️ Out-of-band identity verification (depends on process)
- ⚠️ Permission controls (limits damage)
- ❌ No technical protection against insider threats

**Residual Risk**: High (technical measures insufficient)

#### Scenario 4: Supply Chain Compromise
**Adversary**: Malicious actor compromising dependency

**Attack**:
1. Inject malicious code into popular NPM package
2. Code exfiltrates private keys to attacker server
3. Attacker gains access to all user keys
4. Can decrypt all past and future messages

**Impact**:
- Mass key compromise
- All users affected
- All encrypted data decryptable

**Defenses**:
- ✅ Dependency audits (npm audit, Snyk)
- ✅ Content Security Policy (blocks unauthorized network requests)
- ⚠️ Subresource Integrity (for CDN assets)
- ⚠️ Code signing (build verification)
- ❌ Inherent to web app model

**Residual Risk**: Medium (regular audits + CSP mitigate)

---

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

**See [ENCRYPTION_IMPLEMENTATION.md](./docs/ENCRYPTION_IMPLEMENTATION.md) for complete technical details.**

### Metadata Protection

**Measures**
- Message timing obfuscation (random delays ±2 days)
- Batch message sending
- Tor integration for IP protection
- Relay rotation
- Encrypted group membership lists
- Ephemeral keys (NIP-17 gift wrap)

**Limitations**
- Relay operators see: timestamps (randomized), sender pubkey (ephemeral), event size
- Traffic analysis can reveal: message volume, timing patterns (partially)
- Social graphs partially visible through public interactions

**Effectiveness**:
- ✅ Excellent for content confidentiality
- ✅ Good for sender anonymity (NIP-17)
- ⚠️ Moderate for timing pattern protection
- ⚠️ Limited for social graph protection (public interactions visible)

---

## Operational Security

### For Regular Members

**Device Security**
- ✅ Use full-disk encryption
- ✅ Strong device passwords/biometrics
- ✅ Regular OS updates
- ✅ Trusted devices only
- ⚠️ Disable cloud backups for sensitive data
- ⚠️ Use screen lock with short timeout

**Key Management**
- ✅ Backup keys securely offline (paper wallet, encrypted USB)
- ✅ Use password managers for nsec storage
- ⚠️ Consider hardware wallets for high-security groups (NIP-46)
- ❌ Never share private keys or nsec
- ❌ Never screenshot keys

**Communication Hygiene**
- ✅ Verify identities out-of-band for sensitive groups
- ✅ Be cautious about metadata (don't discuss sensitive topics near events)
- ✅ Use separate identities for different risk levels
- ⚠️ Avoid pattern-of-life information in messages
- ⚠️ Use private events for sensitive gatherings

### For Group Administrators

**Group Setup**
- ✅ Choose appropriate privacy level per module
- ✅ Configure member permissions carefully
- ✅ Regular member audits
- ✅ Document security policies
- ⚠️ Vet new members thoroughly
- ⚠️ Use invitation-only for high-risk groups

**Member Management**
- ✅ Remove inactive members promptly
- ✅ Revoke permissions when members leave
- ⚠️ Conduct out-of-band identity verification for admins
- ⚠️ Monitor for suspicious activity
- ❌ Don't discuss sensitive topics in large groups

**Incident Response**
- ✅ Plan for device seizure scenarios
- ✅ Key rotation procedures (if member compromised)
- ✅ Member removal protocols
- ✅ Communication chain if primary channel compromised
- ⚠️ Document incident response procedures
- ⚠️ Conduct security drills

### For High-Risk Organizing

**Additional Measures**
- ✅ Mandatory Tor usage
- ✅ Anonymous voting only
- ✅ Time-limited event location disclosure (share location <24h before)
- ✅ Separate identities per campaign
- ⚠️ Regular key rotation (monthly or after sensitive actions)
- ⚠️ Hardware wallet requirement for key storage
- ⚠️ Out-of-band identity verification (in-person, Signal)
- ⚠️ Burner devices for high-risk actions

**Avoid**
- ❌ Discussing illegal activities on platform (operational security)
- ❌ Storing sensitive plans long-term (use ephemeral messages)
- ❌ Using real names/locations unnecessarily
- ❌ Trusting new members immediately
- ❌ Large groups for sensitive planning (infiltration risk)
- ❌ Pattern-of-life information in profiles

**Legal Considerations**
- ⚠️ Consult with legal counsel for jurisdiction-specific risks
- ⚠️ Know your rights (right to remain silent, lawyer access)
- ⚠️ Have a legal support network (National Lawyers Guild, etc.)
- ⚠️ Document police/state harassment
- ⚠️ Consider warrant canary for relay operators

---

## Technical Mitigations

### Built-in Protections

✅ **End-to-End Encryption**
- NIP-44 for content encryption (ChaCha20-Poly1305)
- NIP-17 for metadata protection (gift wrap)
- AES-GCM for media files
- Prevents relay snooping and man-in-the-middle attacks

✅ **Decentralized Relays**
- No single point of failure
- Multiple relay support
- Community-run relays with no-logs policies
- Relay rotation for metadata protection

✅ **Local-First Storage**
- Private keys never sent to server
- All sensitive data encrypted at rest
- IndexedDB sandboxed per-origin
- No cloud storage dependencies

✅ **Zero-Knowledge Architecture**
- Relays cannot read encrypted content
- Ephemeral keys hide sender identity
- Timestamp randomization prevents correlation
- No server-side key storage

✅ **Optional Tor Integration**
- Hides IP address from relays
- Breaks traffic correlation
- SOCKS5 proxy support
- .onion relay support

✅ **Content Security Policy (CSP)**
- Blocks unauthorized script execution (XSS protection)
- Prevents data exfiltration
- Whitelisted domains only
- See vite.config.ts for implementation

✅ **Rate Limiting**
- Prevents brute force attacks on authentication
- Limits sensitive operations (key export, etc.)
- See src/lib/rateLimit.ts

✅ **Session Timeout**
- Auto-lock after inactivity
- Clears sensitive data from memory
- See src/lib/sessionTimeout.ts

### User Responsibilities

⚠️ **Device Security and Physical Safety**
- Use strong device passwords
- Enable full-disk encryption
- Physical security of devices
- Awareness of surveillance (cameras, microphones)

⚠️ **Key Backup and Recovery**
- Securely backup private keys (offline, encrypted)
- Test recovery process before needed
- Multiple backup locations (geographically distributed)
- Consider multi-sig or social recovery for groups

⚠️ **OPSEC Practices and Discipline**
- Avoid discussing sensitive topics near events
- Use separate identities per context
- Don't reveal pattern-of-life information
- Vet new group members

⚠️ **Social Engineering Awareness**
- Verify identities out-of-band
- Be skeptical of urgent requests
- Don't trust software updates from unofficial sources
- Watch for phishing attempts

⚠️ **Regular Security Audits**
- Review group memberships periodically
- Audit permissions and access controls
- Check for suspicious activity
- Update software regularly

---

## Compliance & Legal

### What We Can't Protect Against

❌ **Compromised Devices**
- Keyloggers, screen capture malware
- Malicious browser extensions
- Physical device access
- Cold boot attacks (if device on)

❌ **Physical Coercion**
- Rubber-hose cryptanalysis (torture, threats)
- Legal compulsion to decrypt (varies by jurisdiction)
- Biometric bypass (forced fingerprint/face scan)

❌ **Social Engineering and Infiltration**
- Undercover agents in groups
- Members turning informant
- Social manipulation for key disclosure

❌ **Comprehensive State Surveillance**
- If you are a high-value target, assume comprehensive surveillance
- No platform provides absolute protection against nation-states
- Metadata analysis can reveal patterns even with encryption

❌ **Legal Compulsion in Hostile Jurisdictions**
- Forced key disclosure laws (UK, Australia, India)
- National Security Letters with gag orders (US)
- Data retention mandates (EU, others)
- Check local laws before deployment

### Legal Considerations

**Encryption Legality**
- ⚠️ Encryption may be illegal/restricted in some regions
- ⚠️ Check local laws before deployment
- ⚠️ Consult legal experts for high-risk contexts
- ⚠️ No platform provides absolute protection

**Jurisdictional Risks**
- 🇺🇸 **USA**: FISA surveillance, NSLs, Patriot Act
- 🇪🇺 **EU**: GDPR protections, data retention directives
- 🇬🇧 **UK**: Investigatory Powers Act (forced decryption)
- 🇦🇺 **Australia**: Assistance and Access Act (backdoor requirements)
- 🇨🇳 **China**: Great Firewall, VPN restrictions, encryption control
- 🇷🇺 **Russia**: SORM surveillance, VPN restrictions

**Data Protection Compliance**
- ✅ GDPR: Right to access, right to erasure (export/delete features)
- ✅ CCPA: Data transparency, opt-out rights
- ⚠️ Local data residency requirements (depends on relay location)

**Liability and Legal Risk**
- ⚠️ No warranty of absolute security (see Terms of Service)
- ⚠️ Users responsible for lawful use
- ⚠️ Platform not liable for user actions
- ⚠️ Consult legal counsel for high-risk organizing

---

## Recommendations by Risk Level

### Low Risk (Public advocacy, mutual aid)
**Use Case**: Community organizing, public campaigns, mutual aid networks, educational groups

**Configuration**:
- ✅ Standard encryption sufficient (NIP-17)
- ✅ Public profiles okay
- ✅ Focus on usability over security
- ⚠️ Basic OPSEC training recommended

**Threat Model**: Minimal surveillance risk, public activities

**Recommended Setup**:
- Public or group-level events
- Open group memberships
- Standard device security
- Regular key backups

### Medium Risk (Workplace organizing, local activism)
**Use Case**: Union organizing, tenant unions, local activism, protest coordination

**Configuration**:
- ✅ Use pseudonyms (not real names)
- ✅ Separate identity per group
- ✅ Enable all privacy features
- ✅ Regular security reviews
- ⚠️ Invitation-only groups
- ⚠️ Vet new members

**Threat Model**: Possible surveillance, employer retaliation, local law enforcement interest

**Recommended Setup**:
- Private groups with vetting
- Anonymous voting for sensitive decisions
- Device encryption and strong passwords
- Tor optional but recommended
- Regular member audits

### High Risk (Direct action, repressive contexts)
**Use Case**: Direct action planning, high-risk organizing in authoritarian contexts, whistleblowing

**Configuration**:
- ✅ Mandatory Tor usage
- ✅ Hardware wallets required (NIP-46)
- ✅ Anonymous identities only (no PII)
- ✅ Time-limited sensitive data (delete after action)
- ✅ Out-of-band identity verification (in-person, Signal)
- ⚠️ Burner devices for high-risk actions
- ⚠️ Professional security consultation

**Threat Model**: State-level surveillance, targeted investigation, infiltration attempts

**Recommended Setup**:
- Invitation-only groups with strict vetting
- Private events with time-limited location disclosure (<24h)
- Anonymous voting only
- Regular key rotation (monthly)
- Separate devices for high-risk activities
- Legal support network (NLG, etc.)
- Incident response plan documented

**Additional Safeguards**:
- ❌ Never discuss illegal activities on platform
- ❌ No real names, locations, or pattern-of-life info
- ❌ No large groups for sensitive planning (<10 members)
- ✅ Use ephemeral messages (future feature)
- ✅ Multi-sig group keys (future feature)
- ✅ Regular security drills and OPSEC training

---

## References

1. [ENCRYPTION_IMPLEMENTATION.md](./docs/ENCRYPTION_IMPLEMENTATION.md) - Complete technical encryption documentation
2. [KEY_MANAGEMENT.md](./docs/KEY_MANAGEMENT.md) - Key storage and lifecycle management
3. [DEPENDENCIES.md](./docs/DEPENDENCIES.md) - Third-party library security analysis
4. [VULNERABILITY_DISCLOSURE.md](./docs/VULNERABILITY_DISCLOSURE.md) - Responsible disclosure program
5. [NIP-17 Specification](https://github.com/nostr-protocol/nips/blob/master/17.md) - Private direct messages
6. [EFF Surveillance Self-Defense](https://ssd.eff.org/) - Operational security guidance
7. [Security in-a-Box](https://securityinabox.org/) - Digital security for activists

---

**Remember**: No technology is 100% secure. This platform provides strong protections but requires proper operational security from users. High-risk activities need additional safeguards beyond what any app can provide.

**For high-risk organizing, always consult with security professionals and legal counsel.**

**Document Status**: Production-ready, security audit pending
**Last Audit**: None (external audit scheduled - see Epic 30)
**Next Review**: After external security audit completion
