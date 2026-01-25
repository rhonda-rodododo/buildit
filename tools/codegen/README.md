# Schema Code Generator

Generates native type definitions from JSON Schema files in `protocol/schemas/`.

## Usage

```bash
# From repo root
bun run codegen

# Or from this directory
bun run generate
```

## Output

| Target | Output Location |
|--------|-----------------|
| TypeScript | `clients/web/src/generated/schemas/` |
| Swift | `clients/ios/Sources/Generated/Schemas/` |
| Kotlin | `clients/android/app/src/main/java/network/buildit/generated/schemas/` |

## Configuration

See `codegen.config.ts` for target configuration.

## Features

- Generates Zod schemas for TypeScript runtime validation
- Preserves unknown fields for relay forwarding
- Includes version constants
- Generates test helpers

## Adding a New Target

1. Create generator in `generators/{target}.ts`
2. Register in `codegen.config.ts`
3. Run `bun run generate`
