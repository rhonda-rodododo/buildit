# 11. Client Implementation Guide

## Overview

This guide provides implementation instructions for BuildIt clients across all platforms. Follow this guide to ensure cross-client compatibility and crisis resilience.

## Implementation Checklist

### Core Requirements

Every client MUST implement:

- [ ] **Message Parsing**
  - [ ] Parse known fields from module messages
  - [ ] Preserve unknown fields for relay/re-serialization
  - [ ] Support graceful degradation for unknown versions
  - [ ] Store unparseable messages for later processing

- [ ] **Version Metadata**
  - [ ] Include `_v` in all outgoing messages
  - [ ] Include `_minReader` when using new features
  - [ ] Read and interpret version metadata from incoming messages
  - [ ] Include schema bundle version in DeviceInfo

- [ ] **Relay Behavior**
  - [ ] Relay messages before parsing content
  - [ ] Never reject messages based on content parsing failures
  - [ ] Preserve message integrity for forwarding

- [ ] **Schema Bundle**
  - [ ] Store current schema bundle version
  - [ ] Verify bundle signatures
  - [ ] Apply bundle updates
  - [ ] Support BLE schema sync protocol

- [ ] **UI Degradation**
  - [ ] Full UI for compatible content
  - [ ] Partial UI with hints for partially compatible content
  - [ ] Placeholder UI for unknown modules
  - [ ] "Update available" prompts

## Platform-Specific Implementation

### TypeScript/React (Web/Desktop)

#### Module Message Type

```typescript
// src/core/schema/types.ts

/**
 * Base type for all versioned module content
 */
export interface VersionedContent {
  /** Schema version that created this content */
  _v: string;

  /** Minimum reader version (optional, defaults to _v) */
  _minReader?: string;

  /** Module identifier */
  _module: string;
}

/**
 * Result of parsing a versioned message
 */
export interface ParseResult<T> {
  /** Parsed content (may be partial) */
  parsed: Partial<T>;

  /** Raw content preserved for relay */
  raw: unknown;

  /** Parse metadata */
  meta: ParseMeta;
}

export interface ParseMeta {
  /** Version that wrote this content */
  writerVersion: string;

  /** Minimum version required to fully parse */
  minReaderVersion: string;

  /** Our current version */
  readerVersion: string;

  /** Whether we can fully parse this content */
  canFullyParse: boolean;

  /** Fields we couldn't parse */
  unknownFields: string[];

  /** Required fields that are missing */
  missingRequiredFields: string[];

  /** How to display this content */
  displayMode: DisplayMode;
}

export type DisplayMode =
  | 'full'           // All fields parsed
  | 'partial'        // Some fields unknown
  | 'placeholder'    // Critical fields missing
  | 'unknown_module'; // Module not installed
```

#### Schema Registry

```typescript
// src/core/schema/registry.ts

import { z } from 'zod';
import semver from 'semver';

interface SchemaRegistryEntry {
  moduleId: string;
  version: string;
  minReaderVersion: string;
  schema: z.ZodType<unknown>;
  deprecatedAt?: string;
  sunsetAt?: string;
}

class SchemaRegistry {
  private schemas = new Map<string, SchemaRegistryEntry>();
  private bundleVersion: string = '1.0.0';
  private bundleCreatedAt: number = Date.now();

  /**
   * Register a module schema
   */
  register(entry: SchemaRegistryEntry): void {
    this.schemas.set(entry.moduleId, entry);
  }

  /**
   * Get schema for a module
   */
  getSchema(moduleId: string): SchemaRegistryEntry | undefined {
    return this.schemas.get(moduleId);
  }

  /**
   * Check if we can fully parse a message
   */
  canFullyParse(moduleId: string, writerVersion: string, minReaderVersion?: string): boolean {
    const entry = this.schemas.get(moduleId);
    if (!entry) return false;

    const minVersion = minReaderVersion ?? writerVersion;
    return semver.gte(entry.version, minVersion);
  }

  /**
   * Parse a message with graceful degradation
   */
  parse<T>(moduleId: string, data: unknown): ParseResult<T> {
    const entry = this.schemas.get(moduleId);
    const raw = structuredClone(data);
    const versionedData = data as VersionedContent;

    // Unknown module
    if (!entry) {
      return {
        parsed: {} as Partial<T>,
        raw,
        meta: {
          writerVersion: versionedData._v ?? 'unknown',
          minReaderVersion: versionedData._minReader ?? versionedData._v ?? 'unknown',
          readerVersion: 'unknown',
          canFullyParse: false,
          unknownFields: [],
          missingRequiredFields: [],
          displayMode: 'unknown_module',
        },
      };
    }

    const writerVersion = versionedData._v ?? entry.version;
    const minReaderVersion = versionedData._minReader ?? writerVersion;
    const canFullyParse = semver.gte(entry.version, minReaderVersion);

    // Attempt parse
    const result = entry.schema.safeParse(data);

    if (result.success) {
      return {
        parsed: result.data as Partial<T>,
        raw,
        meta: {
          writerVersion,
          minReaderVersion,
          readerVersion: entry.version,
          canFullyParse,
          unknownFields: this.findUnknownFields(data, entry.schema),
          missingRequiredFields: [],
          displayMode: canFullyParse ? 'full' : 'partial',
        },
      };
    }

    // Graceful degradation: parse what we can
    const partialParsed = this.parsePartial<T>(data, entry.schema);
    const missingRequired = this.findMissingRequired(result.error);

    return {
      parsed: partialParsed,
      raw,
      meta: {
        writerVersion,
        minReaderVersion,
        readerVersion: entry.version,
        canFullyParse: false,
        unknownFields: this.findUnknownFields(data, entry.schema),
        missingRequiredFields: missingRequired,
        displayMode: missingRequired.length > 0 ? 'placeholder' : 'partial',
      },
    };
  }

  /**
   * Apply a new schema bundle
   */
  async applyBundle(bundle: SchemaBundle): Promise<boolean> {
    // Verify signature
    const valid = await this.verifyBundleSignature(bundle);
    if (!valid) {
      throw new Error('Invalid bundle signature');
    }

    // Check if newer
    if (bundle.createdAt <= this.bundleCreatedAt) {
      return false; // Already have newer
    }

    // Apply schemas
    for (const [moduleId, schemaInfo] of Object.entries(bundle.schemas)) {
      // Generate Zod schema from JSON Schema
      const zodSchema = jsonSchemaToZod(schemaInfo.schema);

      this.register({
        moduleId,
        version: schemaInfo.version,
        minReaderVersion: schemaInfo.minReaderVersion ?? schemaInfo.version,
        schema: zodSchema,
      });
    }

    this.bundleVersion = bundle.version;
    this.bundleCreatedAt = bundle.createdAt;

    // Re-process deferred messages
    await this.processDeferredMessages();

    return true;
  }

  private findUnknownFields(data: unknown, schema: z.ZodType): string[] {
    // Implementation: compare data keys to schema shape
    return [];
  }

  private parsePartial<T>(data: unknown, schema: z.ZodType): Partial<T> {
    // Implementation: parse each field individually
    return {} as Partial<T>;
  }

  private findMissingRequired(error: z.ZodError): string[] {
    return error.issues
      .filter(issue => issue.code === 'invalid_type' && issue.received === 'undefined')
      .map(issue => issue.path.join('.'));
  }

  private async verifyBundleSignature(bundle: SchemaBundle): Promise<boolean> {
    // Implementation: Ed25519 signature verification
    return true;
  }

  private async processDeferredMessages(): Promise<void> {
    // Implementation: re-process stored messages
  }
}

export const schemaRegistry = new SchemaRegistry();
```

#### UI Components

```tsx
// src/components/schema/VersionedContent.tsx

import React from 'react';
import { ParseResult, DisplayMode } from '@/core/schema/types';

interface VersionedContentProps<T> {
  result: ParseResult<T>;
  renderFull: (data: T) => React.ReactNode;
  renderPartial?: (data: Partial<T>, unknownFields: string[]) => React.ReactNode;
  renderPlaceholder?: (meta: ParseMeta) => React.ReactNode;
  renderUnknownModule?: (moduleId: string) => React.ReactNode;
}

export function VersionedContent<T>({
  result,
  renderFull,
  renderPartial,
  renderPlaceholder,
  renderUnknownModule,
}: VersionedContentProps<T>) {
  const { parsed, meta } = result;

  switch (meta.displayMode) {
    case 'full':
      return <>{renderFull(parsed as T)}</>;

    case 'partial':
      if (renderPartial) {
        return <>{renderPartial(parsed, meta.unknownFields)}</>;
      }
      return (
        <div className="space-y-2">
          {renderFull(parsed as T)}
          <VersionHint mode="partial" />
        </div>
      );

    case 'placeholder':
      if (renderPlaceholder) {
        return <>{renderPlaceholder(meta)}</>;
      }
      return <PlaceholderCard meta={meta} />;

    case 'unknown_module':
      if (renderUnknownModule) {
        return <>{renderUnknownModule(meta.moduleId)}</>;
      }
      return <UnknownModuleCard moduleId={meta.moduleId} />;
  }
}

function VersionHint({ mode }: { mode: 'partial' | 'outdated' }) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
      <InfoIcon className="h-4 w-4" />
      <span>
        {mode === 'partial'
          ? t('schema.partialContent')
          : t('schema.outdatedContent')}
      </span>
      <Button variant="link" size="sm" onClick={openAppStore}>
        {t('schema.updateApp')}
      </Button>
    </div>
  );
}

function PlaceholderCard({ meta }: { meta: ParseMeta }) {
  const { t } = useTranslation();

  return (
    <Card className="border-warning">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangleIcon className="h-5 w-5 text-warning" />
          {t('schema.updateRequired')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          {t('schema.newerFormatMessage', {
            writerVersion: meta.writerVersion,
            readerVersion: meta.readerVersion,
          })}
        </p>
        <div className="flex gap-2 mt-4">
          <Button onClick={openAppStore}>
            {t('schema.updateApp')}
          </Button>
          <Button variant="outline" onClick={viewBasicInfo}>
            {t('schema.viewBasic')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function UnknownModuleCard({ moduleId }: { moduleId: string }) {
  const { t } = useTranslation();

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackageIcon className="h-5 w-5" />
          {t('schema.newFeature')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          {t('schema.unknownModuleMessage', { moduleId })}
        </p>
        <div className="flex gap-2 mt-4">
          <Button onClick={openAppStore}>
            {t('schema.updateApp')}
          </Button>
          <Button variant="outline" onClick={() => learnMore(moduleId)}>
            {t('schema.learnMore')}
          </Button>
          <Button variant="ghost" onClick={remindLater}>
            {t('schema.remindLater')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Swift (iOS)

#### Schema Registry

```swift
// Sources/Core/Schema/SchemaRegistry.swift

import Foundation

public final class SchemaRegistry: @unchecked Sendable {
    public static let shared = SchemaRegistry()

    private var schemas: [String: SchemaEntry] = [:]
    private var bundleVersion: String = "1.0.0"
    private var bundleCreatedAt: Date = Date()

    private let lock = NSLock()

    struct SchemaEntry {
        let moduleId: String
        let version: SemanticVersion
        let minReaderVersion: SemanticVersion
        let decoder: (Data) throws -> Any
        let encoder: (Any) throws -> Data
    }

    // MARK: - Registration

    public func register<T: Codable>(
        moduleId: String,
        version: String,
        minReaderVersion: String? = nil,
        type: T.Type
    ) {
        lock.lock()
        defer { lock.unlock() }

        schemas[moduleId] = SchemaEntry(
            moduleId: moduleId,
            version: SemanticVersion(version)!,
            minReaderVersion: SemanticVersion(minReaderVersion ?? version)!,
            decoder: { data in try JSONDecoder().decode(T.self, from: data) },
            encoder: { value in try JSONEncoder().encode(value as! T) }
        )
    }

    // MARK: - Parsing

    public func parse<T>(_ moduleId: String, from data: Data) -> ParseResult<T> {
        lock.lock()
        defer { lock.unlock() }

        guard let entry = schemas[moduleId] else {
            return .unknownModule(raw: data)
        }

        // Extract version metadata
        let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        let writerVersion = SemanticVersion(json?["_v"] as? String ?? entry.version.string)!
        let minReaderVersion = SemanticVersion(
            json?["_minReader"] as? String ?? writerVersion.string
        )!

        let canFullyParse = entry.version >= minReaderVersion

        do {
            let value = try entry.decoder(data) as! T
            return ParseResult(
                parsed: value,
                raw: data,
                meta: ParseMeta(
                    writerVersion: writerVersion,
                    minReaderVersion: minReaderVersion,
                    readerVersion: entry.version,
                    canFullyParse: canFullyParse,
                    displayMode: canFullyParse ? .full : .partial
                )
            )
        } catch {
            // Graceful degradation
            return parsePartial(moduleId: moduleId, data: data, entry: entry)
        }
    }

    // MARK: - Bundle Management

    public func applyBundle(_ bundle: SchemaBundle) async throws -> Bool {
        // Verify signature
        guard await verifySignature(bundle) else {
            throw SchemaError.invalidSignature
        }

        // Check freshness
        guard bundle.createdAt > bundleCreatedAt else {
            return false
        }

        // Apply schemas
        for (moduleId, schemaInfo) in bundle.schemas {
            // Register dynamic schema
            registerDynamic(
                moduleId: moduleId,
                version: schemaInfo.version,
                schema: schemaInfo.schema
            )
        }

        bundleVersion = bundle.version
        bundleCreatedAt = bundle.createdAt

        // Notify observers
        NotificationCenter.default.post(
            name: .schemaBundleUpdated,
            object: nil,
            userInfo: ["version": bundle.version]
        )

        return true
    }

    // MARK: - Device Info

    public func getDeviceVersionInfo() -> DeviceVersionInfo {
        lock.lock()
        defer { lock.unlock() }

        var moduleVersions: [String: ModuleVersionInfo] = [:]
        for (moduleId, entry) in schemas {
            moduleVersions[moduleId] = ModuleVersionInfo(
                current: entry.version.string,
                supported: [entry.version.string] // Could track history
            )
        }

        return DeviceVersionInfo(
            clientVersion: Bundle.main.appVersion,
            schemaBundleVersion: bundleVersion,
            schemaBundleCreatedAt: bundleCreatedAt,
            moduleVersions: moduleVersions
        )
    }
}

// MARK: - Parse Result

public enum ParseResult<T> {
    case full(value: T, meta: ParseMeta)
    case partial(value: T, meta: ParseMeta)
    case placeholder(raw: Data, meta: ParseMeta)
    case unknownModule(raw: Data)

    public var displayMode: DisplayMode {
        switch self {
        case .full: return .full
        case .partial: return .partial
        case .placeholder: return .placeholder
        case .unknownModule: return .unknownModule
        }
    }
}

public enum DisplayMode {
    case full
    case partial
    case placeholder
    case unknownModule
}
```

#### SwiftUI Views

```swift
// Sources/UI/Components/VersionedContentView.swift

import SwiftUI

public struct VersionedContentView<T, FullContent: View, PartialContent: View>: View {
    let result: ParseResult<T>
    let fullContent: (T) -> FullContent
    let partialContent: ((T, ParseMeta) -> PartialContent)?

    public init(
        result: ParseResult<T>,
        @ViewBuilder fullContent: @escaping (T) -> FullContent,
        @ViewBuilder partialContent: ((T, ParseMeta) -> PartialContent)? = nil
    ) {
        self.result = result
        self.fullContent = fullContent
        self.partialContent = partialContent
    }

    public var body: some View {
        switch result {
        case .full(let value, _):
            fullContent(value)

        case .partial(let value, let meta):
            VStack(spacing: 12) {
                if let partialContent {
                    partialContent(value, meta)
                } else {
                    fullContent(value)
                }
                VersionHintView(mode: .partial)
            }

        case .placeholder(_, let meta):
            PlaceholderView(meta: meta)

        case .unknownModule:
            UnknownModuleView()
        }
    }
}

struct VersionHintView: View {
    enum Mode { case partial, outdated }
    let mode: Mode

    var body: some View {
        HStack {
            Image(systemName: "info.circle")
                .foregroundColor(.secondary)

            Text(mode == .partial
                 ? "Some content requires an update"
                 : "This content is from a newer version")
                .font(.footnote)
                .foregroundColor(.secondary)

            Spacer()

            Button("Update") {
                // Open App Store
            }
            .font(.footnote)
        }
        .padding()
        .background(Color.secondary.opacity(0.1))
        .cornerRadius(8)
    }
}

struct PlaceholderView: View {
    let meta: ParseMeta

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundColor(.orange)

            Text("Update Required")
                .font(.headline)

            Text("This content requires version \(meta.minReaderVersion.string) or later.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            HStack(spacing: 12) {
                Button("Update App") {
                    // Open App Store
                }
                .buttonStyle(.borderedProminent)

                Button("View Basic") {
                    // Show partial content
                }
                .buttonStyle(.bordered)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(radius: 2)
    }
}

struct UnknownModuleView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "shippingbox")
                .font(.largeTitle)
                .foregroundColor(.blue)

            Text("New Feature")
                .font(.headline)

            Text("This group uses a feature that requires an app update.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            HStack(spacing: 12) {
                Button("Update App") { }
                    .buttonStyle(.borderedProminent)

                Button("Learn More") { }
                    .buttonStyle(.bordered)

                Button("Remind Later") { }
                    .buttonStyle(.plain)
            }
        }
        .padding()
    }
}
```

### Kotlin (Android)

#### Schema Registry

```kotlin
// core/schema/SchemaRegistry.kt

package network.buildit.core.schema

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.Json
import kotlinx.serialization.KSerializer

object SchemaRegistry {
    private val mutex = Mutex()
    private val schemas = mutableMapOf<String, SchemaEntry<*>>()
    private var bundleVersion = "1.0.0"
    private var bundleCreatedAt = System.currentTimeMillis()

    data class SchemaEntry<T>(
        val moduleId: String,
        val version: SemanticVersion,
        val minReaderVersion: SemanticVersion,
        val serializer: KSerializer<T>
    )

    suspend fun <T> register(
        moduleId: String,
        version: String,
        minReaderVersion: String? = null,
        serializer: KSerializer<T>
    ) = mutex.withLock {
        schemas[moduleId] = SchemaEntry(
            moduleId = moduleId,
            version = SemanticVersion.parse(version),
            minReaderVersion = SemanticVersion.parse(minReaderVersion ?: version),
            serializer = serializer
        )
    }

    suspend fun <T> parse(moduleId: String, json: String): ParseResult<T> = mutex.withLock {
        val entry = schemas[moduleId] as? SchemaEntry<T>
            ?: return@withLock ParseResult.UnknownModule(json)

        val jsonElement = Json.parseToJsonElement(json).jsonObject
        val writerVersion = SemanticVersion.parse(
            jsonElement["_v"]?.jsonPrimitive?.content ?: entry.version.toString()
        )
        val minReaderVersion = SemanticVersion.parse(
            jsonElement["_minReader"]?.jsonPrimitive?.content ?: writerVersion.toString()
        )

        val canFullyParse = entry.version >= minReaderVersion

        return@withLock try {
            val value = Json.decodeFromString(entry.serializer, json)
            if (canFullyParse) {
                ParseResult.Full(value, createMeta(writerVersion, minReaderVersion, entry))
            } else {
                ParseResult.Partial(value, createMeta(writerVersion, minReaderVersion, entry))
            }
        } catch (e: Exception) {
            parsePartial(moduleId, json, entry)
        }
    }

    suspend fun applyBundle(bundle: SchemaBundle): Boolean = mutex.withLock {
        // Verify signature
        if (!verifySignature(bundle)) {
            throw SchemaException("Invalid bundle signature")
        }

        // Check freshness
        if (bundle.createdAt <= bundleCreatedAt) {
            return@withLock false
        }

        // Apply schemas
        bundle.schemas.forEach { (moduleId, schemaInfo) ->
            registerDynamic(moduleId, schemaInfo)
        }

        bundleVersion = bundle.version
        bundleCreatedAt = bundle.createdAt

        true
    }

    fun getDeviceVersionInfo(): DeviceVersionInfo {
        return DeviceVersionInfo(
            clientVersion = BuildConfig.VERSION_NAME,
            schemaBundleVersion = bundleVersion,
            schemaBundleCreatedAt = bundleCreatedAt,
            moduleVersions = schemas.mapValues { (_, entry) ->
                ModuleVersionInfo(
                    current = entry.version.toString(),
                    supported = listOf(entry.version.toString())
                )
            }
        )
    }
}

sealed class ParseResult<out T> {
    data class Full<T>(val value: T, val meta: ParseMeta) : ParseResult<T>()
    data class Partial<T>(val value: T, val meta: ParseMeta) : ParseResult<T>()
    data class Placeholder(val raw: String, val meta: ParseMeta) : ParseResult<Nothing>()
    data class UnknownModule(val raw: String) : ParseResult<Nothing>()

    val displayMode: DisplayMode
        get() = when (this) {
            is Full -> DisplayMode.FULL
            is Partial -> DisplayMode.PARTIAL
            is Placeholder -> DisplayMode.PLACEHOLDER
            is UnknownModule -> DisplayMode.UNKNOWN_MODULE
        }
}

enum class DisplayMode {
    FULL, PARTIAL, PLACEHOLDER, UNKNOWN_MODULE
}
```

#### Compose UI

```kotlin
// ui/components/VersionedContent.kt

package network.buildit.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun <T> VersionedContent(
    result: ParseResult<T>,
    fullContent: @Composable (T) -> Unit,
    partialContent: (@Composable (T, ParseMeta) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    when (result) {
        is ParseResult.Full -> {
            fullContent(result.value)
        }

        is ParseResult.Partial -> {
            Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (partialContent != null) {
                    partialContent(result.value, result.meta)
                } else {
                    fullContent(result.value)
                }
                VersionHint(mode = VersionHintMode.PARTIAL)
            }
        }

        is ParseResult.Placeholder -> {
            PlaceholderCard(meta = result.meta)
        }

        is ParseResult.UnknownModule -> {
            UnknownModuleCard()
        }
    }
}

enum class VersionHintMode { PARTIAL, OUTDATED }

@Composable
fun VersionHint(mode: VersionHintMode) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = MaterialTheme.shapes.small
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                Icons.Outlined.Info,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = if (mode == VersionHintMode.PARTIAL)
                    "Some content requires an update"
                else
                    "This content is from a newer version",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.weight(1f)
            )
            TextButton(onClick = { /* Open Play Store */ }) {
                Text("Update")
            }
        }
    }
}

@Composable
fun PlaceholderCard(meta: ParseMeta) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(
                Icons.Outlined.Warning,
                contentDescription = null,
                modifier = Modifier.size(48.dp),
                tint = MaterialTheme.colorScheme.error
            )
            Text(
                text = "Update Required",
                style = MaterialTheme.typography.titleMedium
            )
            Text(
                text = "This content requires version ${meta.minReaderVersion} or later.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { /* Open Play Store */ }) {
                    Text("Update App")
                }
                OutlinedButton(onClick = { /* Show partial */ }) {
                    Text("View Basic")
                }
            }
        }
    }
}

@Composable
fun UnknownModuleCard() {
    Card {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(
                Icons.Outlined.Inventory,
                contentDescription = null,
                modifier = Modifier.size(48.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Text(
                text = "New Feature",
                style = MaterialTheme.typography.titleMedium
            )
            Text(
                text = "This group uses a feature that requires an app update.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { }) { Text("Update App") }
                OutlinedButton(onClick = { }) { Text("Learn More") }
                TextButton(onClick = { }) { Text("Later") }
            }
        }
    }
}
```

## Testing Requirements

### Unit Tests

Every client MUST include tests for:

1. **Version comparison**
2. **Graceful degradation parsing**
3. **Unknown field preservation**
4. **Bundle signature verification**
5. **Display mode determination**

### Integration Tests

1. **Cross-version message exchange**
2. **Schema bundle sync**
3. **Relay forwarding of unparseable messages**

### Test Vectors

Use test vectors from `buildit-protocol/test-vectors/`:

```typescript
import { testVectors } from 'buildit-protocol/test-vectors/schema-versioning.json';

describe('Schema Versioning', () => {
  for (const vector of testVectors) {
    it(vector.name, () => {
      const result = schemaRegistry.parse(vector.moduleId, vector.input);
      expect(result.meta.canFullyParse).toBe(vector.expected.canFullyParse);
      expect(result.meta.displayMode).toBe(vector.expected.displayMode);
    });
  }
});
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-25 | Initial specification |
