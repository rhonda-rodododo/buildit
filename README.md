# BuildN - a social action network

> A privacy-first organizing platform built on Nostr protocol for activist groups, co-ops, and community organizers.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Claude Code](https://img.shields.io/badge/Built%20with-Claude%20Code-5C5CFF)](https://claude.ai/code)

## 🌟 Features

- 🔐 **End-to-End Encryption** - NIP-17 protocol with metadata protection
- 📅 **Event Management** - Create events with multiple privacy levels, RSVP tracking
- 🤝 **Mutual Aid** - Resource sharing and ride share network
- 🗳️ **Governance** - Proposals with multiple voting systems (simple, ranked-choice, quadratic, etc.)
- 📚 **Knowledge Base** - Collaborative wiki with version control
- 📊 **CRM** - Airtable-style contact management with custom fields
- 🔌 **Plugin System** - Modular architecture, enable features per group
- 🌐 **Decentralized** - Built on Nostr protocol, censorship-resistant
- 🔒 **Privacy-First** - Tor integration, hardware wallet support, metadata randomization

## 🚀 Quick Start

### For Users

```bash
# Clone the repository
git clone <repository-url>
cd buildn

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:5174](http://localhost:5174) and create your identity!

### For Claude Code (Autonomous Build)

```
Please execute PROMPT.md to build the complete BuildN MVP.
```

Claude Code will autonomously build the entire application in under 30 hours.

## 📚 Documentation

### For Users
- **[GETTING_STARTED.md](GETTING_STARTED.md)** - User guide and developer setup
- **[PRIVACY.md](PRIVACY.md)** - Threat model and security considerations

### For Developers
- **[CLAUDE.md](CLAUDE.md)** - Project overview and navigation guide
- **[PROMPT.md](PROMPT.md)** - Complete execution plan for autonomous build (all epics)
- **[PROGRESS.md](PROGRESS.md)** - Detailed progress tracking with checkboxes (current status)
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and data flow
- **[ENCRYPTION_STRATEGY.md](ENCRYPTION_STRATEGY.md)** - Encryption architecture and decisions

## 🏗️ Architecture

### Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: shadcn/ui (Radix primitives + Tailwind CSS)
- **State**: Zustand with persistence
- **Storage**: Dexie.js (IndexedDB)
- **Nostr**: nostr-tools
- **Encryption**:
  - NIP-17 (gift-wrapped NIP-44) for DMs and small groups
  - Noise Protocol for large groups (Phase 2)
  - Future: BLE mesh for offline communication
- **Testing**: Vitest + React Testing Library + Playwright

### Encryption

We use a **layered encryption approach**:

1. **DMs**: NIP-17 (best metadata protection)
2. **Small Groups (<100)**: NIP-17 multi-wrap
3. **Large Groups (>100)**: Noise Protocol (Phase 2)
4. **Future Offline**: Noise Protocol over BLE mesh

See [ENCRYPTION_STRATEGY.md](ENCRYPTION_STRATEGY.md) for full details.

### Modules (Plugins)

Each group can independently enable:

- **Events** - Event management, RSVPs, calendar integration
- **Mutual Aid** - Resource requests/offers, ride sharing
- **Governance** - Proposals, multiple voting methods, anonymous ballots
- **Wiki** - Knowledge base with versioning and search
- **CRM** - Contact database with custom fields and views

## 🔒 Security & Privacy

- ✅ End-to-end encryption (NIP-17/44)
- ✅ Metadata protection (timestamp randomization, ephemeral keys)
- ✅ Tor integration for anonymity
- ✅ Hardware wallet support (NIP-46)
- ✅ Local-first storage (IndexedDB)
- ✅ Multi-identity support
- ✅ Zero-knowledge relay architecture

**Threat Model**: See [PRIVACY.md](PRIVACY.md)

## 🧪 Testing

```bash
# Unit tests
npm run test

# Unit tests with coverage
npm run test:coverage

# E2E tests
npm run test:e2e

# All tests
npm run test:all
```

## 🛠️ Development

### Project Structure

```
buildit-network/
├── src/
│   ├── core/              # Core infrastructure
│   │   ├── nostr/        # Nostr client, NIPs
│   │   ├── crypto/       # NIP-17 encryption
│   │   └── storage/      # Dexie database
│   ├── lib/              # Shared libraries
│   ├── modules/          # Feature modules
│   ├── components/       # UI components
│   ├── stores/           # Zustand stores
│   └── hooks/            # React hooks
└── tests/                # Tests
```

### Key Commands

```bash
npm run dev          # Development server
npm run build        # Production build
npm run preview      # Preview production build
npm run test         # Run tests
npm run lint         # Lint code
npm run type-check   # TypeScript check
```

## 🌍 Deployment

### Static Hosting

Deploy to Vercel, Netlify, or any static host:

```bash
npm run build
# Upload 'dist' folder
```

### PWA (Progressive Web App)

The app works offline and can be installed:

```bash
npm run build
# PWA manifest and service worker included
```

### Self-Hosting

```bash
# Build
npm run build

# Serve with any static server
npx serve dist
```

## 🤝 Contributing

Contributions are welcome! Please read our [contribution guidelines](CONTRIBUTING.md) first.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm run test:all`)
5. Commit with clear messages (`git commit -m 'feat: add amazing feature'`)
6. Push to your fork (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Nostr Protocol** - Decentralized social protocol
- **shadcn/ui** - Beautiful UI components
- **Zustand** - State management
- **Dexie.js** - IndexedDB wrapper
- **BitChat** - Inspiration for offline mesh networking
- **NIP Authors** - For encryption specifications (NIP-17, NIP-44, NIP-59)

## 🔗 Links

- [Nostr Protocol](https://nostr.com/)
- [NIP-17 Spec](https://github.com/nostr-protocol/nips/blob/master/17.md)
- [NIP-44 Spec](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [Noise Protocol Framework](https://noiseprotocol.org/)
- [BitChat (Inspiration)](https://github.com/permissionlesstech/bitchat)

## 📞 Support

- **Documentation**: See `/docs` folder
- **Issues**: [GitHub Issues](https://github.com/your-org/buildit-network/issues)
- **Security**: Report privately to security@example.com

---

**Built with ❤️ for activists, organizers, and communities fighting for change.**

**Privacy is a right, not a privilege.**
