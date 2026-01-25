package network.buildit.core.modules

import androidx.compose.ui.graphics.vector.ImageVector
import com.google.common.truth.Truth.assertThat
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import network.buildit.core.nostr.NostrEvent
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

/**
 * Unit tests for ModuleRegistry.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ModuleRegistryTest {

    private lateinit var registry: ModuleRegistry

    private val testDispatcher = StandardTestDispatcher()
    private val testScope = TestScope(testDispatcher)

    @BeforeEach
    fun setup() {
        registry = ModuleRegistry()
    }

    @Test
    fun `register should add module to registry`() = testScope.runTest {
        // Given
        val module = createTestModule("test-module")

        // When
        registry.register(module)

        // Then
        assertThat(registry.modules.value).containsKey("test-module")
        assertThat(registry.modules.value["test-module"]).isEqualTo(module)
        coVerify { module.initialize() }
    }

    @Test
    fun `register should throw if module already registered`() = testScope.runTest {
        // Given
        val module1 = createTestModule("test-module")
        val module2 = createTestModule("test-module")

        registry.register(module1)

        // When/Then
        assertThrows<IllegalStateException> {
            registry.register(module2)
        }
    }

    @Test
    fun `register should remove module if initialization fails`() = testScope.runTest {
        // Given
        val module = createTestModule("failing-module")
        coEvery { module.initialize() } throws RuntimeException("Init failed")

        // When/Then
        assertThrows<RuntimeException> {
            registry.register(module)
        }

        assertThat(registry.modules.value).doesNotContainKey("failing-module")
    }

    @Test
    fun `unregister should remove module and call shutdown`() = testScope.runTest {
        // Given
        val module = createTestModule("test-module")
        registry.register(module)

        // When
        registry.unregister("test-module")

        // Then
        assertThat(registry.modules.value).doesNotContainKey("test-module")
        coVerify { module.shutdown() }
    }

    @Test
    fun `enable should enable module for group`() = testScope.runTest {
        // Given
        val module = createTestModule("test-module")
        registry.register(module)

        // When
        val result = registry.enable("test-module", "group-1")

        // Then
        assertThat(result).isTrue()
        assertThat(registry.isEnabled("test-module", "group-1")).isTrue()
    }

    @Test
    fun `enable should return false for unregistered module`() = testScope.runTest {
        // When
        val result = registry.enable("unknown-module", "group-1")

        // Then
        assertThat(result).isFalse()
    }

    @Test
    fun `enable should fail if dependencies not enabled`() = testScope.runTest {
        // Given
        val dependency = createTestModule("dependency")
        val module = createTestModule("test-module", dependencies = listOf("dependency"))

        registry.register(dependency)
        registry.register(module)

        // When
        val result = registry.enable("test-module", "group-1")

        // Then
        assertThat(result).isFalse()
    }

    @Test
    fun `enable should succeed if dependencies are enabled`() = testScope.runTest {
        // Given
        val dependency = createTestModule("dependency")
        val module = createTestModule("test-module", dependencies = listOf("dependency"))

        registry.register(dependency)
        registry.register(module)

        registry.enable("dependency", "group-1")

        // When
        val result = registry.enable("test-module", "group-1")

        // Then
        assertThat(result).isTrue()
        assertThat(registry.isEnabled("test-module", "group-1")).isTrue()
    }

    @Test
    fun `disable should disable module for group`() = testScope.runTest {
        // Given
        val module = createTestModule("test-module")
        registry.register(module)
        registry.enable("test-module", "group-1")

        // When
        registry.disable("test-module", "group-1")

        // Then
        assertThat(registry.isEnabled("test-module", "group-1")).isFalse()
    }

    @Test
    fun `disable should not disable if other modules depend on it`() = testScope.runTest {
        // Given
        val dependency = createTestModule("dependency")
        val module = createTestModule("test-module", dependencies = listOf("dependency"))

        registry.register(dependency)
        registry.register(module)

        registry.enable("dependency", "group-1")
        registry.enable("test-module", "group-1")

        // When
        registry.disable("dependency", "group-1")

        // Then
        assertThat(registry.isEnabled("dependency", "group-1")).isTrue()
    }

    @Test
    fun `getConfiguration should return stored configuration`() = testScope.runTest {
        // Given
        val module = createTestModule("test-module")
        val config = ModuleConfiguration(
            moduleId = "test-module",
            enabled = true,
            settings = mapOf("key" to "value")
        )

        registry.register(module)
        registry.enable("test-module", "group-1", config)

        // When
        val retrieved = registry.getConfiguration("test-module", "group-1")

        // Then
        assertThat(retrieved).isEqualTo(config)
    }

    @Test
    fun `routeEvent should call handleEvent on enabled modules`() = testScope.runTest {
        // Given
        val module1 = createTestModule("module-1", handledKinds = listOf(1))
        val module2 = createTestModule("module-2", handledKinds = listOf(2))

        registry.register(module1)
        registry.register(module2)

        registry.enable("module-1", "group-1")
        registry.enable("module-2", "group-1")

        val event = NostrEvent(
            id = "test-event",
            pubkey = "test-pubkey",
            createdAt = System.currentTimeMillis() / 1000,
            kind = 1,
            tags = emptyList(),
            content = "test",
            sig = "test-sig"
        )

        coEvery { module1.handleEvent(event) } returns true
        coEvery { module2.handleEvent(event) } returns false

        // When
        val handlers = registry.routeEvent(event, "group-1")

        // Then
        assertThat(handlers).containsExactly("module-1")
        coVerify { module1.handleEvent(event) }
        coVerify(exactly = 0) { module2.handleEvent(event) }
    }

    @Test
    fun `getEnabledModulesForGroup should return only enabled modules`() = testScope.runTest {
        // Given
        val module1 = createTestModule("module-1")
        val module2 = createTestModule("module-2")

        registry.register(module1)
        registry.register(module2)

        registry.enable("module-1", "group-1")

        // When
        val enabled = registry.getEnabledModulesForGroup("group-1")

        // Then
        assertThat(enabled).hasSize(1)
        assertThat(enabled[0].identifier).isEqualTo("module-1")
    }

    @Test
    fun `getNavigationRoutes should aggregate routes from enabled modules`() = testScope.runTest {
        // Given
        val module1 = createTestModule("module-1", routeCount = 2)
        val module2 = createTestModule("module-2", routeCount = 1)

        registry.register(module1)
        registry.register(module2)

        registry.enable("module-1", "group-1")
        registry.enable("module-2", "group-1")

        // When
        val routes = registry.getNavigationRoutes("group-1")

        // Then
        assertThat(routes).hasSize(3)
    }

    // ============== Helper Methods ==============

    private fun createTestModule(
        identifier: String,
        dependencies: List<String> = emptyList(),
        handledKinds: List<Int> = emptyList(),
        routeCount: Int = 0
    ): BuildItModule {
        return mockk<BuildItModule>(relaxed = true) {
            every { this@mockk.identifier } returns identifier
            every { version } returns "1.0.0"
            every { displayName } returns identifier
            every { description } returns "Test module"
            every { this@mockk.dependencies } returns dependencies
            every { getHandledEventKinds() } returns handledKinds
            every { getNavigationRoutes() } returns List(routeCount) { index ->
                ModuleRoute(
                    route = "$identifier/$index",
                    title = "Route $index",
                    icon = null,
                    showInNavigation = true,
                    content = {}
                )
            }
            coEvery { initialize() } returns Unit
            coEvery { shutdown() } returns Unit
        }
    }
}
