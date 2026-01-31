# BuildIt Threat Model

**Version**: 1.0.0
**Last Updated**: 2026-01-25
**Status**: Production-Ready

## Overview

This document provides a detailed threat model for BuildIt, a privacy-first organizing platform designed for activists, unions, co-ops, and community organizers. BuildIt is designed to protect users from sophisticated adversaries including state-level actors such as the Iranian IRGC, Chinese MSS, and Western intelligence agencies.

---

## Adversary Capabilities Matrix

### State-Level Adversaries (NSA, GCHQ, MSS, FSB, IRGC)

| Capability | Level | BuildIt Defense | Effectiveness |
|------------|-------|-----------------|---------------|
| Mass metadata collection | Very High | NIP-17 ephemeral keys, timestamp randomization | Moderate |
| Traffic analysis | Very High | Padding, batching, Tor integration | Moderate |
| Relay coercion | High | Decentralized architecture, E2E encryption | High |
| Device seizure | High | Argon2id KDF, duress passwords, secure destruction | Moderate |
| Cryptanalysis | High | Industry-standard primitives (ChaCha20, secp256k1) | High |
| Social engineering | Medium | Out-of-band verification guidance | Low |
| Quantum computing (future) | Low (growing) | None currently | VULNERABLE |

### Network Attackers

| Capability | Level | BuildIt Defense | Effectiveness |
|------------|-------|-----------------|---------------|
| MITM on relay connections | High | Certificate pinning + TOFU | High |
| DNS poisoning | Medium | Certificate verification | High |
| Traffic injection | Medium | TLS, message authentication | High |
| Passive eavesdropping | High | E2E encryption (NIP-44) | Very High |
| Timing correlation | High | Timestamp randomization (+/- 2 days) | Moderate |

### Physical Attackers

| Capability | Level | BuildIt Defense | Effectiveness |
|------------|-------|-----------------|---------------|
| Device theft (locked) | Medium | OS encryption + strong password | High |
| Device theft (unlocked) | High | Session timeout, auto-lock | Moderate |
| Forensic extraction | High | Memory-hard KDF, key zeroization | Moderate |
| Cold boot attacks | Medium | No specific defense | Low |
| Rubber-hose cryptanalysis | High | Duress password with decoy identity | Moderate |

### Malicious Participants

| Capability | Level | BuildIt Defense | Effectiveness |
|------------|-------|-----------------|---------------|
| Group infiltration | High | Vetting guidance, permissions | Low (social) |
| Screenshot/leaking | High | Operational security guidance | None (technical) |
| Social engineering | High | Identity verification guidance | Low (social) |
| Compromised relays | Medium | E2E encryption, relay rotation | High |

---

## Attack Scenarios and Mitigations

### Scenario 1: Mass Surveillance (Five Eyes / MSS)

**Attack Chain**:
1. Monitor all traffic to known Nostr relay IP addresses
2. Collect encrypted messages and connection metadata
3. Build social graphs from public event interactions
4. Perform timing analysis on message patterns
5. Store data for "harvest now, decrypt later" with quantum computers

**Assets at Risk**:
- Communication patterns (who talks to whom, when)
- Group membership (via observed public events)
- Activity timing (when users are active)
- Encrypted content (future quantum threat)

**BuildIt Defenses**:
| Defense | Implementation | Effectiveness |
|---------|----------------|---------------|
| E2E Encryption | NIP-44 ChaCha20-Poly1305 | Content protected |
| Sender Anonymity | NIP-17 ephemeral keys | Sender hidden from relay |
| Timestamp Obfuscation | +/- 2 day randomization | Timing correlation reduced |
| Tor Integration | SOCKS5 proxy support | IP address hidden |
| Relay Rotation | Multiple relay support | No single observation point |

**Residual Risk**: MODERATE
- Metadata partially visible (message volume, timing patterns)
- Public interactions reveal social connections
- Encrypted data vulnerable to future quantum computers

**Mitigations for High-Risk Users**:
- Mandatory Tor usage
- Separate identities per group
- Message expiration (future feature)
- Avoid public interactions entirely

---

### Scenario 2: Targeted Device Seizure

**Attack Chain**:
1. Arrest user or seize device at border crossing
2. Attempt to compel password disclosure (legal or coercive)
3. If unsuccessful, perform forensic extraction
4. Brute-force attack on encrypted storage
5. Decrypt all messages with recovered keys

**Assets at Risk**:
- Private keys (full identity compromise)
- All encrypted messages (no forward secrecy)
- Contact lists and group memberships
- Voting records and CRM data

**BuildIt Defenses**:
| Defense | Implementation | Effectiveness |
|---------|----------------|---------------|
| Memory-Hard KDF | Argon2id (64MB, 3 iter, 4 parallel) | 50-200ms per attempt |
| Secure Key Storage | Platform keyring/keystore | Hardware-backed where available |
| Duress Password | Decoy identity + key destruction | Plausible deniability |
| Silent Alerts | NIP-17 messages to trusted contacts | Network notified |
| Key Zeroization | Multi-pass secure destruction | Recovery difficult |

**Estimated Brute-Force Resistance** (Argon2id, 64MB):
| Password Strength | Estimated Time (GPU Cluster) |
|-------------------|------------------------------|
| 8 char lowercase | Days |
| 12 char mixed | Years |
| 24 char / BIP-39 24-word | Centuries |

**Residual Risk**: HIGH
- Weak passwords remain vulnerable
- No forward secrecy (past messages compromised)
- Biometric bypass possible (forced fingerprint/face)
- Key material may exist in swap/hibernation files

**Mitigations for High-Risk Users**:
- BIP-39 24-word passphrase
- Hardware wallet (NIP-46)
- Disable biometrics
- Full-disk encryption with separate password
- Burner devices for highest-risk activities

---

### Scenario 3: Relay Operator Coercion

**Attack Chain**:
1. Law enforcement serves subpoena/NSL to relay operator
2. Operator compelled to provide logs and stored events
3. Adversary analyzes connection IPs, timestamps, event metadata
4. Encrypted content forwarded to cryptanalysis team
5. Social graph reconstructed from visible metadata

**Assets at Risk**:
- Connection timestamps and IP addresses (if logged)
- Event metadata visible to relay
- Encrypted message ciphertext

**BuildIt Defenses**:
| Defense | Implementation | Effectiveness |
|---------|----------------|---------------|
| E2E Encryption | NIP-44 | Content unreadable to relay |
| Ephemeral Keys | NIP-17 gift wrap | True sender hidden |
| Timestamp Randomization | +/- 2 days | Timing correlation difficult |
| No-Log Relays | Community-operated relays | Reduced metadata |
| Relay Diversity | Multiple relay connections | No single point |

**Residual Risk**: LOW-MODERATE
- Content fully protected by E2E encryption
- IP addresses visible if relay logs (mitigated by Tor)
- Message size/frequency patterns visible

**Mitigations for High-Risk Users**:
- Always use Tor
- Use community-run no-log relays
- Rotate relay connections regularly

---

### Scenario 4: Group Infiltration

**Attack Chain**:
1. Adversary creates legitimate-seeming identity
2. Gradually builds trust, gains group invitation
3. Once inside, has full access to all group content
4. Screenshots/copies sensitive information
5. Reports to handler or leaks publicly

**Assets at Risk**:
- All group communications
- Member identities and contact info
- Planning documents and strategies
- Voting records (if not anonymous)

**BuildIt Defenses**:
| Defense | Implementation | Effectiveness |
|---------|----------------|---------------|
| Vetting Guidance | Documentation and best practices | Depends on implementation |
| Permission Controls | Role-based access | Limits damage scope |
| Anonymous Voting | Ballot encryption | Voting positions protected |
| Audit Logs | Group activity tracking | Detect suspicious behavior |
| Member Expiration | Periodic re-verification | Limits long-term infiltration |

**Residual Risk**: HIGH
- Technical measures cannot prevent trusted insider threats
- Screenshot/copy cannot be prevented technically
- Long-term infiltration extremely difficult to detect

**Mitigations**:
- Strict vetting with out-of-band verification (in-person meetings)
- Small groups for sensitive planning (<10 members)
- Compartmentalization (need-to-know basis)
- Regular security training for members
- Anonymous voting for all sensitive decisions

---

### Scenario 5: Supply Chain Attack

**Attack Chain**:
1. Attacker compromises NPM package or CDN
2. Malicious code injected into BuildIt dependency
3. Code exfiltrates private keys to attacker server
4. Attacker gains access to multiple user identities
5. Mass decryption of communications

**Assets at Risk**:
- All private keys (mass compromise)
- All encrypted content (past and future)
- Platform integrity and trust

**BuildIt Defenses**:
| Defense | Implementation | Effectiveness |
|---------|----------------|---------------|
| Dependency Auditing | `bun audit`, Snyk monitoring | Early warning |
| CSP | Content-Security-Policy headers | Blocks exfiltration |
| SRI | Subresource Integrity for CDN | Tamper detection |
| Open Source | Public code review | Community oversight |
| Minimal Dependencies | Careful dependency selection | Reduced attack surface |

**Residual Risk**: MODERATE
- Web applications inherently trust JavaScript
- CSP provides strong but not absolute protection
- Regular auditing required

**Mitigations**:
- Regular dependency updates
- Self-hosting for highest-risk deployments
- Code signing for releases
- Security audit before major releases

---

### Scenario 6: MITM Attack on Relay Connection

**Attack Chain**:
1. Attacker positions between user and relay (ISP, VPN, rogue WiFi)
2. Intercepts TLS handshake
3. Presents fraudulent certificate
4. Decrypts/inspects traffic in transit
5. Modifies or blocks messages

**Assets at Risk**:
- Connection metadata
- Message injection/modification
- Denial of service

**BuildIt Defenses**:
| Defense | Implementation | Effectiveness |
|---------|----------------|---------------|
| Certificate Pinning | SHA-256 fingerprint verification | Detects fraudulent certs |
| TOFU | Trust-on-First-Use for unknown relays | First connection trusted |
| E2E Encryption | NIP-44 | Even with MITM, content protected |
| Pin Storage | Persistent pin database | Remembers expected certs |

**Certificate Pinning Flow**:
```
1. Connection to relay initiated
2. Certificate received from server
3. SHA-256 fingerprint computed
4. If known relay: compare to stored pin
   - Match: proceed
   - Mismatch: BLOCK connection
5. If unknown relay (TOFU enabled):
   - First connection: store pin, proceed
   - Subsequent: compare to stored
   - Changed: WARN or BLOCK based on config
```

**Residual Risk**: LOW
- Certificate pinning effectively prevents MITM
- TOFU vulnerable to attack on first connection only
- E2E encryption provides defense-in-depth

---

## Comparison with Similar Tools

| Feature | BuildIt | Signal | Wire | Element/Matrix |
|---------|---------|--------|------|----------------|
| E2E Encryption | NIP-44 (ChaCha20) | Signal Protocol | Proteus (Signal-derived) | Olm/Megolm |
| Forward Secrecy | No (planned) | Yes | Yes | Yes |
| Metadata Protection | NIP-17 (moderate) | Good | Moderate | Limited |
| Decentralization | Nostr relays | Centralized | Centralized | Federated |
| Anonymous Registration | Yes (nsec only) | Phone required | Email required | Email optional |
| Offline Messaging | BLE mesh | No | No | No |
| Open Source | Yes | Yes | Yes | Yes |
| Coercion Resistance | Duress password | No | No | No |

**BuildIt Advantages**:
- Fully decentralized (no central server to compel)
- BLE mesh for offline/censorship-resistant communication
- Duress password system for coercion scenarios
- No phone/email required for registration

**BuildIt Limitations**:
- No forward secrecy (major gap for device seizure scenarios)
- Less mature than Signal Protocol
- Metadata protection weaker than Signal
- Smaller security research community

---

## What BuildIt Does NOT Protect Against

### Technical Limitations

1. **Forward Secrecy**: A single key compromise exposes ALL past and future messages. This is a fundamental limitation of the current architecture (planned for Phase 2).

2. **Post-Quantum Attacks**: secp256k1 ECDH and ChaCha20-Poly1305 will be broken by quantum computers. Current "harvest now, decrypt later" attacks are a concern for long-term sensitive data.

3. **Compromised Devices**: Keyloggers, screen capture malware, and other device-level attacks bypass all encryption. BuildIt cannot protect against a compromised operating system.

4. **Memory Forensics**: Hot memory (RAM) attacks such as cold boot or DMA attacks may recover keys. Argon2id provides some protection by requiring significant memory, but dedicated attackers may still succeed.

### Operational Limitations

1. **Insider Threats**: Once someone is trusted into a group, they have full access. Technical controls cannot prevent screenshots or manual transcription.

2. **Physical Coercion**: Torture, threats to family, or extreme legal pressure can compel password disclosure. Duress passwords provide some protection but are not foolproof.

3. **Social Engineering**: Phishing, impersonation, and manipulation are human problems that technology alone cannot solve.

4. **Operational Security Failures**: Discussing sensitive topics near events, revealing pattern-of-life information, or using identifiable devices negates technical protections.

---

## Risk Recommendations by User Profile

### Low-Risk Organizers
**Profile**: Public advocacy, mutual aid, community groups
**Recommendation**: Standard BuildIt configuration is sufficient

### Medium-Risk Organizers
**Profile**: Union organizing, tenant unions, local activism
**Recommendations**:
- Use pseudonymous identities
- Enable all privacy features
- Invitation-only groups
- Basic security training

### High-Risk Organizers
**Profile**: Direct action, authoritarian contexts, whistleblowing
**Recommendations**:
- Mandatory Tor usage
- Hardware wallets (NIP-46)
- Duress password configured
- Anonymous identities only
- Burner devices
- Professional security consultation
- Legal support network established

---

## References

- [SECURITY.md](./SECURITY.md) - Security architecture overview
- [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) - Audit findings and fixes
- [PRIVACY.md](./PRIVACY.md) - User-facing privacy documentation
- [Signal Protocol](https://signal.org/docs/) - Comparison reference
- [NIST Post-Quantum Cryptography](https://csrc.nist.gov/projects/post-quantum-cryptography)

---

**Document Maintainer**: BuildIt Security Team
**Review Cycle**: Quarterly or after significant changes
**Next Review**: 2026-04-25
