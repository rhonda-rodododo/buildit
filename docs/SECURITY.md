# BuildIt Security Architecture

**Version**: 1.0.0
**Last Updated**: 2026-01-25
**Status**: Production-Ready

## Overview

BuildIt is designed to protect activists, organizers, and community members from sophisticated adversaries including state-level actors. This document provides a comprehensive overview of BuildIt's security architecture, threat model, and the protections it provides.

---

## Threat Model

### Primary Adversaries

| Adversary | Capability Level | Primary Attacks |
|-----------|------------------|-----------------|
| **State-Level Actors** | Very High | Mass surveillance, traffic analysis, device seizure, legal coercion, relay compromise |
| **Network Attackers** | High | MITM attacks, traffic analysis, DNS poisoning, BGP hijacking |
| **Physical Attackers** | Medium-High | Device theft, forensic extraction, cold boot attacks |
| **Malicious Participants** | Medium | Infiltration, social engineering, insider threats |

### What BuildIt Protects Against

- **Content Confidentiality**: Messages are end-to-end encrypted; relays see only ciphertext
- **Sender Anonymity**: NIP-17 ephemeral keys hide the true sender identity
- **Timestamp Correlation**: Timestamps randomized +/- 2 days to prevent timing attacks
- **Key Brute Force**: Argon2id with 64MB memory makes password cracking expensive
- **MITM Attacks**: Certificate pinning for relay connections with TOFU fallback
- **Device Seizure**: Memory-hard KDF, secure key destruction, duress passwords

### Known Limitations

- **Forward Secrecy**: Not currently implemented (planned for Phase 2 with Noise Protocol)
- **Post-Quantum**: secp256k1/ChaCha20 vulnerable to future quantum computers
- **Physical Coercion**: Technical measures cannot prevent rubber-hose cryptanalysis
- **Insider Threats**: Trusted group members can screenshot/leak content

---

## Security Features

### End-to-End Encryption

**Protocol**: NIP-44 v2 with ChaCha20-Poly1305

```
Message Encryption:
  1. Derive conversation key: ECDH(sender_privkey, recipient_pubkey)
  2. Derive per-message key: HKDF-SHA256(conversation_key, nonce)
  3. Encrypt: ChaCha20-Poly1305(plaintext, message_key)
  4. Pad to power-of-2 (1-65535 bytes) to hide message length
  5. Output: version(1) + nonce(32) + ciphertext + MAC(32)
```

**Additional Padding**: Application-layer random padding (16-64 bytes) adds entropy beyond NIP-44's power-of-2 padding to resist traffic analysis.

### Metadata Protection (NIP-17 Gift Wrap)

**Three-Layer Encryption**:

```
Layer 1: Rumor (Kind 14)
  - Unsigned inner message
  - Contains actual content and recipient tag
  - Timestamp randomized +/- 2 days

Layer 2: Seal (Kind 13)
  - NIP-44 encrypted Rumor
  - Signed by actual sender
  - Proves sender authenticity

Layer 3: Gift Wrap (Kind 1059)
  - NIP-44 encrypted Seal
  - Signed by EPHEMERAL key (new key per message)
  - Recipient cannot see true sender from outer layer
```

**Security Properties**:
- Relay operators cannot determine actual sender (only ephemeral key visible)
- Timestamps cannot be used for correlation (randomized in all layers)
- Message size reveals nothing (power-of-2 padding)

### Key Derivation

**Master Key Derivation** (Argon2id):

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Memory | 64 MB | Resists GPU/ASIC attacks |
| Iterations | 3 | Balance security/performance |
| Parallelism | 4 | Leverages multi-core CPUs |
| Output | 256 bits | Full security margin |

**Key Hierarchy**:
```
User Password
    |
    v (Argon2id, 64MB, 3 iterations, 4 parallelism)
Master Encryption Key (MEK)
    |
    +---> Identity Private Key (encrypted with MEK via AES-256-GCM)
    |
    +---> Database Encryption Key (HKDF-SHA256 from MEK)
```

**PBKDF2 Fallback**: For WebAuthn-protected keys, PBKDF2 with 600,000 iterations (OWASP 2023) is used where Argon2 is unavailable.

### Coercion Resistance

**Duress Password System**:
- Separate duress password triggers "emergency mode"
- Appears to unlock normally (plausible deniability)
- Shows decoy identity with innocent content
- Optionally destroys real keys (cryptographic shredding)
- Sends silent alerts to trusted contacts via NIP-17

**Secure Key Destruction**:
```rust
// Multiple overwrite passes
Pass 1: 0xFF (all ones)
Pass 2: 0x00 (all zeros)
Pass 3: 0xAA (alternating bits)
Pass 4: Random bytes (CSPRNG)
Final: Zeroization
```

### Platform-Specific Security

#### iOS
- **Keychain**: Private keys stored in iOS Keychain with Secure Enclave backing
- **Data Protection**: Files encrypted with NSFileProtectionComplete
- **Certificate Pinning**: Native implementation via `URLSessionDelegate`
- **Biometric Auth**: Face ID/Touch ID for key access

#### Android
- **Keystore**: Private keys in Android Keystore with StrongBox (hardware-backed)
- **SQLCipher**: Database encrypted with SQLCipher (AES-256-CBC)
- **Certificate Pinning**: OkHttp CertificatePinner with SHA-256 fingerprints
- **Biometric Auth**: BiometricPrompt API for key access

#### Desktop (Tauri)
- **OS Keyring**: Keys stored in platform keyring (Keychain/Credential Manager/Secret Service)
- **Certificate Pinning**: Rust rustls with custom ServerCertVerifier
- **Memory Protection**: Zeroize crate for sensitive data cleanup

### Network Security

**Certificate Pinning**:
- SHA-256 fingerprints for known relays (pre-configured)
- Trust-on-First-Use (TOFU) for unknown relays
- Warning mode or blocking mode when certificates change
- Shared pin configuration across all platforms: `protocol/security/relay-pins.json`

**Configuration**:
```json
{
  "tofu_enabled": true,
  "tofu_warn_on_change": true,
  "require_pinned_for_write": true,
  "pin_expiry_days": 365
}
```

**BLE Mesh Security**:
- Commitment scheme hides public keys in advertisements
- All mesh messages use NIP-17 gift wrap encryption
- Hop-by-hop encryption prevents relay observation
- Store-and-forward for offline delivery

---

## Security Audit Summary

### Audit Status

| Audit Type | Date | Status | Findings |
|------------|------|--------|----------|
| Cryptographic Audit | 2026-01-18 | Complete | 18 findings (2 critical, 4 high) |
| Key Storage Audit | 2026-01-18 | Complete | Focus on PBKDF2/salt issues |
| Protocol Audit | 2026-01-18 | Complete | NIP-17/44 compliance verified |
| Supply Chain Audit | 2026-01-18 | Complete | Dependency vulnerabilities noted |

### Critical Findings Fixed

1. **CRITICAL-001**: Weak randomness in timestamp obfuscation
   - **Fix**: Replaced `Math.random()` with `crypto.getRandomValues()`
   - **Status**: RESOLVED

2. **CRITICAL-002**: Weak passphrase generation
   - **Fix**: Implemented BIP-39 wordlist with cryptographic randomness
   - **Status**: RESOLVED

### High Findings Fixed

1. **HIGH-001**: Static salt in ProtectedKeyStorage
   - **Fix**: Per-user random salt generation (32 bytes)
   - **Status**: RESOLVED

2. **HIGH-002**: Insufficient PBKDF2 iterations
   - **Fix**: Increased to 600,000 iterations (OWASP 2023)
   - **Status**: RESOLVED

3. **HIGH-003**: Weak hash function for local encryption
   - **Fix**: Replaced with SHA-256 via Web Crypto API
   - **Status**: RESOLVED

### Outstanding Items

- **Forward Secrecy**: Phase 2 implementation with Noise Protocol
- **Post-Quantum**: Monitoring NIST standardization; hybrid cryptography planned

---

## User Security Guidelines

### Password Recommendations

| Use Case | Minimum Strength | Recommendation |
|----------|------------------|----------------|
| Low Risk | 12 characters | Standard passphrase |
| Medium Risk | 16 characters | BIP-39 12-word mnemonic |
| High Risk | 24 characters | BIP-39 24-word mnemonic + hardware wallet |

### Duress Password Setup

1. Navigate to Security Settings > Duress Protection
2. Set a distinct duress password (minimum 4 characters, must differ from main password)
3. Configure trusted contacts for silent alerts
4. Optionally enable real key destruction
5. Test in safe environment before relying on it

**Important**: Duress password must be memorable under stress but not guessable from your main password.

### Trusted Contacts Configuration

Trusted contacts receive silent NIP-17 alerts when duress mode activates:
1. Add contacts via Settings > Trusted Contacts
2. Verify their public keys out-of-band (in person or Signal)
3. Ensure they understand what a duress alert means
4. Test the alert system before deployment

### Device Security Best Practices

**All Users**:
- Enable full-disk encryption (FileVault, BitLocker, LUKS)
- Use strong device passwords (not just biometrics)
- Keep OS and BuildIt updated
- Disable cloud backups for sensitive data

**High-Risk Users**:
- Use dedicated devices for organizing
- Consider Tails OS for anonymity
- Enable Tor for all relay connections
- Regular key rotation (monthly)
- Hardware wallet for key storage (NIP-46)

---

## Incident Response

### If Device is Seized

1. **Immediate**: Do NOT provide passwords (assert legal rights)
2. **If coerced**: Use duress password to protect real identity
3. **Notify**: Contact legal support and trusted contacts
4. **Post-seizure**: Assume all keys compromised; rotate keys on new device

### If Key is Compromised

1. Generate new identity immediately
2. Notify group administrators
3. Remove compromised key from all groups
4. Investigate compromise vector
5. Update security practices

### If Group is Infiltrated

1. Isolate suspected infiltrator's access
2. Create new group with vetted members only
3. Do NOT discuss concerns in compromised group
4. Conduct out-of-band identity verification for all members
5. Review and improve vetting procedures

---

## Compliance

### Data Protection

| Regulation | Compliance Status | Notes |
|------------|-------------------|-------|
| GDPR | Compliant | Data export, right to erasure supported |
| CCPA | Compliant | Data transparency, opt-out supported |
| HIPAA | Not Applicable | Not a healthcare platform |

### Cryptographic Standards

| Standard | Compliance |
|----------|------------|
| NIST SP 800-132 (PBKDF) | Compliant (600k iterations) |
| NIST SP 800-56C (KDF) | Compliant (HKDF-SHA256) |
| RFC 7539 (ChaCha20-Poly1305) | Compliant via NIP-44 |
| BIP-340 (Schnorr Signatures) | Compliant |

---

## References

- [THREAT_MODEL.md](./THREAT_MODEL.md) - Detailed threat analysis
- [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) - Complete audit results
- [NIP-17 Specification](https://github.com/nostr-protocol/nips/blob/master/17.md)
- [NIP-44 Specification](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [Argon2 RFC 9106](https://www.rfc-editor.org/rfc/rfc9106)
- [EFF Surveillance Self-Defense](https://ssd.eff.org/)

---

**Security Contact**: security@buildit.network
**Responsible Disclosure**: See [VULNERABILITY_DISCLOSURE.md](./VULNERABILITY_DISCLOSURE.md)
