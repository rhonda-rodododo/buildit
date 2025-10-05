# Getting Started

## Prerequisites

- Node.js 18+ and npm/pnpm/yarn
- Git
- Modern browser (Chrome/Firefox/Safari)
- (Optional) Tor browser for privacy features

## Quick Start for Development

This guide will be auto-executed by Claude Code using PROMPT.md. If running manually:

### 1. Clone and Install

```bash
git clone <repository-url>
cd buildit-network
npm install  # or pnpm install / yarn install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your relay configuration:

```env
# Default Nostr Relays
VITE_DEFAULT_RELAYS=wss://relay.damus.io,wss://relay.snort.social,wss://nos.lol
VITE_TOR_RELAYS=ws://jgqaglhautb4k6e6i2g34jakxiemqp6z4wynlirltuukgkft2xuglmqd.onion

# Optional: Development Settings
VITE_ENABLE_DEBUG_LOGS=false
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 4. Build for Production

```bash
npm run build
npm run preview  # Test production build locally
```

## For Claude Code: Auto-Build Instructions

**To build this entire project autonomously, Claude Code should:**

1. Read `PROMPT.md` for complete build instructions
2. Execute Epic 1-12 sequentially
3. Use Context7 MCP for latest library documentation
4. Use Puppeteer MCP for visual testing
5. Commit frequently with clear messages
6. Validate after each epic

**Start command:**
```
Please execute PROMPT.md to build the complete Social Action Network MVP.
```

## Project Structure (Auto-Generated)

```
buildit-network/
├── src/
│   ├── core/           # Core infrastructure (Nostr, crypto, storage)
│   │   ├── nostr/     # Nostr client, relay management, NIPs
│   │   ├── crypto/    # NIP-44 encryption, key management
│   │   └── storage/   # Dexie database, sync, cache
│   ├── lib/            # Shared libraries
│   │   ├── auth/      # Authentication logic
│   │   ├── groups/    # Group management
│   │   └── permissions/
│   ├── modules/        # Feature modules (plugins)
│   │   ├── events/
│   │   ├── mutual-aid/
│   │   ├── governance/
│   │   ├── wiki/
│   │   └── crm/
│   ├── components/     # Shared UI components
│   │   ├── ui/        # shadcn/ui components
│   │   ├── layouts/   # Layout components
│   │   └── common/    # Business components
│   ├── stores/        # Zustand stores
│   ├── hooks/         # React hooks
│   ├── types/         # TypeScript types
│   └── App.tsx
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── docs/
    └── epics/         # Per-epic documentation
```

## Development Workflow

### Running Tests

```bash
# Unit tests
npm run test

# Unit tests with coverage
npm run test:coverage

# E2E tests
npm run test:e2e

# Watch mode
npm run test:watch

# All tests
npm run test:all
```

### Linting and Type Checking

```bash
# TypeScript check
npm run type-check

# ESLint
npm run lint

# Fix linting issues
npm run lint:fix

# Format with Prettier
npm run format
```

## User Guide (After Build)

### Creating Your Identity

1. Navigate to the app
2. Click "Create New Identity" or "Import Existing"
3. For new identity:
   - Generate keys automatically
   - **IMPORTANT**: Backup your nsec key immediately
4. For existing identity:
   - Import your nsec key
   - Or connect hardware wallet (NIP-46)

### Creating Your First Group

1. After login, click "Create Group"
2. Fill in group details:
   - Name and description
   - Privacy level (public/private)
   - Enable modules (events, mutual-aid, etc.)
3. Invite members by their npub keys

### Configuring Privacy Settings

1. Go to Settings → Privacy
2. Configure:
   - Default encryption for DMs (NIP-44)
   - Relay preferences
   - Tor integration (if available)
   - Metadata protection options

## Key Concepts

### Nostr Identities

- **nsec**: Your private key (NEVER share, backup securely)
- **npub**: Your public key (share with others)
- Multi-identity support: Create separate identities for different contexts

### Encryption

- **DMs**: NIP-44 (ChaCha20, HKDF) for direct messages
- **Groups**: Derived group keys with NIP-44 principles
- **Future**: MLS protocol for advanced group encryption

### Groups & Modules

- Groups are encrypted collaboration spaces
- Each group can enable different modules independently
- Available modules:
  - **Events**: Event management, RSVPs, calendar
  - **Mutual Aid**: Resource sharing, ride shares
  - **Governance**: Proposals, voting (multiple methods)
  - **Wiki**: Knowledge base with versioning
  - **CRM**: Contact management with custom fields

### Privacy Levels

1. **Public**: Unencrypted, visible to all
2. **Group**: Encrypted with group key, members only
3. **Private**: Encrypted, limited visibility
4. **Direct Action**: Time-delayed sensitive info reveal

## Security Best Practices

### Key Management
- Backup nsec keys offline (encrypted)
- Use hardware wallet for high-security groups
- Separate identities for different risk levels

### Operational Security
- Use Tor for sensitive organizing
- Enable metadata protection
- Regular security audits
- Verify identities out-of-band

### Device Security
- Full-disk encryption
- Strong passwords/biometrics
- Regular OS updates
- Trusted devices only

## Troubleshooting

### Relay Connection Issues
- Check relay URLs in `.env`
- Verify internet connection
- Try alternative relays
- Enable Tor if in restrictive network

### Encryption Errors
- Verify group membership
- Check if group key is synced
- Try re-importing identity
- Contact group admin

### Performance Issues
- Clear browser cache
- Check IndexedDB storage
- Reduce active subscriptions
- Close unused tabs

## Advanced Configuration

### Custom Relays

Edit `src/core/nostr/relays.ts`:

```typescript
export const CUSTOM_RELAYS = [
  'wss://your-relay.com',
  'wss://community-relay.org',
]
```

### Theming

Modify design tokens in `src/index.css`:

```css
:root {
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  /* ... more tokens */
}
```

## Getting Help

- **Documentation**: `/docs` folder
- **Issues**: GitHub Issues
- **Security**: Report privately to security contacts

## Next Steps

1. Complete the onboarding tutorial
2. Join a public group to test features
3. Create your own group for your community
4. Explore module capabilities
5. Contribute to the project!

---

**Remember**: This platform provides strong privacy tools, but you must use them correctly. No technology is 100% secure. Always follow operational security practices for sensitive organizing.
