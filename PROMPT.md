# AUTONOMOUS BUILD PROMPT: BuildIt Network - a social action network

> **Execution Plan** - For progress tracking with checkboxes, see [PROGRESS.md](./PROGRESS.md)

**Target**: Build a production-ready MVP in under 30 hours of focused execution time.
**Current Status**: See [PROGRESS.md](./PROGRESS.md) for detailed tracking

## 🎯 EXECUTION PHILOSOPHY

You are an expert team of architects, engineers, and product builders working autonomously. This is a **complete greenfield build** from setup to deployment. Work efficiently by:

1. **Building incrementally** - Each epic produces working, testable features
2. **Leveraging git commits** - Track all major changes with clear commit messages
3. **Using MCP tools proactively** - Context7 for docs, Puppeteer for testing, IDE diagnostics
4. **Testing continuously** - Run tests after each feature, fix failures immediately
5. **Refactoring fearlessly** - Use git to track changes, don't create alternative files
6. **Building on primitives** - Create reusable components from the start

## 📋 PRE-EXECUTION CHECKLIST

Before starting any epic, ensure:
- Latest library documentation fetched via Context7 MCP
- Previous epic's tests passing (if not Epic 1)
- Git repository initialized with proper .gitignore
- All diagnostics clear from previous work

## 🏗️ ARCHITECTURE DECISIONS

### Frontend Stack (Final Decisions)
- **Framework**: React 18 + TypeScript 5.3+ + Vite
- **UI Library**: **shadcn/ui** (not Tailwind+DaisyUI) - Better primitives, React Native prep
- **Styling**: Tailwind CSS with design tokens in CSS variables
- **State**: Zustand with persistence middleware
- **Storage**: Dexie.js (IndexedDB wrapper)
- **Testing**: Vitest + React Testing Library + Playwright
- **Nostr**: nostr-tools library
- **Crypto** (See ENCRYPTION_STRATEGY.md for details):
  - @noble/secp256k1 (Nostr key operations)
  - **NIP-17** (gift-wrapped NIP-44) for DMs - Best metadata protection
  - NIP-44 encryption (ChaCha20-Poly1305, HMAC-SHA256)
  - Noise Protocol for large groups >100 (Phase 2: forward secrecy)
  - Future: BLE mesh with Noise (offline BitChat-style)

### Why shadcn/ui?
1. **Component primitives** - Radix UI primitives are headless and composable
2. **Design token system** - CSS variables work across web and native
3. **Copy-paste architecture** - Components are owned by us, fully customizable
4. **TypeScript-first** - Excellent type safety
5. **React Native ready** - Primitives pattern translates to react-native-reanimated

### Project Structure
```
buildit-network/
├── src/
│   ├── core/                   # Core infrastructure (always present)
│   │   ├── nostr/             # Nostr client, relay management, NIPs
│   │   ├── crypto/            # NIP-17 encryption, key management
│   │   └── storage/           # Dexie database with dynamic schema composition
│   ├── lib/                   # Shared libraries and utilities
│   │   ├── auth/             # Authentication logic
│   │   ├── groups/           # Group management
│   │   ├── permissions/      # Permission system
│   │   └── modules/          # Module registry and lifecycle
│   ├── modules/              # Feature modules (completely encapsulated)
│   │   ├── custom-fields/   # Base module for dynamic fields (foundational)
│   │   ├── events/          # Event creation, RSVPs (uses custom-fields)
│   │   ├── mutual-aid/      # Requests, offers (uses custom-fields)
│   │   ├── governance/      # Proposals, voting
│   │   ├── wiki/            # Knowledge base
│   │   ├── database/        # Airtable-like system (uses custom-fields)
│   │   ├── crm/             # Contact management (uses database)
│   │   ├── documents/       # Document suite
│   │   └── files/           # File manager
│   │
│   │   # Each module contains:
│   │   # ├── index.ts              # Module registration
│   │   # ├── schema.ts             # DB tables, types
│   │   # ├── migrations.ts         # Version upgrades
│   │   # ├── seeds.ts              # Example/template data
│   │   # ├── types.ts              # TypeScript interfaces
│   │   # ├── [module]Store.ts     # Zustand store
│   │   # ├── [module]Manager.ts   # Business logic
│   │   # ├── components/          # ALL UI components
│   │   # ├── hooks/               # Module hooks
│   │   # └── i18n/                # Module translations
│   │
│   ├── components/           # Shared UI components only
│   │   ├── ui/              # shadcn/ui components
│   │   └── layouts/         # Layout components
│   ├── stores/              # Core Zustand stores only
│   ├── hooks/               # Shared React hooks only
│   ├── types/               # Core TypeScript types only
│   └── App.tsx
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── docs/
    └── epics/               # Per-epic documentation
```

## 🚀 EXECUTION EPICS

### **EPIC 1: Foundation & Infrastructure** (6 hours)
**Deliverable**: Project setup, core Nostr client, basic encryption, storage layer

#### 1.1 Project Initialization (1h)
- Read ENCRYPTION_STRATEGY.md to understand encryption architecture
- Initialize Vite + React + TypeScript project
- Install core dependencies (check package versions with Context7):
  - nostr-tools (includes NIP-44, NIP-17 utilities)
  - @noble/secp256k1 (Nostr signatures)
  - zustand, dexie, zod (validation)
  - shadcn/ui (install CLI and core components)
  - vitest, @testing-library/react, playwright
- Configure TypeScript (strict mode, paths, strict null checks)
- Set up Tailwind + design tokens in globals.css
- Configure Vitest with coverage
- Initialize git, create initial commit
- Create .env.example with relay URLs
- Add .gitignore (node_modules, dist, .env, *.local)

#### 1.2 Nostr Core (2h)
- Fetch nostr-tools latest docs via Context7: `/nbd-wtf/nostr-tools`
- Implement `NostrClient` class:
  - Relay pool connection management (use nostr-tools)
  - Event publishing with retry logic
  - Subscription management with filters
  - Connection health monitoring
  - Relay redundancy and failover
- Implement NIPs (see ENCRYPTION_STRATEGY.md):
  - NIP-01 (basic protocol) - event creation, validation, signing
  - NIP-44 (encryption) - ChaCha20-Poly1305, HMAC-SHA256
  - NIP-17 (private DMs) - gift-wrapped messages with metadata protection
  - NIP-59 (seals & gift wraps) - two-layer encryption
- Write unit tests for Nostr client (80%+ coverage)
- Git commit: "feat: implement Nostr client with NIP-01/17/44/59"

#### 1.3 Crypto Layer (NIP-17 Encryption) (2h)
- Read ENCRYPTION_STRATEGY.md encryption decision matrix
- Fetch NIP-44 and @noble/secp256k1 docs via Context7
- Create `NIP17Crypto` class:
  - NIP-44 encryption/decryption (ChaCha20-Poly1305)
  - Seal creation (unsigned rumor → sealed event)
  - Gift wrap creation (sealed event → gift-wrapped for recipient)
  - Metadata randomization (timestamps within 2-day window)
  - Ephemeral key generation for anonymity
- Create `KeyManager` class:
  - Store keys securely (encrypted in IndexedDB)
  - Key import/export (nsec/npub format)
  - Multi-identity support
  - Conversation key derivation (HKDF)
- Implement message flow:
  - DM: rumor → seal → gift wrap → publish
  - Group (<100): multiple gift wraps (one per member)
- Write comprehensive crypto tests (edge cases, invalid inputs)
- Git commit: "feat: implement NIP-17 encryption layer"

#### 1.4 Storage Layer (1h)
- Define Dexie schema (see ARCHITECTURE.md)
- Implement database class with tables:
  - identities, groups, groupMembers, messages, events, etc.
- Create sync service (relay → IndexedDB)
- Implement caching strategy (LRU for recent events)
- Write storage tests
- Git commit: "feat: implement storage layer with Dexie"

**Epic 1 Validation**:
- Run all tests: `bun test`
- Check coverage: >80% for core modules
- Verify no TypeScript errors: `tsc --noEmit`
- Git tag: `v0.1.0-foundation`

---

### **EPIC 2: Auth, Groups & Basic UI** (5 hours)
**Deliverable**: User can create identity, create/join groups, basic group dashboard

#### 2.1 Authentication System (1.5h)
- Create Zustand auth store:
  - Current identity state
  - Login/logout actions
  - Identity switching
- Implement auth components using shadcn/ui:
  - `LoginForm` (import nsec or generate new)
  - `IdentitySelector` (switch between identities)
  - `KeyExportDialog` (backup keys)
- Create `useAuth` hook
- Add auth guard for protected routes
- Write auth flow tests
- Git commit: "feat: implement authentication system"

#### 2.2 Group Management (2h)
- Create Zustand groups store:
  - Active group, groups list, memberships
  - CRUD operations for groups
- Implement Group Nostr events (kind 39000):
  - Create group event with encrypted metadata
  - Parse and decrypt group events
  - Handle group invitations
- Create group components:
  - `CreateGroupForm` (with module selection)
  - `GroupList` (user's groups)
  - `GroupInviteDialog`
  - `GroupSettings`
- Implement permission system (admin/moderator/member/read-only)
- Write group management tests
- Git commit: "feat: implement group management"

#### 2.3 Core UI Setup (1.5h)
- Install shadcn/ui components:
  - button, card, dialog, form, input, select, tabs, etc.
- Create layout components:
  - `AppShell` (sidebar + main content)
  - `Sidebar` (navigation)
  - `TopBar` (user menu, notifications)
- Create design token system in CSS variables:
  - Colors (primary, secondary, accent, neutral, semantic)
  - Spacing, typography, shadows, borders
  - Dark mode support
- Implement routing (react-router-dom):
  - `/login`, `/groups`, `/groups/:id/*`
- Create `GroupDashboard` component with module tabs
- Test responsive layouts with Puppeteer
- Git commit: "feat: create core UI and layouts"

**Epic 2 Validation**:
- Manual test: Create identity → Create group → View dashboard
- Run Puppeteer tests for UI flows
- Check TypeScript errors and ESLint warnings
- Git tag: `v0.2.0-auth-groups`

---

### **EPIC 3: Messaging & Communication** (4 hours)
**Deliverable**: Encrypted DMs and group threads working end-to-end

#### 3.1 Direct Messaging (1.5h)
- Create messages store (Zustand):
  - DM threads, message history, unread counts
- Implement DM Nostr events (NIP-04):
  - Encrypt message content
  - Publish encrypted DM events
  - Decrypt received DMs
- Create messaging components:
  - `DMThreadList` (conversation list)
  - `DMThread` (message thread view)
  - `MessageComposer` (send messages)
  - `MessageBubble` (individual message)
- Implement real-time message subscription
- Add message pagination
- Write messaging tests
- Git commit: "feat: implement direct messaging"

#### 3.2 Group Messaging (2h)
- Extend messages store for group threads
- Implement group message encryption (NIP-17):
  - Derive message keys from group key
  - Encrypt with XChaCha20-Poly1305
  - Publish to group's relay
- Create group messaging components:
  - `GroupThreadList` (thread categories)
  - `GroupThread` (encrypted group messages)
  - `CreateThreadDialog`
- Implement message sync and history
- Add typing indicators (optional, metadata concern)
- Write group messaging tests
- Git commit: "feat: implement group messaging"

#### 3.3 Notifications (0.5h)
- Create notifications store
- Implement notification types:
  - New DM, new group message
  - Group invitation, event RSVP
  - Proposal updates, vote reminders
- Create `NotificationCenter` component
- Add browser notifications (with permission)
- Git commit: "feat: add notification system"

**Epic 3 Validation**:
- Test E2E: Send encrypted DM between two identities
- Test E2E: Group message encryption/decryption
- Verify message history persists after reload
- Check for memory leaks in subscriptions
- Git tag: `v0.3.0-messaging`

---

### **EPIC 4: Events Module** (3 hours)
**Deliverable**: Full event creation, RSVP, calendar view

#### 4.1 Events Core (1.5h)
- Create events store (Zustand)
- Define Event Nostr kind (31923 - parameterized replaceable)
- Implement event privacy levels:
  - Public (unencrypted)
  - Group (encrypted with group key)
  - Private (encrypted, limited visibility)
  - Direct Action (time-delayed location reveal)
- Create Event data model with Zod validation
- Implement event CRUD operations
- Write events core tests
- Git commit: "feat: implement events core"

#### 4.2 Events UI (1h)
- Create event components:
  - `CreateEventForm` (with privacy selector)
  - `EventList` (calendar view using shadcn/ui calendar)
  - `EventCard` (event summary card)
  - `EventDetail` (full event view)
  - `RSVPButton` (going/maybe/not going)
- Implement event filters and search
- Add event capacity management
- Create event reminder system
- Git commit: "feat: create events UI"

#### 4.3 Calendar Integration (0.5h)
- Implement iCal export:
  - Generate .ics files from events
  - Download handler
- Create calendar view (month/week/day)
- Add event timezone handling
- Test calendar functionality
- Git commit: "feat: add calendar integration"

**Epic 4 Validation**:
- Test: Create event with each privacy level
- Test: RSVP flow and capacity limits
- Test: Export to iCal and import to external calendar
- Verify event persistence and sync
- Git tag: `v0.4.0-events`

---

### **EPIC 5: Mutual Aid Module** (3 hours)
**Deliverable**: Request/offer system, ride share matching

#### 5.1 Mutual Aid Core (1.5h)
- Create mutualAid store (Zustand)
- Define Request/Offer data models:
  - Categories (food, housing, transport, skills, etc.)
  - Status workflow (open → matched → fulfilled → closed)
  - Privacy settings per request
- Implement matching algorithm:
  - Category matching
  - Location-based matching (privacy-aware)
  - Time availability matching
- Create Nostr kinds for requests/offers
- Write mutual aid core tests
- Git commit: "feat: implement mutual aid core"

#### 5.2 Request/Offer UI (1h)
- Create mutual aid components:
  - `CreateRequestForm` / `CreateOfferForm`
  - `RequestList` / `OfferList` (with filters)
  - `RequestCard` / `OfferCard`
  - `MatchingDialog` (show matches)
  - `ResourceDirectory` (community resources)
- Implement search and filters:
  - By category, location, date range
  - By status, urgency
- Add request/offer messaging
- Git commit: "feat: create mutual aid UI"

#### 5.3 Ride Share Network (0.5h)
- Extend mutual aid for ride shares:
  - Route matching logic
  - Pickup/dropoff privacy
  - Ride capacity
- Create `RideShareForm` and `RideMatchList`
- Implement ride coordination messaging
- Test ride share flows
- Git commit: "feat: add ride share network"

**Epic 5 Validation**:
- Test: Create request → Create matching offer → Match
- Test: Ride share route matching
- Verify privacy controls on location data
- Git tag: `v0.5.0-mutual-aid`

---

### **EPIC 6: Governance Module** (3.5 hours)
**Deliverable**: Proposals, discussions, multiple voting systems

#### 6.1 Proposals System (1.5h)
- Create governance store (Zustand)
- Define Proposal data model:
  - Title, description, proposal type
  - Discussion thread
  - Voting configuration
  - Amendment system
- Implement proposal lifecycle:
  - Draft → Discussion → Voting → Decided
  - Amendment proposals
- Create proposal Nostr events
- Write proposal tests
- Git commit: "feat: implement proposals system"

#### 6.2 Voting Systems (1.5h)
- Implement voting methods:
  - Simple majority (yes/no/abstain)
  - Ranked-choice (RCV)
  - Quadratic voting (with token allocation)
  - D'Hondt method (proportional representation)
  - Consensus (threshold-based)
- Implement anonymous ballots:
  - Blind signatures for anonymity
  - ZK proof of membership (simplified)
  - Vote encryption
- Create vote tallying logic per method
- Implement audit log system
- Write comprehensive voting tests
- Git commit: "feat: implement voting systems"

#### 6.3 Governance UI (0.5h)
- Create governance components:
  - `CreateProposalForm`
  - `ProposalList` (by status)
  - `ProposalDetail` (with discussion)
  - `VotingInterface` (adapts to voting method)
  - `ResultsDisplay` (with visualizations)
  - `AuditLog` (decision history)
- Add proposal notifications
- Test voting UI flows
- Git commit: "feat: create governance UI"

**Epic 6 Validation**:
- Test: Create proposal → Discuss → Vote → Tally (each method)
- Test: Anonymous ballot verification
- Verify audit log integrity
- Git tag: `v0.6.0-governance`

---

### **EPIC 7: Knowledge Base Module** (2.5 hours)
**Deliverable**: Wiki with markdown editor, versioning, search

#### 7.1 Wiki Core (1h)
- Create wiki store (Zustand)
- Define WikiPage data model:
  - Title, content (markdown), category, tags
  - Version history
  - Edit permissions
- Implement version control:
  - Diff generation
  - Rollback functionality
  - Conflict resolution
- Create wiki Nostr events
- Implement search (full-text with lunr.js or similar)
- Write wiki core tests
- Git commit: "feat: implement wiki core"

#### 7.2 Markdown Editor (1h)
- Install markdown editor (e.g., @uiw/react-md-editor or similar)
- Fetch latest markdown editor docs via Context7
- Create wiki components:
  - `WikiEditor` (markdown with preview)
  - `WikiPageList` (by category/tag)
  - `WikiPage` (rendered view)
  - `VersionHistory` (diff viewer)
  - `WikiSearch`
- Add collaborative editing indicators
- Implement auto-save
- Git commit: "feat: add markdown editor"

#### 7.3 Wiki Organization (0.5h)
- Implement category system
- Create tag management
- Add page linking (wiki-style [[links]])
- Create wiki navigation (sidebar tree)
- Test wiki functionality
- Git commit: "feat: add wiki organization"

**Epic 7 Validation**:
- Test: Create page → Edit → View history → Rollback
- Test: Search functionality
- Test: Collaborative editing conflicts
- Git tag: `v0.7.0-wiki`

---

### **EPIC 8: CRM Module** (3 hours)
**Deliverable**: Airtable-style contact database with views

#### 8.1 CRM Core (1h)
- Create crm store (Zustand)
- Define Contact data model:
  - Core fields (name, email, phone, notes)
  - Custom fields (dynamic schema)
  - Privacy controls per field
  - Tags and categories
- Implement field types:
  - Text, number, date, select, multi-select
  - Relationship (link to other contacts)
  - File attachments
- Create contact Nostr events (with field encryption)
- Write CRM core tests
- Git commit: "feat: implement CRM core"

#### 8.2 CRM Views (1.5h)
- Install table library (e.g., @tanstack/react-table)
- Fetch @tanstack/react-table docs via Context7
- Implement view types:
  - Table view (sortable, filterable)
  - Board view (Kanban-style)
  - Calendar view (for date-based fields)
- Create CRM components:
  - `CRMTable` (with virtual scrolling)
  - `ContactCard` (detailed view)
  - `CreateContactForm`
  - `CustomFieldManager`
  - `ViewSelector` (switch between views)
- Implement sorting, filtering, grouping
- Add bulk operations
- Git commit: "feat: create CRM views"

#### 8.3 Templates & Import/Export (0.5h)
- Create CRM templates:
  - Union organizing
  - Fundraising contacts
  - Volunteer management
  - Legal tracking (NLG/Amnesty style)
  - Civil defense coordination
- Implement CSV import/export
- Add template application logic
- Test import/export flows
- Git commit: "feat: add CRM templates"

**Epic 8 Validation**:
- Test: UI mockup complete
- Test: Custom fields and privacy controls (deferred)
- Test: Import CSV → Edit → Export (deferred)
- Git tag: `v0.8.0-crm`

---

### **EPIC 9: Branding & Theme Update** (2 hours) ✅
**Deliverable**: Rebrand to BuildIt Network, implement shadcn/ui blue theme, responsive layout

#### 9.1 Rebranding (0.5h)
- Create centralized app configuration (src/config/app.ts)
- Define app name: "BuildIt Network - a social action network"
- Update all components to use APP_CONFIG
- Update package.json name and description
- Update README.md, CLAUDE.md, and documentation
- Git commit: "feat: rebrand to BuildIt Network"

#### 9.2 shadcn/ui Blue Theme (1h)
- Update components.json baseColor to "blue"
- Implement proper OKLCH color format in src/index.css
- Configure blue theme for light mode (hue: 252)
- Configure blue theme for dark mode
- Add coordinated chart colors
- Test theme consistency across all components
- Git commit: "feat: implement shadcn/ui blue theme"

#### 9.3 Responsive Layout (0.5h)
- Remove mobile-only grid constraints from App.tsx
- Implement proper responsive breakpoints (sm, md, lg, xl, 2xl)
- Add max-width containers for better desktop experience
- Make tab layouts flexible instead of fixed grid
- Test responsive behavior with Puppeteer
- Git commit: "feat: improve responsive layout"

**Epic 9 Validation**:
- App displays "BuildIt Network - a social action network" branding
- Blue theme matches shadcn/ui reference design
- Layout works well on mobile, tablet, and desktop
- Git tag: `v0.9.0-buildn`

---

### **EPIC 10: Internationalization (i18n)** (2 hours) ✅
**Deliverable**: Multi-language support infrastructure

#### 10.1 i18n Setup (1h)
- Install react-i18next and i18next packages
- Create translation infrastructure (src/i18n/)
- Configure i18n with react-i18next
- Create English locale as base (src/i18n/locales/en.json)
- Define translation keys for all modules:
  - app, auth, nav, messages, groups, events
  - mutualAid, governance, wiki, crm, common
- Integrate i18n in main.tsx
- Git commit: "feat: add i18n infrastructure"

#### 10.2 Locale Preparation (0.5h)
- Create Spanish locale skeleton (es.json)
- Create French locale skeleton (fr.json)
- Create Arabic locale skeleton (ar.json)
- Add RTL support configuration for Arabic
- Git commit: "feat: prepare additional locales"

#### 10.3 Language Switcher (0.5h)
- Create LanguageSwitcher component
- Add language switcher to app header
- Implement locale persistence (localStorage)
- Test language switching
- Git commit: "feat: add language switcher"

**Epic 10 Validation**:
- English locale works correctly
- Language switcher allows changing locales (pending)
- RTL support works for Arabic (pending)
- Git tag: `v0.10.0-i18n`

---

### **EPIC 11: shadcn/ui Refinement** (2 hours)
**Deliverable**: Proper shadcn/ui setup, theming system, dark mode implementation

#### 11.1 Vite Configuration & Setup (0.5h)
- Verify and update Vite configuration per shadcn/ui docs:
  - Update `vite.config.ts` with proper path aliases
  - Add `@tailwindcss/vite` plugin
  - Ensure `path` module is properly imported
- Update TypeScript configuration:
  - Add `baseUrl` and `paths` to both `tsconfig.json` and `tsconfig.app.json`
  - Ensure IDE path resolution works correctly
- Update `src/index.css`:
  - Replace with `@import "tailwindcss";`
  - Remove old Tailwind directives if present
- Verify `components.json` configuration:
  - Set `tailwind.cssVariables: true` (recommended)
  - Confirm `baseColor` is set (currently "blue")
  - Verify all aliases are correct
- Git commit: "refactor: update shadcn/ui Vite configuration"
- make sure we are using this command to install components `bunx --bun shadcn@latest add [component]`
- all components in `src/components/ui` should be replaced with the CLI installed ones. if this breaks some implementations, create work items/epics to fix them if necessary

#### 11.2 Theming System (1h)
- Implement CSS variables theming (recommended approach):
  - Dynamically import css from `/src/themes/` depending on the user configuration
  - Use OKLCH color format for all color variables
- Add custom colors if needed:
  - Warning/success states
  - Brand-specific colors for BuildIt Network
  - Use `@theme inline` for custom color registration
- Validate the components display the themes and components exactly as in this page, where the theme css files are copied from
  - https://ui.shadcn.com/themes
- Test theming:
  - Verify all components use CSS variables correctly
  - Check color contrast for accessibility
  - Test responsiveness of theme system
- Git commit: "feat: implement proper shadcn/ui theming with CSS variables"

#### 11.3 Dark Mode Implementation (0.5h)
- Create `ThemeProvider` component:
  - Copy theme provider from shadcn/ui Vite dark mode docs
  - Implement theme context (dark/light/system)
  - Add localStorage persistence with key "buildn-ui-theme"
  - Handle system preference detection
  - Apply theme class to document root
- Create `useTheme` hook:
  - Export from theme-provider.tsx
  - Provide theme state and setTheme function
- Wrap app with ThemeProvider:
  - Update `App.tsx` or `main.tsx`
  - Set default theme to "system"
- Create `ModeToggle` component:
  - Dropdown with Light/Dark/System options
  - Use lucide-react icons (Sun/Moon)
  - Add to app header/settings area
- Test dark mode:
  - Toggle between light, dark, system modes
  - Verify localStorage persistence
  - Test all components in both themes
  - Ensure smooth transitions
- Git commit: "feat: add dark mode with theme switcher"

**Epic 11 Validation**:
- Vite config matches shadcn/ui documentation
- CSS variables theming works correctly
- Dark mode toggles properly (light/dark/system)
- Theme persists across page reloads
- All components render correctly in both themes
- No console errors related to theming
- Git tag: `v0.11.0-theming`
- the 

---

### **EPIC 12: Social Network Features** (3.5 hours)
**Deliverable**: Friends list, user autocomplete, rich media support

#### 12.1 Social Graph & Contacts (1.5h)
- Create contacts store (Zustand)
- Implement Nostr contact list (NIP-02):
  - Follow/unfollow users
  - Contact metadata (display name, avatar, bio)
  - Relay hints for contacts
- Define relationship types:
  - Friends (mutual follows)
  - Following (one-way)
  - Group members
  - Blocked users
- Create contact components:
  - `ContactsList` (friends, following, followers)
  - `UserProfileCard` (display user info)
  - `AddContactDialog` (search and add users)
  - `BlockedUsersList`
- Implement contact sync across relays
- Write contacts tests
- Git commit: "feat: implement social graph and contacts"

#### 12.2 User Autocomplete System (1h)
- Create autocomplete service:
  - Index contacts by display name and npub
  - Index group members per group
  - Search algorithm with fuzzy matching
- Implement @mention parsing:
  - Detect @username in text inputs
  - Show autocomplete dropdown
  - Insert npub reference on selection
- Create autocomplete components:
  - `UserMentionInput` (rich text input with @mentions)
  - `UserAutocompleteDropdown`
  - `MentionedUser` (display component for mentions)
- Integrate autocomplete in:
  - Message composer (DMs and groups)
  - Event creation forms
  - Proposal creation
  - Wiki editor
  - CRM contact linking
- Add mention notifications
- Write autocomplete tests
- Git commit: "feat: add user autocomplete and @mentions"

#### 12.3 Rich Media Support (1h)
- Implement media handling:
  - Image upload (NIP-94 - File Metadata)
  - Video upload (with thumbnail generation)
  - Audio file support
  - Document attachments
- Create media storage strategy:
  - Upload to Nostr media servers (NIP-96 - HTTP File Storage)
  - IPFS integration (optional)
  - Blossom protocol support (decentralized media)
  - Local caching for privacy
- Implement media encryption:
  - Encrypt media before upload
  - Store decryption keys with message
  - Support for encrypted thumbnails
- Create media components:
  - `MediaUploader` (drag-drop, paste, file picker)
  - `ImageGallery` (lightbox view)
  - `VideoPlayer` (with controls)
  - `AudioPlayer`
  - `FileAttachment` (download handler)
- Integrate media in:
  - Microblogging posts
  - DMs and group messages
  - Event descriptions
  - Wiki pages
  - Mutual aid requests/offers
- Add media privacy controls:
  - Public, group-only, or encrypted
  - Automatic blur for sensitive content
  - EXIF stripping for images
- Implement media moderation:
  - Content warnings
  - Blur on load option
  - Report media functionality
- Write media handling tests
- Git commit: "feat: add rich media support with encryption"

**Epic 12 Validation**:
- Test: Add friend → See in contacts list → @mention in message
- Test: Upload image → Post to microblog → View in feed
- Test: Autocomplete shows friends and group members
- Test: Encrypted media upload/download
- Verify EXIF stripping and privacy controls
- Git tag: `v0.12.0-social`

---

### **EPIC 13: Custom Fields Module** (2.5 hours)
**Deliverable**: Foundational module providing dynamic field capabilities to other modules

#### 13.1 Custom Fields Core (1h)
- Create custom-fields module structure:
  - schema.ts - DBCustomField, DBCustomFieldValue tables
  - types.ts - FieldType enum, CustomField, CustomFieldValue interfaces
  - customFieldsStore.ts - Zustand store for field management
  - customFieldsManager.ts - Business logic for field CRUD
- Implement field types:
  - text, number, date, select, multi-select, file, relationship
- Create field validation system:
  - Required fields, format validation, custom rules
- Implement field serialization/deserialization
- Write custom fields core tests
- Git commit: "feat: implement custom fields module (Epic 13.1)"

#### 13.2 Custom Fields UI (1h)
- Create field management components:
  - `FieldEditor` - Create/edit field definitions
  - `FieldRenderer` - Render field based on type
  - `FieldValueInput` - Input component for each field type
- Create field type components:
  - TextFieldInput, NumberFieldInput, DateFieldInput
  - SelectFieldInput, MultiSelectFieldInput
  - FileFieldInput, RelationshipFieldInput
- Implement field validation UI
- Add field drag-and-drop reordering
- Git commit: "feat: create custom fields UI (Epic 13.2)"

#### 13.3 Module Integration Examples (0.5h)
- Update Events module to use custom fields:
  - Add customFields array to Event interface
  - Example fields: dietary preferences, skill requirements
- Update Mutual Aid module to use custom fields:
  - Add customFields to AidRequest/AidOffer
  - Example fields: allergies, specific needs, availability
- Create integration documentation
- Test custom fields in events and mutual aid
- Git commit: "feat: integrate custom fields in events and mutual aid (Epic 13.3)"

**Epic 13 Validation**:
- Test: Create custom field → Use in event → Save → Display
- Test: All field types work correctly
- Test: Field validation enforced
- Verify custom fields persist and sync
- Git tag: `v0.13.0-custom-fields`

---

### **EPIC 14: Module System & Architecture** (2 hours)
**Deliverable**: Module registry, dynamic DB schema, per-group configuration

**Note**: Terminology changed from "plugins" to "modules" throughout codebase

#### 14.1 Module Architecture (1h)
- Create module registry system:
  - Module interface/contract (with schema, migrations, seeds)
  - Lifecycle hooks (init, enable, disable)
  - Dependency resolution system
- Implement dynamic database schema composition:
  - Core schema (identities, groups, messages, nostrEvents, moduleInstances)
  - Module schema fragments (each module exports its tables)
  - Schema composition at app initialization
  - **All module tables loaded regardless of enable/disable state**
  - Enable/disable is UI-level only (not DB schema)
- Create per-group module config:
  - Enable/disable per group (controls UI/features only)
  - Module-specific settings
  - Permission overrides
- Module isolation - everything from components, state, schema to translations lives in module folder
- Write module system tests
- Git commit: "feat: implement module system architecture (Epic 14.1)"

#### 14.2 Module Integration (1h)
- Refactor existing modules to new pattern:
  - Register custom-fields, events, mutual-aid, governance, wiki, crm
  - Add schema.ts, migrations.ts, seeds.ts to each module
  - Define module metadata and dependencies
  - Expose module APIs
- Create `ModuleSettings` UI:
  - Enable/disable toggles
  - Module configuration panels
  - Permission management per module
- Implement module discovery UI
- Test module loading with dynamic schema
- Git commit: "feat: integrate modules with dynamic schema system (Epic 14.2)"

**Epic 14 Validation**:
- Test: Enable/disable modules per group (UI-level)
- Test: All module DB tables exist even when disabled
- Test: Module settings persistence
- Verify module isolation (no cross-contamination)
- Verify custom-fields → events/mutual-aid dependency chain
- Git tag: `v0.14.0-modules`

---

### **EPIC 15: Database & CRM Modules** (3 hours)
**Deliverable**: Airtable-like database module and CRM with templates

#### 15.1 Database Module Core (1.5h)
- Create database module (extends custom-fields):
  - schema.ts - DBTable, DBView, DBRelationship tables
  - types.ts - DatabaseTable, View, Relationship interfaces
  - databaseStore.ts - Zustand store for table management
  - databaseManager.ts - Business logic for tables, views, relationships
- Implement table creation from scratch:
  - Add custom fields to define table schema
  - Create views (table, board, calendar, gallery)
  - Define relationships (one-to-many, many-to-many)
- Implement query system:
  - Filtering, sorting, grouping
  - View-specific queries
- Write database module tests
- Git commit: "feat: implement database module core (Epic 15.1)"

#### 15.2 Database Module UI (1h)
- Create database components:
  - `TableBuilder` - Visual table schema editor
  - `ViewSelector` - Switch between views
  - `TableView` - Spreadsheet-like table view
  - `BoardView` - Kanban board view
  - `CalendarView` - Calendar view for date fields
  - `GalleryView` - Image/card gallery view
- Implement CRUD operations UI
- Add bulk operations and imports
- Git commit: "feat: create database module UI (Epic 15.2)"

#### 15.3 CRM Module with Templates (0.5h)
- Create CRM module (uses database module):
  - Pre-built templates using DatabaseTable
  - Template: Union Organizing (contacts, actions, timeline)
  - Template: Fundraising (donors, campaigns, contributions)
  - Template: Volunteer Management (volunteers, shifts, skills)
  - Template: Legal/NLG Tracking (cases, arrestees, lawyers, court dates)
  - Template: Civil Defense (emergency contacts, resources, skills)
- Create CRM template selector UI
- Implement template instantiation
- Test CRM templates
- Git commit: "feat: add CRM module with templates (Epic 15.3)"

**Epic 15 Validation**:
- Test: Create database table from scratch
- Test: Apply CRM template → Customize → Use
- Test: All view types work correctly
- Test: Relationships and queries functional
- Git tag: `v0.15.0-database-crm`

---

### **EPIC 16: Navigation & Routing Overhaul** (2.5 hours)
**Deliverable**: Complete navigation system using react-router-dom with responsive patterns

#### 16.1 Core Routing Setup (0.5h)
- Implement react-router-dom routes for all core functionality
- Create route structure for app-level and group-level navigation
- Define module route registration interface:
  - Modules define their own slugs for top-level routes
  - Support both app-level and group-level routes
  - Allow modules to define sub-routes within their components
- Implement nested routing for groups (`/groups/:groupId/*`)
- Add 404 handling and error boundaries
- Create route guards for module permissions
- Git commit: "feat: implement core routing with react-router-dom (Epic 16.1)"

#### 16.2 Account Settings & User Profile (0.5h)
- Create separate Account Settings page (`/settings/*`)
- Implement responsive navigation:
  - Side navigation for desktop (Settings tabs)
  - Dropdown navigation for mobile viewport
- Move Security tab from main landing page to Account Settings
- Create User Profile section in Account Settings
- Add tabs: Profile, Security, Privacy, Notifications, Preferences
- Implement settings persistence
- Git commit: "feat: create account settings with responsive navigation (Epic 16.2)"

#### 16.3 Main App Navigation (0.75h)
- Create responsive main navigation component:
  - Side navigation for desktop (with module list)
  - Dropdown/hamburger menu for mobile
- Add dynamic module loading in navigation:
  - Show all installed modules at the top
  - Automatically update when modules are installed/removed
- Create breadcrumb navigation for deep routes
- Implement navigation state persistence
- Add keyboard shortcuts for navigation
- Git commit: "feat: implement main app navigation (Epic 16.3)"

#### 16.4 Group Navigation (0.5h)
- Create group-level navigation component:
  - Side navigation for desktop (group modules only)
  - Dropdown/hamburger menu for mobile
- Show only enabled modules for each group dynamically:
  - Filter modules based on group configuration
  - Update navigation when modules are enabled/disabled
- Add group switcher in navigation
- Integrate module enable/disable state with nav visibility
- Git commit: "feat: implement group navigation (Epic 16.4)"

#### 16.5 Module Route System & Testing (0.25h)
- Update module interface to support route registration:
  - Define ModuleRoute interface in module system
  - Allow modules to register top-level routes
  - Support lazy loading for module routes
- Test all routing scenarios:
  - Deep linking works correctly
  - Navigation state persists across page reloads
  - Module routes load dynamically
  - Responsive navigation works on all viewports
- Git commit: "feat: complete module route system (Epic 16.5)"

**Epic 16 Validation**:
- Test: All routes working with proper nesting
- Test: Navigation responsive on mobile/tablet/desktop
- Test: Modules register and display routes correctly
- Test: Account settings accessible and organized
- Test: Group navigation shows only enabled modules
- Test: Deep linking and browser back/forward work
- Git tag: `v0.16.0-routing`

---

### **EPIC 17: Security Hardening** (3.5 hours)
**Deliverable**: WebAuthn key protection, device management, Tor integration, security audit

#### 17.1 WebAuthn Key Protection (1h)
- Implement WebAuthn/Passkey integration:
  - Use Web Authentication API for key protection
  - Create secure key storage with WebAuthn-protected encryption
  - Add biometric authentication option (fingerprint, Face ID)
  - Support hardware security keys (YubiKey, etc.)
- Fetch WebAuthn documentation via Context7 or web search
- Create key rotation system:
  - Generate new keys
  - Re-encrypt data with new keys
  - Revocation mechanism
- Implement key backup/recovery:
  - Encrypted backup export
  - WebAuthn-verified recovery
  - Multi-device sync (optional)
- Write security tests for WebAuthn flow
- Git commit: "feat: implement WebAuthn key protection (Epic 17.1)"

#### 17.2 Device Management & Visibility (1h)
- Create device tracking system:
  - Device fingerprinting (browser, OS, screen resolution)
  - Track active sessions (device ID, IP, last active, location estimate)
  - Store device metadata in IndexedDB
- Implement device authorization:
  - New device approval flow
  - Trusted devices list
  - Device naming and icons
- Create DeviceManager component:
  - Show all active sessions with details
  - Current device highlighted
  - Last active timestamp
  - Remote revocation buttons
- Add security features:
  - "Sign out all other devices" button
  - Login notifications for new devices
  - Suspicious activity alerts
  - Device activity history log
- Privacy controls:
  - Option to anonymize IP addresses
  - Limit device fingerprinting detail
  - Auto-expire old sessions
- Write device management tests
- Git commit: "feat: implement device management and visibility (Epic 17.2)"

#### 17.3 Tor Integration (1h)
- Add Tor proxy configuration:
  - SOCKS5 proxy support
  - .onion relay connections
  - Connection through Tor browser
- Implement Tor-specific relay list
- Create `TorSettings` component
- Add Tor status indicator
- Test Tor connectivity (if available)
- Git commit: "feat: add Tor integration (Epic 17.3)"

#### 17.4 Security Audit & Hardening (0.5h)
- Run security audit:
  - Check for XSS vulnerabilities
  - Verify CSRF protection
  - Test encryption/decryption edge cases
  - Review permission bypass attempts
- Implement Content Security Policy (CSP)
- Add security headers (HSTS, X-Frame-Options, X-Content-Type-Options)
- Implement rate limiting for sensitive operations
- Add session timeout and auto-lock
- Create security documentation
- Git commit: "feat: security hardening and audit (Epic 17.4)"

**Epic 17 Validation**:
- Test: WebAuthn authentication with biometrics
- Test: Device authorization and revocation
- Test: Remote sign-out from all devices
- Test: New device notifications
- Test: Key rotation and data re-encryption
- Test: Tor connection to .onion relays
- Run security audit tools (OWASP ZAP, bun audit)
- Verify CSP and security headers
- Git tag: `v0.17.0-security`

---

### **EPIC 18: Testing & Quality** (2 hours)
**Deliverable**: Comprehensive test coverage, E2E tests, performance

#### 18.1 Unit Test Coverage (0.5h)
- Ensure >80% coverage for all core modules
- Write missing unit tests:
  - Edge cases in crypto functions
  - Error handling in Nostr client
  - Store action tests
  - Custom fields validation
  - Database module tests
- Run coverage report: `bun run test:coverage`
- Git commit: "test: improve unit test coverage (Epic 18.1)"

#### 18.2 Integration Tests (0.5h)
- Write integration tests:
  - Nostr client ↔ Storage sync
  - Encryption ↔ Storage (encrypted persistence)
  - Module ↔ Module system (dependency resolution)
  - Custom Fields ↔ Events/Mutual Aid integration
  - Database ↔ CRM templates
  - Multi-relay failover
- Test error recovery scenarios
- Git commit: "test: add integration tests (Epic 18.2)"

#### 18.3 E2E Tests (1h)
- Write Playwright E2E tests:
  - User journey: Register → Create group → Send message
  - Event flow: Create event with custom fields → RSVP → Export calendar
  - Governance: Create proposal → Vote → See results
  - Mutual aid: Create request with custom fields → Match → Fulfill
  - Database: Create table → Add custom fields → Create views
  - CRM: Apply template → Customize → Add records
- Test multi-device sync (multiple browser contexts)
- Test offline/online transitions
- Test module enable/disable per group
- Run E2E suite: `bun run test:e2e`
- Git commit: "test: add E2E tests (Epic 18.3)"

**Epic 18 Validation**:
- All tests passing: `bun run test:all`
- Coverage: >80% overall, >90% for core
- E2E tests: All critical paths covered
- Git tag: `v0.18.0-testing`

---

### **EPIC 19: Polish & Production Prep** (2 hours)
**Deliverable**: Performance optimization, docs, deployment ready

#### 19.1 Performance Optimization (1h)
- Implement performance optimizations:
  - Virtual scrolling for long lists (messages, contacts, database tables)
  - Lazy loading for modules
  - Code splitting by route
  - Image optimization
  - IndexedDB query optimization
- Use Puppeteer to test performance:
  - Measure page load times
  - Check for layout shifts
  - Verify smooth scrolling
- Run Lighthouse audit
- Optimize bundle size
- Git commit: "perf: optimize performance (Epic 19.1)"

#### 19.2 Documentation (0.5h)
- Create user documentation:
  - Getting started guide
  - Feature walkthroughs
  - Module usage guides (custom fields, database, CRM)
  - Security best practices
- Create developer docs:
  - API documentation
  - Module development guide (creating new modules)
  - Custom Fields integration guide
  - Database/CRM template creation
  - Contribution guidelines
- Update PROGRESS.md with final completion status
- Git commit: "docs: add user and developer documentation (Epic 19.2)"

#### 19.3 Production Build (0.5h)
- Configure production build:
  - Environment variables
  - Build optimization
  - Source maps (for debugging)
- Create deployment configuration:
  - Static hosting (Vercel/Netlify)
  - PWA manifest
  - Service worker (offline support)
- Test production build locally
- Create deployment guide
- Git commit: "chore: production build configuration (Epic 19.3)"

**Epic 19 Validation**:
- Lighthouse score: >90 all categories
- Bundle size: <500KB initial
- PWA installable and works offline
- All documentation complete
- Git tag: `v1.0.0-mvp`

---

## 🧰 TOOLING STRATEGY

### Context7 MCP (Documentation)
Use proactively for:
- nostr-tools: `/nbd-wtf/nostr-tools`
- Zustand: `/pmndrs/zustand`
- Dexie.js: `/websites/dexie`
- shadcn/ui: `/shadcn-ui/ui`
- Vitest: `/vitest-dev/vitest`
- @tanstack/react-table: Query as needed
- Markdown editors: Query when implementing

### Puppeteer MCP (Browser Testing)
Use for:
- Visual regression testing
- E2E user flows
- Performance monitoring
- Console error detection

### IDE MCP (Diagnostics)
Use for:
- Real-time TypeScript errors
- Linting issues
- Build diagnostics

---

## 🔄 GIT WORKFLOW

### Commit Strategy
- **Feature commits**: `feat: <description>` (after each sub-task)
- **Refactor commits**: `refactor: <description>`
- **Test commits**: `test: <description>`
- **Fix commits**: `fix: <description>`
- **Epic tags**: `v0.X.0-<epic-name>` (after each epic validation)

### Branch Strategy (Optional)
- Main branch: `main`
- Epic branches: `epic/1-foundation`, `epic/2-auth`, etc.
- Merge to main after epic validation

---

## 🎯 SUCCESS CRITERIA

### Functional Requirements ✅
- Identity creation and management
- Group creation and membership
- Encrypted DMs and group messages
- Event creation, RSVP, calendar export
- Mutual aid requests/offers with matching
- Proposals and multi-method voting
- Wiki with versioning and search
- CRM with custom fields and views
- Module plugin system
- Security features (Tor, )

### Technical Requirements ✅
- TypeScript strict mode, no `any` except strategic
- Test coverage >80% (core >90%)
- All E2E tests passing
- Lighthouse score >90
- Bundle size <500KB initial
- Works offline (PWA)
- Responsive design (mobile/tablet/desktop)

### Documentation Requirements ✅
- User guides
- Developer documentation
- Security documentation
- Deployment guide

---

## 🚨 IMPORTANT REMINDERS

1. **NO WORKAROUNDS**: Fix underlying issues, don't create temporary solutions
2. **REFACTOR, DON'T DUPLICATE**: Use git to track changes, rewrite files completely
3. **USE MCP TOOLS**: Context7 for docs, Puppeteer for testing, IDE for diagnostics
4. **TEST CONTINUOUSLY**: Run tests after each feature, fix immediately
5. **COMMIT FREQUENTLY**: Track all changes with clear messages
6. **TYPE SAFETY**: Avoid `any`, use strategic typing, reuse types
7. **COMPONENT REUSE**: Build on primitives, make features declarative
8. **PERFORMANCE FIRST**: Virtual scrolling, lazy loading, code splitting
9. **SECURITY CONSCIOUS**: E2E encryption, privacy by default, audit regularly
10. **DOCUMENTATION**: Comment complex logic, document public APIs

---

## 📊 PROGRESS TRACKING

After each epic:
1. Run all tests: `bun run test:all`
2. Check diagnostics: IDE MCP tool
3. Verify functionality: Manual testing + Puppeteer
4. Git tag: `v0.X.0-<epic-name>`
5. Update this document with ✅ checkmarks

---

## 🚀 EXECUTION START

1. Initialize project (Epic 1.1)
2. Fetch all library docs via Context7
3. Begin building incrementally
4. Commit frequently
5. Test continuously
6. Ship MVP in <30 hours

**LET'S BUILD!** 🔨
