# Contributing to BuildIt

Thank you for your interest in contributing to BuildIt! This platform serves
activist groups, co-ops, unions, and community organizers with privacy-first tools.

## Getting Started

```bash
# Clone the repository
git clone https://github.com/buildit-network/buildit.git
cd buildit

# Install dependencies (uses bun, never npm or yarn)
bun install

# Start development
bun run dev
```

## Repository Structure

```
buildit/
├── clients/web/       # React + Vite UI (embedded in Tauri desktop)
├── clients/desktop/   # Tauri (Rust) desktop app
├── clients/ios/       # Swift + SwiftUI native app
├── clients/android/   # Kotlin + Compose native app
├── packages/crypto/   # Rust crypto library + UniFFI bindings
├── protocol/schemas/  # JSON Schema (source of truth for all types)
├── workers/           # Cloudflare Workers (relay, API, SSR)
├── tools/             # Code generators
└── docs/              # Documentation
```

## Development Workflow

### Branch Naming

```
feat/description      # New features
fix/description       # Bug fixes
docs/description      # Documentation
refactor/description  # Code refactoring
```

### Commit Format

```
feat(scope): description      # New feature
fix(scope): description       # Bug fix
docs(scope): description      # Documentation
refactor(scope): description  # Code refactoring
```

Scopes: `web`, `ios`, `android`, `desktop`, `protocol`, `crypto`, `docs`

### Testing

```bash
bun run test          # Run web tests
bun run typecheck     # TypeScript type checking
bun run codegen       # Generate types from schemas
```

All changes must pass tests and type checking before merge.

## Code Standards

- **TypeScript**: Strict mode, no `any` types without justification
- **Rust**: Follow clippy recommendations
- **Swift**: Swift concurrency (async/await)
- **Kotlin**: Coroutines for async, Jetpack Compose for UI

## Security Considerations

BuildIt uses end-to-end encryption (NIP-17/NIP-44) and zero-knowledge
relay architecture. When contributing:

- Never log or expose private keys
- Never send plaintext sensitive data to servers
- Maintain zero-knowledge principles in Workers code
- Test encryption/decryption round-trips

### Reporting Security Issues

**Do not report security issues via public GitHub issues.**

Email security reports to **security@buildit.network** with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment

We will respond within 48 hours.

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with appropriate tests
3. Run `bun run test && bun run typecheck`
4. Submit a PR with a clear description
5. Respond to review feedback
6. Squash and merge after approval

## License

By contributing, you agree that your contributions will be licensed under the
[AGPL-3.0-or-later](LICENSE) license.
