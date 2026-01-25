# BuildIt Android Testing Guide

## Test Structure

```
app/src/
├── test/                          # Unit tests (JVM)
│   └── java/network/buildit/
│       ├── core/
│       │   ├── ble/              # BLE tests
│       │   ├── nostr/            # Nostr client tests
│       │   └── transport/        # Transport router tests
│       ├── features/
│       │   ├── chat/             # Chat ViewModel tests
│       │   ├── devicesync/       # Device sync tests
│       │   ├── groups/           # Groups tests
│       │   └── settings/         # Settings tests
│       └── testutil/             # Test utilities & fakes
│
└── androidTest/                   # Instrumentation tests (device)
    └── java/network/buildit/
        ├── ChatScreenTest.kt      # UI tests
        ├── DatabaseMigrationTest.kt
        └── PermissionHandlingTest.kt
```

## Running Tests

### Unit Tests

```bash
# Run all unit tests
./gradlew testDebugUnitTest

# Run specific test class
./gradlew testDebugUnitTest --tests "network.buildit.core.transport.TransportRouterTest"

# Run with coverage
./gradlew testDebugUnitTest jacocoTestReport
```

### Instrumentation Tests

```bash
# Run all instrumentation tests
./gradlew connectedDevDebugAndroidTest

# Run specific test class
./gradlew connectedDevDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=network.buildit.ChatScreenTest
```

### All Tests

```bash
./gradlew test connectedAndroidTest
```

## Test Utilities

### Fakes

Located in `testutil/`:

| Fake | Purpose |
|------|---------|
| `FakeBLEManager` | Mock BLE operations |
| `FakeNostrClient` | Mock Nostr relay |
| `FakeTransportRouter` | Mock message routing |
| `FakeCryptoManager` | Mock crypto operations |

### Test Fixtures

`TestFixtures.kt` provides factory methods:

```kotlin
// Create test data
val contact = TestFixtures.createContact(
    pubkey = "abc123",
    displayName = "Test User"
)

val message = TestFixtures.createMessage(
    conversationId = "conv1",
    content = "Hello"
)

val conversation = TestFixtures.createConversation(
    participantPubkeys = listOf("user1", "user2")
)
```

## Writing Tests

### ViewModel Tests

```kotlin
@OptIn(ExperimentalCoroutinesApi::class)
class ChatViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private lateinit var viewModel: ChatViewModel
    private lateinit var fakeTransportRouter: FakeTransportRouter

    @BeforeEach
    fun setup() {
        fakeTransportRouter = FakeTransportRouter()
        viewModel = ChatViewModel(
            conversationDao = FakeConversationDao(),
            messageDao = FakeMessageDao(),
            contactDao = FakeContactDao(),
            transportRouter = fakeTransportRouter,
            cryptoManager = FakeCryptoManager()
        )
    }

    @Test
    fun `sending message updates status`() = runTest {
        // Given
        viewModel.openConversation("conv1")
        viewModel.updateInput("Hello")

        // When
        viewModel.sendMessage()

        // Then
        val state = viewModel.uiState.value as ChatUiState.ActiveConversation
        assertThat(state.messages).isNotEmpty()
    }
}
```

### Flow Testing with Turbine

```kotlin
@Test
fun `transport status updates propagate`() = runTest {
    fakeTransportRouter.transportStatus.test {
        // Initial state
        assertThat(awaitItem().anyAvailable).isFalse()

        // Simulate BLE available
        fakeTransportRouter.setBleAvailable(true)
        assertThat(awaitItem().bleAvailable).isTrue()

        cancelAndIgnoreRemainingEvents()
    }
}
```

### Compose UI Tests

```kotlin
@HiltAndroidTest
class ChatScreenTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Test
    fun chatScreen_displaysConversationList() {
        composeTestRule.onNodeWithText("Messages").assertIsDisplayed()
    }

    @Test
    fun clickNewChat_navigatesToContactPicker() {
        composeTestRule.onNodeWithContentDescription("New Chat").performClick()
        composeTestRule.onNodeWithText("New Message").assertIsDisplayed()
    }
}
```

### Room Database Tests

```kotlin
@RunWith(AndroidJUnit4::class)
class DatabaseMigrationTest {

    @get:Rule
    val helper = MigrationTestHelper(
        InstrumentationRegistry.getInstrumentation(),
        BuildItDatabase::class.java.canonicalName,
        FrameworkSQLiteOpenHelperFactory()
    )

    @Test
    fun migrate1To2_preservesData() {
        // Create v1 database
        helper.createDatabase("test-db", 1).apply {
            execSQL("INSERT INTO contacts ...")
            close()
        }

        // Migrate to v2
        helper.runMigrationsAndValidate("test-db", 2, true, MIGRATION_1_2)

        // Verify data
        val db = helper.openDatabase("test-db", 2)
        val cursor = db.query("SELECT * FROM contacts")
        assertThat(cursor.count).isEqualTo(1)
    }
}
```

## Static Analysis

### Detekt

```bash
./gradlew detekt
```

Configuration: `config/detekt/detekt.yml`

### Ktlint

```bash
# Check
./gradlew ktlintCheck

# Auto-fix
./gradlew ktlintFormat
```

### Lint

```bash
./gradlew lint
```

Reports: `app/build/reports/lint-results-*.html`

## Continuous Integration

The CI pipeline (`.github/workflows/android.yml`) runs:

1. **Lint Job**: Static analysis checks
2. **Test Job**: Unit tests on JVM
3. **Build Job**: Builds debug and release APKs

### Running CI Locally

```bash
# Replicate CI checks
./gradlew lint detekt ktlintCheck testDebugUnitTest assembleDebug
```

## Test Coverage Goals

| Module | Target |
|--------|--------|
| ViewModels | 80% |
| Core (transport, crypto) | 70% |
| Database DAOs | 90% |
| UI Composables | 50% (focus on interactions) |

## Debugging Tests

### Verbose Output

```bash
./gradlew test --info
```

### Specific Test

```bash
./gradlew test --tests "*TransportRouterTest.sends*" --info
```

### Debugging Compose Tests

```kotlin
// Add to find elements
composeTestRule.onRoot().printToLog("UI_TREE")
```
