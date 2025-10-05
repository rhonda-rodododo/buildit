# BuildIt Network - a social action network

> A privacy-first organizing platform built on Nostr protocol for activist groups, co-ops, unions, and community organizers.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Claude Code](https://img.shields.io/badge/Built%20with-Claude%20Code-5C5CFF)](https://claude.ai/code)

## 🤖 For Claude Code

This project is designed for autonomous execution by Claude Code.

### Quick Start

```bash
# Execute the autonomous build plan
Read PROMPT.md and execute all epics sequentially
```

### Documentation Structure

- **[CLAUDE.md](./CLAUDE.md)** - Project overview and navigation guide (START HERE)
- **[PROMPT.md](./PROMPT.md)** - Complete execution plan with all epics and tasks
- **[PROGRESS.md](./PROGRESS.md)** - Current status and progress tracking with checkboxes
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and data flow
- **[ENCRYPTION_STRATEGY.md](./ENCRYPTION_STRATEGY.md)** - Encryption decisions and implementation
- **[PRIVACY.md](./PRIVACY.md)** - Threat model and security considerations

## 🏗️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: shadcn/ui (Radix primitives) + Tailwind CSS
- **State**: Zustand with persistence
- **Storage**: Dexie.js (IndexedDB)
- **Protocol**: Nostr (nostr-tools)
- **Encryption**:
  - NIP-17 (gift-wrapped NIP-44) for DMs and small groups
  - Noise Protocol for large groups (Phase 2)
  - Future: BLE mesh for offline
- **i18n**: react-i18next (English, Spanish, French, Arabic with RTL)
- **Testing**: Vitest + React Testing Library + Playwright

## 🎯 Current Status

**Version**: v1.0.0-mvp (Release Candidate)
**Completed Epics**: 1-16 + Performance Optimizations
**Build**: Successful ✅ (1.44MB bundle, 476KB gzipped)
**PWA**: Enabled with offline support ✅
**Tests**: 88/88 unit tests passing ✅

### Completed Features ✅
- ✅ Foundation & Nostr Protocol (NIP-01, 17, 44, 59)
- ✅ Authentication & Identity Management
- ✅ Groups & Permissions System
- ✅ Encrypted Messaging (DMs & Groups)
- ✅ Events Module (RSVP, Calendar, iCal export)
- ✅ Mutual Aid (Requests, Offers, Ride Share)
- ✅ Governance (Proposals, 5 voting methods)
- ✅ Wiki (Markdown, Version Control)
- ✅ Custom Fields System (11 field types)
- ✅ Database Module (Airtable-like tables & views)
- ✅ CRM (5 pre-built templates)
- ✅ Social Features (Contacts, @mentions, Media)
- ✅ Module System (Dynamic loading, per-group config)
- ✅ Navigation & Routing (React Router, Responsive)
- ✅ Theming & Dark Mode (7 color themes)
- ✅ i18n Infrastructure (English + 3 language stubs)
- ✅ Security (WebAuthn, Device Management)
- ✅ Performance (Code splitting, lazy loading)
- ✅ PWA (Offline support, installable)

See [PROGRESS.md](./PROGRESS.md) for detailed status.

## 📊 Module System

Completed modules (all as plugins):
- ✅ **Messaging** - DMs, group threads, @mentions
- ✅ **Events** - Event management, RSVPs, calendar
- ✅ **Mutual Aid** - Resource sharing, ride shares
- ✅ **Governance** - Proposals, multiple voting methods
- ✅ **Wiki** - Collaborative docs with versioning
- ✅ **CRM** - Contact database with custom fields
- ✅ **Document Suite** - WYSIWYG editor, collaboration
- ✅ **File Manager** - Encrypted uploads, folders

## 🔒 Security Features

- ✅ End-to-end encryption (NIP-17/44)
- ✅ Metadata protection
- ✅ Local-first storage
- ✅ Multi-identity support
- ✅ Multi-language (i18n with RTL)
- ✅ Module plugin architecture

## 🚀 Development Commands

```bash
bun install        # Install dependencies
bun run dev        # Development server
bun run build      # Production build
bun run test       # Run tests
bun run lint       # Lint code
```

## 🚀 Deployment

### Static Hosting (Recommended)

The app can be deployed to any static hosting service:

#### Vercel (One-Click Deploy)
```bash
npm install -g vercel
vercel --prod
```

#### Netlify
```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

#### GitHub Pages
```bash
npm run build
# Push dist/ to gh-pages branch
```

### Docker Deployment
```dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Environment Variables

Create `.env` file:
```env
VITE_DEFAULT_RELAYS=wss://relay.damus.io,wss://relay.nostr.band
VITE_APP_NAME=BuildIt Network
```

### PWA Requirements

The app is a Progressive Web App and includes:
- ✅ Service worker for offline support
- ✅ Web App Manifest
- ✅ Caching strategy (Workbox)
- ✅ Installable on mobile/desktop

**Note**: HTTPS is required for PWA features to work properly.

### Production Checklist

- [ ] Set custom relay URLs in `.env`
- [ ] Configure custom domain
- [ ] Enable HTTPS (required for PWA)
- [ ] Add PWA icons to `/public` (if custom branding)
- [ ] Test offline functionality
- [ ] Run Lighthouse audit (target: >90 score)
- [ ] Monitor bundle size (<500KB gzipped initial load)

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built with ❤️ using Claude Code for activists, organizers, and communities fighting for change.**

**Privacy is a right, not a privilege.**
