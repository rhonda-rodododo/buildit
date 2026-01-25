# BuildIt Documentation

## For Claude Code Agents

| Need | Location |
|------|----------|
| **Start here** | `/CLAUDE.md` |
| **Active roadmap** | `clients/web/NEXT_ROADMAP.md` |
| **Completed work** | `clients/web/COMPLETED_ROADMAP.md` |
| **Protocol specs** | `docs/protocol-spec/` |
| **Schema definitions** | `protocol/schemas/` |
| **Test vectors** | `protocol/test-vectors/` |

## Documentation Structure

```
docs/
├── architecture/       # System design, data flow
│   ├── overview.md     # High-level architecture
│   ├── encryption.md   # Encryption strategy
│   └── transport.md    # BLE mesh, Nostr relay
├── guides/             # Implementation guides
│   ├── adding-module.md
│   ├── schema-changes.md
│   └── testing.md
├── protocol-spec/      # Protocol specifications
│   ├── 08-schema-versioning.md
│   ├── 09-schema-codegen.md
│   ├── 10-version-negotiation.md
│   ├── 11-client-implementation-guide.md
│   └── 12-migration-guide.md
└── roadmap/            # Planning docs
    └── archive/        # Historical planning docs
```

## Quick Links

### Protocol
- [Schema Versioning](./protocol-spec/08-schema-versioning.md) - Version policy, graceful degradation
- [Code Generation](./protocol-spec/09-schema-codegen.md) - Schema → native types
- [Version Negotiation](./protocol-spec/10-version-negotiation.md) - Cross-client compatibility
- [Client Implementation](./protocol-spec/11-client-implementation-guide.md) - Platform guides
- [Migration Guide](./protocol-spec/12-migration-guide.md) - Schema evolution

### Architecture
- [Web/Desktop Architecture](../clients/web/ARCHITECTURE.md)
- [Encryption Strategy](../clients/web/ENCRYPTION_STRATEGY.md)
- [Privacy & Threat Model](../clients/web/PRIVACY.md)

### Development
- [Web Client CLAUDE.md](../clients/web/CLAUDE.md)
- [iOS Client CLAUDE.md](../clients/ios/CLAUDE.md)
- [Android Client CLAUDE.md](../clients/android/CLAUDE.md)
- [Desktop Client CLAUDE.md](../clients/desktop/CLAUDE.md)
