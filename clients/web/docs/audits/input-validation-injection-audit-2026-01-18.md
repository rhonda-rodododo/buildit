# Input Validation and Injection Vulnerability Audit

**Date**: 2026-01-18
**Auditor**: Security Auditor Agent
**Scope**: Input validation, XSS, SQL/NoSQL injection, command injection, JSON injection, URL injection
**Threat Model**: State-actor adversaries with sophisticated capabilities

---

## Executive Summary

This audit examines input validation and injection vulnerabilities in the BuildIt Network codebase against a state-actor threat model. The application is an E2E encrypted social organizing platform where injection vulnerabilities could lead to private key exfiltration, making XSS particularly critical.

**Overall Assessment**: MODERATE RISK

The codebase demonstrates good security practices in many areas:
- DOMPurify sanitization is properly implemented for `dangerouslySetInnerHTML`
- No direct DOM manipulation via innerHTML/outerHTML assignments
- No `eval()`, `Function()`, or `document.write()` usage
- Content Security Policy is deployed with strict settings
- Cryptographic functions use `crypto.getRandomValues()` instead of `Math.random()`

However, several findings require attention for state-actor threat model compliance.

---

## Findings Summary

| Severity | Count | Category |
|----------|-------|----------|
| CRITICAL | 0 | - |
| HIGH | 4 | URL Injection, RegExp Injection, Dependency CVEs, Open Redirect |
| MEDIUM | 5 | JSON.parse without validation, Theme CSS injection, Math.random in tests |
| LOW | 3 | Console logging, localStorage usage |
| INFORMATIONAL | 3 | Best practice recommendations |

---

## HIGH Severity Findings

### HIGH-01: Open Redirect via Form Settings

**File**: `/workspace/buildit/src/modules/forms/components/PublicFormView/PublicFormView.tsx`
**Line**: 70

**Description**:
User-controlled `redirectUrl` from form settings is directly assigned to `window.location.href` without validation:

```tsx
onClick={() => window.location.href = form.settings.redirectUrl!}
```

**Impact**:
A malicious group admin could configure a form with a redirect to an attacker-controlled phishing site. Users who submit the form would be redirected to this malicious URL, potentially leading to credential theft or malware installation.

**Attack Scenario**:
1. Attacker creates or compromises a group
2. Creates a form with `redirectUrl: "https://evil-phishing-site.com/fake-buildit"`
3. Shares form with targets
4. After submission, users are redirected to phishing site

**Remediation**:
```typescript
// Validate redirect URL is same-origin or on allowlist
function isSafeRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    // Only allow same-origin redirects
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

// In component:
if (form.settings.redirectUrl && isSafeRedirectUrl(form.settings.redirectUrl)) {
  window.location.href = form.settings.redirectUrl;
}
```

---

### HIGH-02: RegExp Injection in Custom Fields

**File**: `/workspace/buildit/src/modules/custom-fields/customFieldsManager.ts`
**Line**: 152

**Description**:
User-provided regex patterns from custom field definitions are passed directly to `new RegExp()`:

```typescript
if (schema.pattern) zodSchema = zodSchema.regex(new RegExp(schema.pattern));
```

**Impact**:
A malicious group admin could craft a ReDoS (Regular Expression Denial of Service) pattern that causes catastrophic backtracking, freezing the user's browser when validating form input.

**Attack Scenario**:
1. Attacker creates custom field with pattern: `^(a+)+$`
2. User enters input: `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab`
3. Browser hangs for minutes/hours during validation

**Remediation**:
```typescript
import { isRegExpSafe } from 'safe-regex';

function createSafeRegExp(pattern: string, maxLength: number = 100): RegExp | null {
  // Limit pattern length
  if (pattern.length > maxLength) {
    console.warn('RegExp pattern too long');
    return null;
  }

  // Check for catastrophic backtracking patterns
  if (!isRegExpSafe(pattern)) {
    console.warn('Potentially dangerous RegExp pattern rejected');
    return null;
  }

  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}
```

---

### HIGH-03: Theme CSS Path Injection

**File**: `/workspace/buildit/src/components/theme-provider.tsx`
**Line**: 63

**Description**:
The `colorTheme` value from localStorage is used to construct a CSS file path without validation:

```typescript
style.href = `/src/themes/${colorTheme}.css`;
```

**Impact**:
If an attacker can manipulate localStorage (via XSS or physical access), they could potentially inject path traversal characters to load arbitrary CSS files, though the actual risk is limited by CSP.

**Attack Scenario**:
1. Attacker sets localStorage value: `../../../malicious`
2. Application attempts to load `/src/themes/../../../malicious.css`
3. Depending on server configuration, could load unintended resources

**Remediation**:
```typescript
const VALID_THEMES = ['default', 'dark', 'light', 'high-contrast'] as const;
type ValidTheme = typeof VALID_THEMES[number];

function isValidTheme(theme: string): theme is ValidTheme {
  return VALID_THEMES.includes(theme as ValidTheme);
}

// In component:
if (isValidTheme(colorTheme)) {
  style.href = `/src/themes/${colorTheme}.css`;
}
```

---

### HIGH-04: Dependency Vulnerabilities (CVEs)

**Source**: `bun audit` output

**Description**:
The audit identified 18 vulnerabilities in dependencies:
- 8 HIGH severity
- 8 MODERATE severity
- 2 LOW severity

**Critical Dependencies with HIGH CVEs**:

| Package | Vulnerability | Impact |
|---------|--------------|--------|
| react-router >=7.0.0 | XSS via Open Redirects (GHSA-2w69-qvjg-hvjx) | User redirection to malicious sites |
| react-router >=7.0.0 | SSR XSS in ScrollRestoration (GHSA-8v8x-cx79-35w7) | XSS in SSR context |
| glob >=10.2.0 | Command injection via -c/--cmd (GHSA-5j98-mcp5-4vw2) | Not exploitable in browser |
| valibot >=0.31.0 | ReDoS in EMOJI_REGEX (GHSA-vqpr-j7v3-hqw9) | DoS via malicious input |
| tar <=7.5.2 | Arbitrary file overwrite (GHSA-8qq5-rm4j-mr97) | Build-time only |
| @modelcontextprotocol/sdk <1.24.0 | DNS rebinding (GHSA-w48q-cv73-mx4w) | Dev tool only |
| qs <6.14.1 | DoS via arrayLimit bypass (GHSA-6rw7-vpxm-498p) | Server-side only |

**Remediation**:
```bash
# Update dependencies to latest compatible versions
bun update

# Or update to latest (may include breaking changes)
bun update --latest
```

Priority updates:
1. `react-router` - XSS vulnerabilities affect client-side routing
2. `valibot` - Used in crypto-related code (bip32, bitcoinjs-lib)
3. `mdast-util-to-hast` - Could affect markdown rendering

---

## MEDIUM Severity Findings

### MEDIUM-01: JSON.parse Without Schema Validation

**Files**: Multiple locations (69 instances found)

**Key Locations**:
- `/workspace/buildit/src/modules/friends/components/AddFriendDialog.tsx:136`
- `/workspace/buildit/src/core/crypto/nip17.ts:130,135`
- `/workspace/buildit/src/core/storage/sync.ts:126,209,250,289,332`
- `/workspace/buildit/src/core/groupEntity/groupEntityStore.ts` (many)

**Description**:
Multiple instances of `JSON.parse()` are used without schema validation. While some come from encrypted/trusted sources, others process external data:

```typescript
// AddFriendDialog.tsx - QR code data from external source
const qrData: FriendQRData = JSON.parse(data);

// nip17.ts - decrypted Nostr events
const seal: Seal = JSON.parse(sealJson)
const rumor: Rumor = JSON.parse(rumorJson)
```

**Impact**:
Malformed or malicious JSON could cause unexpected behavior or prototype pollution if object properties are accessed unsafely.

**Remediation**:
Add Zod schema validation for all external JSON parsing:

```typescript
import { z } from 'zod';

const FriendQRDataSchema = z.object({
  pubkey: z.string().min(64).max(64),
  displayName: z.string().optional(),
  // ... other fields
});

// Safe parsing
const parsed = FriendQRDataSchema.safeParse(JSON.parse(data));
if (!parsed.success) {
  throw new Error('Invalid QR code format');
}
const qrData = parsed.data;
```

---

### MEDIUM-02: Math.random() Usage in Non-Test Code

**File**: `/workspace/buildit/src/modules/newsletters/newslettersStore.ts`
**Lines**: 854, 857

**Description**:
`Math.random()` is used for simulating network delays and failure rates:

```typescript
await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));
if (Math.random() < 0.05) {
  throw new Error('Relay connection failed');
}
```

**Impact**:
While this appears to be simulation/mock code, `Math.random()` is predictable and should not be used even in non-cryptographic contexts in a security-sensitive application. Additionally, this code may be executing in production if the mock is not properly isolated.

**Remediation**:
1. Ensure this is only used in development/test environments
2. If needed in production, use crypto.getRandomValues():
```typescript
import { secureRandomInt } from '@/core/crypto/nip17';
const delay = 100 + secureRandomInt(200);
```

---

### MEDIUM-03: Math.random() in Collaborative Editor

**File**: `/workspace/buildit/src/modules/documents/components/TipTapEditor.tsx`
**Line**: 78

**Description**:
Random color selection for collaborative cursors uses `Math.random()`:

```typescript
return colors[Math.floor(Math.random() * colors.length)]
```

**Impact**:
While not security-critical, predictable cursor colors could theoretically leak information about user session state.

**Remediation**:
Use secure random selection:
```typescript
const getRandomColor = (): string => {
  const colors = [...];
  const randomBytes = new Uint8Array(1);
  crypto.getRandomValues(randomBytes);
  return colors[randomBytes[0] % colors.length];
}
```

---

### MEDIUM-04: QR Code Data Without Signature Verification

**File**: `/workspace/buildit/src/modules/friends/components/AddFriendDialog.tsx`
**Lines**: 134-148

**Description**:
The code has a TODO comment indicating signature verification is not implemented:

```typescript
const handleQRScan = async (data: string) => {
  try {
    const qrData: FriendQRData = JSON.parse(data);
    // TODO: Verify signature  <-- NOT IMPLEMENTED
    if (!qrData.pubkey) {
      throw new Error('Invalid QR code');
    }
    await addFriend(qrData.pubkey, 'qr', friendMessage || undefined);
```

**Impact**:
Without signature verification, an attacker could craft a malicious QR code pointing to their own pubkey, potentially facilitating impersonation attacks or social engineering.

**Remediation**:
Implement Nostr signature verification:
```typescript
import { verifyEvent } from 'nostr-tools';

const handleQRScan = async (data: string) => {
  const qrData = JSON.parse(data);

  // Verify the QR code contains a signed event
  if (!qrData.event || !verifyEvent(qrData.event)) {
    throw new Error('Invalid or unsigned QR code');
  }

  // Verify the pubkey matches the signer
  if (qrData.pubkey !== qrData.event.pubkey) {
    throw new Error('Pubkey mismatch');
  }

  await addFriend(qrData.pubkey, 'qr', friendMessage || undefined);
}
```

---

### MEDIUM-05: Link Preview URL Opens Without Validation

**File**: `/workspace/buildit/src/lib/linkPreview/LinkPreviewCard.tsx`
**Line**: 88

**Description**:
The link preview card opens URLs from encrypted message content directly:

```typescript
window.open(preview.url, '_blank', 'noopener,noreferrer')
```

**Impact**:
While `noopener,noreferrer` mitigates tabnabbing, the URL itself comes from another user's message content. A malicious user could send a link preview with a javascript: URL or other dangerous protocol.

**Remediation**:
```typescript
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

const handleClick = () => {
  onClick?.();
  if (isSafeUrl(preview.url)) {
    window.open(preview.url, '_blank', 'noopener,noreferrer');
  }
}
```

---

## LOW Severity Findings

### LOW-01: Console Logging in Production Code

**Files**: Multiple (80+ instances)

**Key Locations**:
- `/workspace/buildit/src/main.tsx` (startup logs)
- `/workspace/buildit/src/lib/modules/registry.ts` (module loading)
- Various error handlers

**Description**:
Extensive console logging may leak sensitive information about application state, timing, and errors.

**Impact**:
Information disclosure that could aid attackers in understanding application internals.

**Remediation**:
1. Remove or conditionally disable console logging in production
2. Use a logging library with production/development modes
3. Ensure no sensitive data (keys, tokens) ever reaches console.log

---

### LOW-02: localStorage for Non-Sensitive Data

**Files**:
- `/workspace/buildit/src/i18n/config.ts:35,52`
- `/workspace/buildit/src/components/theme-provider.tsx:39,43,92,100`

**Description**:
localStorage is used for language and theme preferences, which is appropriate. However, these values are read without validation.

**Impact**:
Minimal - preferences are non-sensitive, but could be manipulated by malicious extensions.

**Remediation**:
Validate localStorage values before use:
```typescript
const VALID_LANGUAGES = ['en', 'es', 'fr', 'ar'] as const;
const savedLanguage = localStorage.getItem('i18n-language');
const language = VALID_LANGUAGES.includes(savedLanguage as any)
  ? savedLanguage
  : 'en';
```

---

### LOW-03: Dynamic Import Paths

**Files**: Multiple

**Description**:
Dynamic imports are used for lazy loading modules. While the paths are hardcoded, this pattern could be vulnerable if paths were user-controlled.

**Impact**:
Minimal - paths are all hardcoded and not user-controlled.

**Remediation**:
Continue using hardcoded paths; document that dynamic import paths must never be derived from user input.

---

## INFORMATIONAL Findings

### INFO-01: XSS Protection Properly Implemented

**Positive Finding**

All 6 instances of `dangerouslySetInnerHTML` are properly protected with DOMPurify sanitization:

| File | Line | Protection |
|------|------|------------|
| `MathBlock.tsx` | 107, 137 | `sanitizeMathHtml()` |
| `ArticleView.tsx` | 162 | `sanitizeHtml()` |
| `PublicPageEditor.tsx` | 325 | `sanitizeHtml()` |
| `PublicPageRenderer.tsx` | 111 | `sanitizeHtml()` |
| `PublicCampaignView.tsx` | 53 | `sanitizeHtml()` |

The sanitization library at `/workspace/buildit/src/lib/security/sanitize.ts` properly:
- Uses DOMPurify with strict allowlists
- Blocks dangerous tags (script, style, iframe, form, etc.)
- Blocks event handlers (onerror, onload, onclick, etc.)
- Forces all links to open with `noopener noreferrer`

---

### INFO-02: No Eval or Dynamic Code Execution

**Positive Finding**

The codebase contains:
- Zero instances of `eval()`
- Zero instances of `new Function()`
- Zero instances of `document.write()`
- No string-based setTimeout/setInterval (all use function callbacks)

---

### INFO-03: Content Security Policy Deployed

**Positive Finding**

A strong CSP is configured in `/workspace/buildit/public/_headers`:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  connect-src 'self' wss: https: blob:;
  frame-src [trusted embed domains];
  object-src 'none';
  base-uri 'self';
  form-action 'self';
```

Key protections:
- No inline scripts allowed
- No eval (except wasm)
- Object/embed blocked
- Form actions restricted to self

---

## Dexie/IndexedDB Query Safety

**Analysis**: SAFE

Dexie queries use parameterized access patterns:

```typescript
// Safe - using Dexie's query builder
await customFieldsTable.where({ groupId, entityType }).sortBy('order');

// Safe - using primary key access
const existing = await db.events?.get(dTag);

// Safe - using update with known keys
await db.events?.update(dTag, eventData);
```

No SQL/NoSQL injection vulnerabilities were found. Dexie's query API doesn't allow string interpolation of user input into queries.

---

## Recommendations

### Immediate Actions (HIGH Priority)

1. **Update Dependencies**
   ```bash
   bun update react-router react-router-dom
   bun update valibot
   bun update mdast-util-to-hast
   ```

2. **Fix Open Redirect** in PublicFormView.tsx
   - Validate redirectUrl is same-origin before assignment

3. **Add RegExp Safety** in CustomFieldsManager
   - Install `safe-regex` package and validate patterns

4. **Validate Theme Names** in theme-provider.tsx
   - Use allowlist of valid theme names

### Short-Term Actions (MEDIUM Priority)

5. **Add Schema Validation** to all JSON.parse calls
   - Use Zod schemas for external data parsing

6. **Implement QR Signature Verification**
   - Complete the TODO in AddFriendDialog.tsx

7. **Validate Link Preview URLs**
   - Only allow http/https protocols

8. **Remove Math.random()** from production code paths
   - Replace with crypto.getRandomValues() wrapper

### Long-Term Actions (LOW Priority)

9. **Production Logging Strategy**
   - Implement log levels with production stripping

10. **Input Validation Library**
    - Create centralized validation utilities for common patterns

---

## Compliance Assessment

| Requirement | Status | Notes |
|-------------|--------|-------|
| No XSS vectors | PASS | DOMPurify properly used |
| No SQL/NoSQL injection | PASS | Dexie uses safe patterns |
| No command injection | PASS | No shell execution |
| No eval/dynamic code | PASS | No dangerous patterns |
| CSP deployed | PASS | Strong policy in place |
| Input validation | PARTIAL | JSON parsing needs schemas |
| URL validation | FAIL | Open redirect vulnerability |
| Dependency security | FAIL | 18 CVEs pending updates |

---

## Conclusion

The BuildIt Network codebase demonstrates solid security fundamentals with proper XSS sanitization, CSP deployment, and absence of dangerous code patterns like eval(). However, for state-actor threat model compliance, the identified HIGH severity issues (particularly the open redirect vulnerability and dependency CVEs) should be addressed promptly.

The most critical finding is the dependency vulnerabilities in `react-router` which include XSS vulnerabilities that could bypass the application's own sanitization if exploited at the routing layer.

**Next Audit**: After remediation of HIGH severity findings
**External Audit**: Recommended for cryptographic implementations and full penetration testing
