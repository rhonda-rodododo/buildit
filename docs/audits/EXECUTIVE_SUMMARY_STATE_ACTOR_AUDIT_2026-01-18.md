# Security Audit Executive Summary
## State-Actor Threat Model Assessment

**Date**: 2026-01-18
**Threat Model**: Sophisticated state actors (Iranian IRGC, Chinese MSS, Russian FSB, Five Eyes)
**Target**: BuildIt Network - Privacy-first activist organizing platform
**Stated Goal**: Zero-knowledge architecture like Signal, Matrix, CryptPad

---

## OVERALL ASSESSMENT: NOT READY FOR HIGH-RISK DEPLOYMENT

BuildIt Network has strong cryptographic foundations but **critical gaps in implementation and metadata protection** make it currently unsuitable for activists facing sophisticated state actors.

### Audit Score by Domain

| Domain | Rating | Notes |
|--------|--------|-------|
| Cryptographic Primitives | B+ | Good NIP-44 delegation, but Math.random() in critical paths |
| Key Management | B | 600K PBKDF2 iterations, but no forward secrecy |
| Metadata Protection | D | Group/event metadata fully exposed to relays |
| Supply Chain Security | F | No CSP, 21 CVEs, XSS vectors |
| Zero-Knowledge Claims | F | Documentation misleading; not comparable to Signal/CryptPad |
| Device Seizure Resistance | C- | Keys protected at rest, but no duress features |

---

## CRITICAL FINDINGS (Block Deployment)

### 1. CRYPTO: Math.random() in Security-Critical Code
**Files**: `src/core/crypto/nip17.ts:11`, `src/core/crypto/keyManager.ts:140-153`

- Timestamp randomization uses predictable PRNG
- Passphrase generation uses predictable PRNG
- State actors can correlate "randomized" timestamps via statistical analysis
- **Fix**: Replace with `crypto.getRandomValues()`

### 2. SUPPLY CHAIN: No Content Security Policy
**Location**: Missing from entire codebase despite documentation claiming it exists

- Any compromised npm package can exfiltrate all private keys and decrypted content
- `fetch()` to attacker server would succeed with zero restrictions
- 21 dependency vulnerabilities including 3 CRITICAL (happy-dom RCE, jspdf path traversal)
- **Fix**: Create `public/_headers` with strict CSP

### 3. XSS: dangerouslySetInnerHTML Without Sanitization
**Locations**: 6 components (ArticleView, MathBlock, PublicPageRenderer, etc.)

- DOMPurify is NOT installed despite being recommended
- Malicious content can execute JavaScript to steal keys
- **Fix**: `bun add dompurify` and sanitize all HTML injection points

### 4. ZERO-KNOWLEDGE: Documentation Is Misleading
**Reality vs Claims**:

| Claim in PRIVACY.md | Actual Status |
|---------------------|---------------|
| "Content Security Policy - see vite.config.ts" | FALSE - No CSP exists |
| "Subresource Integrity for CDN assets" | FALSE - No SRI implemented |
| "Zero-knowledge relay architecture" | MISLEADING - Only DM content is protected |

---

## HIGH SEVERITY FINDINGS

### 5. METADATA: Social Graph Fully Exposed
- Kind 3 contact lists published in **plaintext** (`contactsStore.ts:222-258`)
- Group membership events (kind 39xxx) **not gift-wrapped**
- Event RSVPs expose attendee lists in **plaintext**
- A relay operator can reconstruct entire organizational network

### 6. FORWARD SECRECY: None Implemented
- Key compromise exposes **ALL historical messages**
- Device seizure = complete message history decryption
- Noise Protocol (Phase 2) not yet implemented

### 7. GROUP MESSAGES: Timestamp Not Randomized
**File**: `src/core/messaging/groupThread.ts:39`

- DMs have timestamp randomization (+/- 2 days)
- Group messages use exact timestamps
- Enables precise activity correlation

### 8. EVENTS: Physical Locations Stored Plaintext
**File**: `src/modules/events/eventManager.ts:269`

- Event locations visible to any relay
- Critical for direct-action organizing where location secrecy matters

---

## STATE-ACTOR ATTACK SCENARIOS

### Scenario: Iranian IRGC vs Labor Organizers
**Attack Duration**: ~12 weeks to full network compromise

1. ISP monitoring identifies Tor users (or exposes IPs of users who forget Tor Browser)
2. Kind 3 contact lists + kind 39xxx group events reveal **entire social graph**
3. Device seized at checkpoint while app unlocked
4. Cold boot attack extracts keys from memory
5. No forward secrecy = all historical messages decrypted
6. Math.random() weakness enables prosecution timeline reconstruction

### Scenario: Chinese MSS vs Uyghur Diaspora
**Attack Duration**: 12-18 months persistent surveillance

1. Supply chain attack via compromised npm package (no CSP blocks exfiltration)
2. Long-term infiltration via sock puppet (no technical insider threat protection)
3. XSS payload in shared document steals keys
4. "Harvest now, decrypt later" - store all ciphertext for post-quantum decryption

### Scenario: Five Eyes vs Climate Activists
**Attack Duration**: ~12 weeks to coordinated arrests

1. Upstream collection at internet exchanges identifies Nostr users
2. NSL/RIPA compels relay operators to install logging
3. Message size analysis (no padding) reveals communication patterns
4. Device interdiction installs firmware implants
5. UK Section 49 RIPA compels decryption (5 years imprisonment for refusal)

---

## COMPARISON TO ZERO-KNOWLEDGE SYSTEMS

| Property | Signal | CryptPad | Matrix | BuildIt |
|----------|--------|----------|--------|---------|
| Content encrypted | Yes | Yes | Yes | Yes |
| Sender hidden | Yes (sealed) | Yes | No | DMs only |
| Recipient hidden | Yes | Yes | No | No |
| Membership hidden | Yes | N/A | No | No |
| Event metadata hidden | N/A | Yes | No | No |
| Forward secrecy | Yes | N/A | Optional | No |

**BuildIt is comparable to Matrix in privacy properties, NOT Signal or CryptPad.**

---

## IMMEDIATE REMEDIATION REQUIRED

### MUST FIX Before Any High-Risk Deployment

| Priority | Issue | File | Fix |
|----------|-------|------|-----|
| P0 | Math.random() in timestamps | `nip17.ts:11` | Use crypto.getRandomValues() |
| P0 | Math.random() in passphrases | `keyManager.ts:140` | Use crypto.getRandomValues() + BIP-39 |
| P0 | No CSP | Missing | Create `public/_headers` |
| P0 | XSS vectors | 6 components | Install DOMPurify, sanitize all |
| P1 | 21 CVEs | package.json | `bun update --latest` |
| P1 | Social graph exposed | contactsStore.ts | Encrypt contact lists (NIP-51) |
| P1 | Group metadata exposed | groupManager.ts | Gift-wrap all group events |
| P2 | No message padding | nip17.ts | Pad to fixed bucket sizes |
| P2 | No forward secrecy | Architectural | Implement Noise Protocol (Phase 2) |

---

## DOCUMENTATION UPDATES REQUIRED

The following claims in PRIVACY.md must be corrected:

1. Remove or qualify "Zero-knowledge relay architecture" - DMs only, not groups/events
2. Remove CSP claim until implemented
3. Remove SRI claim until implemented
4. Add clear disclosure: "Group memberships and event attendance visible to relay operators"
5. Add forward secrecy limitations prominently

---

## POSITIVE FINDINGS

Despite critical issues, the codebase shows security-conscious design:

- NIP-44 encryption correctly delegated to audited nostr-tools library
- PBKDF2 with 600,000 iterations (OWASP 2023 compliant)
- Proper key zeroing on lock (`privateKey.fill(0)`)
- Unique salt per identity in SecureKeyManager
- Ephemeral keys correctly implemented for DM sender anonymity
- Auto-lock functionality exists
- Rate limiting implemented

---

## AUDIT REPORTS GENERATED

All detailed findings available in `/docs/audits/`:

1. `cryptographic-security-audit-2026-01-18.md` - Crypto implementation review
2. `key-storage-security-audit-2026-01-18.md` - Key management and device seizure
3. `security-audit-2026-01-18-metadata-protection.md` - Traffic analysis vulnerabilities
4. `supply-chain-security-audit-2026-01-18.md` - Dependency and XSS review
5. `zero-knowledge-audit-2026-01-18.md` - ZK architecture assessment
6. `red-team-state-actor-playbooks-2026-01-18.md` - Attack scenario development

---

## CONCLUSION

BuildIt Network's encryption is sound in principle, but **the implementation has critical gaps that sophisticated adversaries will exploit**. The most dangerous issue is the false sense of security created by documentation that claims protections (CSP, SRI, zero-knowledge) that don't actually exist.

**For activists facing state-level adversaries: Do not deploy in current state.**

The P0 fixes (Math.random, CSP, XSS) can be addressed quickly. The metadata exposure (social graph, group membership) requires architectural changes to achieve true zero-knowledge comparable to CryptPad or Signal.

---

**Audit conducted by**: Claude Opus 4.5 security-auditor agents
**Methodology**: Static analysis, threat modeling, attack scenario development
**Classification**: Internal security document - share with development team
