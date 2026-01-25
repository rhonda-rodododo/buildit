package network.buildit.core.modules

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import network.buildit.core.nostr.NostrEvent
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Central registry for all BuildIt modules.
 *
 * Manages:
 * - Module registration and lifecycle
 * - Per-group module enablement
 * - Event routing to modules
 * - Module dependencies
 *
 * Thread-safe and suitable for dependency injection via Hilt.
 */
@Singleton
class ModuleRegistry @Inject constructor() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val mutex = Mutex()

    private val _modules = MutableStateFlow<Map<String, BuildItModule>>(emptyMap())
    val modules: StateFlow<Map<String, BuildItModule>> = _modules.asStateFlow()

    private val _enabledModules = MutableStateFlow<Map<String, Set<String>>>(emptyMap())
    val enabledModules: StateFlow<Map<String, Set<String>>> = _enabledModules.asStateFlow()

    private val _moduleConfigurations = MutableStateFlow<Map<String, Map<String, ModuleConfiguration>>>(emptyMap())
    val moduleConfigurations: StateFlow<Map<String, Map<String, ModuleConfiguration>>> =
        _moduleConfigurations.asStateFlow()

    private var initialized = false

    /**
     * Registers a module with the registry.
     *
     * @param module The module to register
     * @throws IllegalStateException if a module with the same identifier is already registered
     */
    suspend fun register(module: BuildItModule) = mutex.withLock {
        if (_modules.value.containsKey(module.identifier)) {
            throw IllegalStateException("Module ${module.identifier} is already registered")
        }

        Log.i(TAG, "Registering module: ${module.identifier} v${module.version}")

        // Verify dependencies
        module.dependencies.forEach { depId ->
            if (!_modules.value.containsKey(depId)) {
                Log.w(TAG, "Module ${module.identifier} depends on $depId which is not registered yet")
            }
        }

        // Add to registry
        _modules.value = _modules.value + (module.identifier to module)

        // Initialize the module
        try {
            module.initialize()
            Log.i(TAG, "Module ${module.identifier} initialized successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize module ${module.identifier}", e)
            // Remove from registry if initialization fails
            _modules.value = _modules.value - module.identifier
            throw e
        }
    }

    /**
     * Unregisters a module from the registry.
     *
     * @param moduleId The identifier of the module to unregister
     */
    suspend fun unregister(moduleId: String) = mutex.withLock {
        val module = _modules.value[moduleId] ?: return@withLock

        Log.i(TAG, "Unregistering module: $moduleId")

        // Check if other modules depend on this one
        val dependents = _modules.value.values.filter { it.dependencies.contains(moduleId) }
        if (dependents.isNotEmpty()) {
            Log.w(TAG, "Module $moduleId has dependents: ${dependents.map { it.identifier }}")
        }

        // Shutdown the module
        try {
            module.shutdown()
        } catch (e: Exception) {
            Log.e(TAG, "Error shutting down module $moduleId", e)
        }

        // Remove from registry
        _modules.value = _modules.value - moduleId

        // Remove from all group enablement lists
        _enabledModules.value = _enabledModules.value.mapValues { (_, modules) ->
            modules - moduleId
        }
    }

    /**
     * Enables a module for a specific group.
     *
     * @param moduleId The module identifier
     * @param groupId The group identifier
     * @param configuration Optional module-specific configuration
     * @return True if the module was enabled successfully
     */
    suspend fun enable(
        moduleId: String,
        groupId: String,
        configuration: ModuleConfiguration? = null
    ): Boolean = mutex.withLock {
        val module = _modules.value[moduleId]
        if (module == null) {
            Log.w(TAG, "Cannot enable module $moduleId for group $groupId: module not registered")
            return@withLock false
        }

        // Check dependencies are enabled
        for (depId in module.dependencies) {
            if (!isEnabled(depId, groupId)) {
                Log.w(TAG, "Cannot enable module $moduleId: dependency $depId is not enabled")
                return@withLock false
            }
        }

        // Add to enabled set
        val currentEnabled = _enabledModules.value[groupId] ?: emptySet()
        _enabledModules.value = _enabledModules.value + (groupId to (currentEnabled + moduleId))

        // Store configuration
        if (configuration != null) {
            val groupConfigs = _moduleConfigurations.value[groupId] ?: emptyMap()
            _moduleConfigurations.value = _moduleConfigurations.value + (
                groupId to (groupConfigs + (moduleId to configuration))
            )
        }

        Log.i(TAG, "Enabled module $moduleId for group $groupId")
        return@withLock true
    }

    /**
     * Disables a module for a specific group.
     *
     * @param moduleId The module identifier
     * @param groupId The group identifier
     */
    suspend fun disable(moduleId: String, groupId: String) = mutex.withLock {
        // Check if other enabled modules depend on this one
        val enabledInGroup = _enabledModules.value[groupId] ?: emptySet()
        val dependents = enabledInGroup.mapNotNull { _modules.value[it] }
            .filter { it.dependencies.contains(moduleId) }

        if (dependents.isNotEmpty()) {
            Log.w(TAG, "Cannot disable $moduleId in group $groupId: required by ${dependents.map { it.identifier }}")
            return@withLock
        }

        // Remove from enabled set
        _enabledModules.value = _enabledModules.value + (groupId to (enabledInGroup - moduleId))

        // Remove configuration
        val groupConfigs = _moduleConfigurations.value[groupId]
        if (groupConfigs != null) {
            _moduleConfigurations.value = _moduleConfigurations.value + (
                groupId to (groupConfigs - moduleId)
            )
        }

        Log.i(TAG, "Disabled module $moduleId for group $groupId")
    }

    /**
     * Checks if a module is enabled for a specific group.
     *
     * @param moduleId The module identifier
     * @param groupId The group identifier (or null for global)
     * @return True if the module is enabled
     */
    fun isEnabled(moduleId: String, groupId: String): Boolean {
        return _enabledModules.value[groupId]?.contains(moduleId) == true
    }

    /**
     * Gets the configuration for a module in a specific group.
     *
     * @param moduleId The module identifier
     * @param groupId The group identifier
     * @return The module configuration, or null if not configured
     */
    fun getConfiguration(moduleId: String, groupId: String): ModuleConfiguration? {
        return _moduleConfigurations.value[groupId]?.get(moduleId)
    }

    /**
     * Routes an incoming Nostr event to all interested modules.
     *
     * @param event The event to route
     * @param groupId The group context (optional)
     * @return List of module IDs that handled the event
     */
    suspend fun routeEvent(event: NostrEvent, groupId: String? = null): List<String> {
        val enabledForGroup = if (groupId != null) {
            _enabledModules.value[groupId] ?: emptySet()
        } else {
            emptySet()
        }

        val handlers = mutableListOf<String>()

        _modules.value.forEach { (moduleId, module) ->
            // Skip if module is not enabled for this group
            if (groupId != null && !enabledForGroup.contains(moduleId)) {
                return@forEach
            }

            // Skip if module doesn't handle this event kind
            val handledKinds = module.getHandledEventKinds()
            if (handledKinds.isNotEmpty() && !handledKinds.contains(event.kind)) {
                return@forEach
            }

            try {
                if (module.handleEvent(event)) {
                    handlers.add(moduleId)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error handling event in module $moduleId", e)
            }
        }

        return handlers
    }

    /**
     * Gets a module by its identifier.
     *
     * @param moduleId The module identifier
     * @return The module, or null if not found
     */
    fun getModule(moduleId: String): BuildItModule? {
        return _modules.value[moduleId]
    }

    /**
     * Gets all enabled modules for a specific group.
     *
     * @param groupId The group identifier
     * @return List of enabled modules
     */
    fun getEnabledModulesForGroup(groupId: String): List<BuildItModule> {
        val enabledIds = _enabledModules.value[groupId] ?: emptySet()
        return enabledIds.mapNotNull { _modules.value[it] }
    }

    /**
     * Gets all navigation routes from enabled modules for a specific group.
     *
     * @param groupId The group identifier
     * @return List of navigation routes
     */
    fun getNavigationRoutes(groupId: String): List<ModuleRoute> {
        val enabledModules = getEnabledModulesForGroup(groupId)
        return enabledModules.flatMap { it.getNavigationRoutes() }
    }

    companion object {
        private const val TAG = "ModuleRegistry"
    }
}
