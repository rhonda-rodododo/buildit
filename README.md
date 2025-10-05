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

**Version**: v0.13.0-plugins
**Completed Epics**: 1-10, 12.1-12.2, 13
**Build**: Successful ✅ (1.86MB bundle, 613KB gzipped)

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

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built with ❤️ using Claude Code for activists, organizers, and communities fighting for change.**

**Privacy is a right, not a privilege.**
