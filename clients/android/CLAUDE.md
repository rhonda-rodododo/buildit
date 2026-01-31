# BuildIt Android Client

> Native Android app with Kotlin, Jetpack Compose, and Android BLE

**Parent instructions**: See `/CLAUDE.md` for monorepo-wide context.

**Product context**: Read [`docs/VISION.md`](../../docs/VISION.md) for who we serve and why.
Read [`docs/design-principles.md`](../../docs/design-principles.md) for cross-platform UX standards.
Read [`docs/personas/`](../../docs/personas/) for user personas across all target communities.

## Tech Stack

- **Language**: Kotlin 1.9+
- **UI**: Jetpack Compose
- **BLE**: Android Bluetooth LE API
- **Crypto**: Android Keystore + packages/crypto (UniFFI)
- **Storage**: Room Database
- **Nostr**: OkHttp WebSocket
- **Serialization**: kotlinx.serialization

## Commands

```bash
# Debug build
./gradlew assembleDebug

# Release build
./gradlew assembleRelease

# Run tests
./gradlew test

# Install on device
./gradlew installDebug
```

## Directory Structure

```
app/
├── src/main/
│   ├── java/network/buildit/
│   │   ├── core/
│   │   │   ├── ble/           # Android BLE manager
│   │   │   ├── crypto/        # Keystore + UniFFI
│   │   │   ├── nostr/         # Nostr client
│   │   │   └── storage/       # Room database
│   │   ├── features/          # Feature modules
│   │   │   ├── messaging/
│   │   │   ├── events/
│   │   │   └── ...
│   │   ├── generated/         # AUTO-GENERATED from protocol schemas
│   │   └── ui/                # Shared Compose components
│   ├── res/
│   └── AndroidManifest.xml
├── build.gradle.kts
└── proguard-rules.pro
```

## BLE Implementation

```kotlin
// core/ble/BLEManager.kt
class BLEManager(private val context: Context) {
    companion object {
        val SERVICE_UUID = UUID.fromString("12345678-1234-5678-1234-56789abcdef0")
        val MESSAGE_CHAR_UUID = UUID.fromString("12345678-1234-5678-1234-56789abcdef1")
    }

    private val bluetoothAdapter: BluetoothAdapter? =
        (context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter

    fun startScanning() {
        bluetoothAdapter?.bluetoothLeScanner?.startScan(
            listOf(ScanFilter.Builder().setServiceUuid(ParcelUuid(SERVICE_UUID)).build()),
            ScanSettings.Builder().build(),
            scanCallback
        )
    }
}
```

## Crypto via UniFFI

```kotlin
import network.buildit.crypto.BuildItCrypto

val encrypted = BuildItCrypto.nip44Encrypt(
    plaintext = message.toByteArray(),
    senderPrivkey = senderKey,
    recipientPubkey = recipientKey
)
```

## Key Files

| File | Purpose |
|------|---------|
| `AndroidManifest.xml` | Permissions (BLE, Internet) |
| `build.gradle.kts` | Dependencies, build config |
| `core/ble/` | BLE mesh implementation |
| `generated/` | Auto-generated schema types |

## Permissions

```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
```

## Coding Standards

- **Coroutines** - Use suspend functions, Flow for async
- **Compose** - Declarative UI, avoid View system
- **Hilt** - Dependency injection
- **kotlinx.serialization** - JSON parsing with unknown field preservation

## Testing

```bash
# Unit tests
./gradlew test

# Instrumented tests
./gradlew connectedAndroidTest

# Specific module
./gradlew :app:testDebugUnitTest
```

## Schema Types

Generated types preserve unknown fields for relay:

```kotlin
// generated/schemas/Events.kt
@Serializable
data class Event(
    @SerialName("_v") val schemaVersion: String,
    val id: String,
    val title: String,
    // ... fields from schema
    @Transient internal val unknownFields: Map<String, JsonElement> = emptyMap()
)
```

## Room Database

```kotlin
// core/storage/AppDatabase.kt
@Database(entities = [EventEntity::class, ...], version = 1)
abstract class AppDatabase : RoomDatabase() {
    abstract fun eventDao(): EventDao
}
```
