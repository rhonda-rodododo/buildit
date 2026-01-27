package network.buildit.modules.calling.service

import android.content.Context
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Represents a message template.
 */
data class MessageTemplate(
    val id: String,
    val name: String,
    val content: String,
    val variables: List<String>,
    val shortcut: String? = null,
    val category: String? = null,
    val isDefault: Boolean,
    val createdAt: Long,
    val updatedAt: Long
)

/**
 * Context variables for template substitution.
 */
data class TemplateContext(
    val hotlineName: String? = null,
    val operatorName: String? = null,
    val callerName: String? = null,
    val date: String? = null,
    val time: String? = null,
    val customVariables: Map<String, String> = emptyMap()
)

/**
 * Default templates for hotline messaging.
 */
private val DEFAULT_TEMPLATES = listOf(
    MessageTemplate(
        id = "greeting",
        name = "Greeting",
        content = "Thank you for contacting {{hotline_name}}. My name is {{operator_name}} and I'm here to help you. How can I assist you today?",
        variables = listOf("hotline_name", "operator_name"),
        shortcut = "Ctrl+G",
        category = "General",
        isDefault = true,
        createdAt = 0,
        updatedAt = 0
    ),
    MessageTemplate(
        id = "info_request",
        name = "Request Info",
        content = "To help you better, could you please provide some additional information about your situation? Specifically, I'd like to know:\n\n1. When did this occur?\n2. Who was involved?\n3. What happened?",
        variables = emptyList(),
        shortcut = "Ctrl+I",
        category = "General",
        isDefault = true,
        createdAt = 0,
        updatedAt = 0
    ),
    MessageTemplate(
        id = "followup",
        name = "Follow-up Scheduled",
        content = "Thank you for the information, {{caller_name}}. We'll follow up with you within 24-48 hours. If you have any additional questions or concerns in the meantime, please don't hesitate to reach out.",
        variables = listOf("caller_name"),
        category = "General",
        isDefault = true,
        createdAt = 0,
        updatedAt = 0
    ),
    MessageTemplate(
        id = "resolved",
        name = "Resolution",
        content = "I'm glad we could help resolve your concern today, {{caller_name}}. Is there anything else I can assist you with before we close this conversation?",
        variables = listOf("caller_name"),
        shortcut = "Ctrl+R",
        category = "General",
        isDefault = true,
        createdAt = 0,
        updatedAt = 0
    ),
    MessageTemplate(
        id = "hold_on",
        name = "Please Hold",
        content = "Thank you for your patience. I'm looking into this for you and will respond shortly.",
        variables = emptyList(),
        shortcut = "Ctrl+H",
        category = "General",
        isDefault = true,
        createdAt = 0,
        updatedAt = 0
    ),
    MessageTemplate(
        id = "transfer_notice",
        name = "Transfer Notice",
        content = "I'm going to transfer you to a colleague who can better assist with this matter. They'll have access to our conversation so you won't need to repeat yourself. Please hold.",
        variables = emptyList(),
        category = "General",
        isDefault = true,
        createdAt = 0,
        updatedAt = 0
    ),
    MessageTemplate(
        id = "after_hours",
        name = "After Hours",
        content = "Thank you for contacting {{hotline_name}}. Our team is currently unavailable. Our normal hours are Monday-Friday, 9 AM - 5 PM. We'll respond to your message during the next business day.",
        variables = listOf("hotline_name"),
        category = "Auto-Response",
        isDefault = true,
        createdAt = 0,
        updatedAt = 0
    ),
    MessageTemplate(
        id = "emergency_resources",
        name = "Emergency Resources",
        content = "If you're experiencing an emergency, please call 911. For mental health crisis support, you can reach the 988 Suicide & Crisis Lifeline by calling or texting 988. We're here to support you.",
        variables = emptyList(),
        shortcut = "Ctrl+E",
        category = "Safety",
        isDefault = true,
        createdAt = 0,
        updatedAt = 0
    ),
    MessageTemplate(
        id = "legal_disclaimer",
        name = "Legal Disclaimer",
        content = "Please note that the information provided here is for general guidance only and does not constitute legal advice. For specific legal questions, please consult with a qualified attorney.",
        variables = emptyList(),
        category = "Legal",
        isDefault = true,
        createdAt = 0,
        updatedAt = 0
    ),
    MessageTemplate(
        id = "know_your_rights",
        name = "Know Your Rights",
        content = "Here are some important things to remember:\n\n" +
            "- You have the right to remain silent\n" +
            "- You have the right to refuse consent to search\n" +
            "- You have the right to speak with an attorney\n" +
            "- You have the right to make a local phone call\n\n" +
            "If you're being questioned, you can say \"I wish to remain silent\" and \"I want to speak to a lawyer.\"",
        variables = emptyList(),
        shortcut = "Ctrl+K",
        category = "Legal",
        isDefault = true,
        createdAt = 0,
        updatedAt = 0
    )
)

/**
 * Template Manager.
 *
 * Manages canned response templates for messaging hotline with variable substitution.
 * Features:
 * - Default templates (greeting, info request, follow-up, resolved)
 * - Variable substitution ({{variable_name}})
 * - Template CRUD operations
 * - Keyboard shortcuts
 * - Category organization
 *
 * Default templates cannot be modified or deleted, but can be copied.
 */
@Singleton
class TemplateManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private const val TAG = "TemplateManager"

        // Regex to match template variables: {{variable_name}}
        private val VARIABLE_PATTERN = Regex("\\{\\{\\s*(\\w+)\\s*}}")
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    /** Templates by ID */
    private val templates = ConcurrentHashMap<String, MessageTemplate>()

    /** Shortcuts mapping: shortcut string -> template ID */
    private val shortcuts = ConcurrentHashMap<String, String>()

    // ============================================
    // State Flows
    // ============================================

    private val _templatesState = MutableStateFlow<List<MessageTemplate>>(emptyList())
    /** Observable templates list */
    val templatesState: StateFlow<List<MessageTemplate>> = _templatesState.asStateFlow()

    private val _categoriesState = MutableStateFlow<List<String>>(emptyList())
    /** Observable categories list */
    val categoriesState: StateFlow<List<String>> = _categoriesState.asStateFlow()

    init {
        loadDefaultTemplates()
    }

    // ============================================
    // Initialization
    // ============================================

    /**
     * Load default templates.
     */
    private fun loadDefaultTemplates() {
        val now = System.currentTimeMillis()
        DEFAULT_TEMPLATES.forEach { template ->
            val fullTemplate = template.copy(
                createdAt = now,
                updatedAt = now
            )
            templates[template.id] = fullTemplate
            template.shortcut?.let { shortcuts[it] = template.id }
        }
        syncState()
        Log.d(TAG, "Loaded ${DEFAULT_TEMPLATES.size} default templates")
    }

    // ============================================
    // Template Retrieval
    // ============================================

    /**
     * Get all templates.
     *
     * @return List of all templates sorted by category and name.
     */
    fun getAll(): List<MessageTemplate> {
        return templates.values.sortedWith(
            compareBy<MessageTemplate> { it.category ?: "" }
                .thenBy { it.name }
        )
    }

    /**
     * Get templates by category.
     *
     * @param category The category to filter by.
     * @return List of templates in the category.
     */
    fun getByCategory(category: String): List<MessageTemplate> {
        return getAll().filter { it.category == category }
    }

    /**
     * Get template by ID.
     *
     * @param id The template ID.
     * @return The template, or null if not found.
     */
    fun get(id: String): MessageTemplate? = templates[id]

    /**
     * Get template by keyboard shortcut.
     *
     * @param shortcut The shortcut string (e.g., "Ctrl+G").
     * @return The template, or null if not found.
     */
    fun getByShortcut(shortcut: String): MessageTemplate? {
        val id = shortcuts[shortcut] ?: return null
        return templates[id]
    }

    /**
     * Get all unique categories.
     *
     * @return Sorted list of category names.
     */
    fun getCategories(): List<String> {
        return templates.values
            .mapNotNull { it.category }
            .toSet()
            .sorted()
    }

    /**
     * Get all shortcuts.
     *
     * @return Map of shortcut string to template ID.
     */
    fun getShortcuts(): Map<String, String> = shortcuts.toMap()

    // ============================================
    // Template CRUD
    // ============================================

    /**
     * Add a new template.
     *
     * @param name Template name.
     * @param content Template content with variables.
     * @param shortcut Optional keyboard shortcut.
     * @param category Optional category.
     * @return The created template.
     */
    fun add(
        name: String,
        content: String,
        shortcut: String? = null,
        category: String? = null
    ): MessageTemplate {
        val id = UUID.randomUUID().toString()
        val now = System.currentTimeMillis()
        val variables = extractVariables(content)

        val template = MessageTemplate(
            id = id,
            name = name,
            content = content,
            variables = variables,
            shortcut = shortcut,
            category = category,
            isDefault = false,
            createdAt = now,
            updatedAt = now
        )

        templates[id] = template

        shortcut?.let {
            removeShortcut(it)
            shortcuts[it] = id
        }

        syncState()

        Log.i(TAG, "Template added: $name (id: $id)")

        return template
    }

    /**
     * Update an existing template.
     *
     * Default templates cannot be modified - a copy will be created instead.
     *
     * @param id Template ID to update.
     * @param name New name.
     * @param content New content.
     * @param shortcut New shortcut.
     * @param category New category.
     * @return The updated template, or a new copy if default.
     */
    fun update(
        id: String,
        name: String? = null,
        content: String? = null,
        shortcut: String? = null,
        category: String? = null
    ): MessageTemplate? {
        val template = templates[id] ?: return null

        // Don't allow modifying default templates - create a copy instead
        if (template.isDefault && (name != null || content != null || category != null)) {
            return add(
                name = name ?: template.name,
                content = content ?: template.content,
                shortcut = shortcut,
                category = category ?: template.category
            )
        }

        val now = System.currentTimeMillis()
        val newContent = content ?: template.content
        val newVariables = if (content != null) extractVariables(newContent) else template.variables

        // Handle shortcut change
        if (shortcut != null && shortcut != template.shortcut) {
            template.shortcut?.let { shortcuts.remove(it) }
            if (shortcut.isNotEmpty()) {
                removeShortcut(shortcut)
                shortcuts[shortcut] = id
            }
        }

        val updated = template.copy(
            name = name ?: template.name,
            content = newContent,
            variables = newVariables,
            shortcut = shortcut ?: template.shortcut,
            category = category ?: template.category,
            updatedAt = now
        )

        templates[id] = updated
        syncState()

        Log.d(TAG, "Template updated: $id")

        return updated
    }

    /**
     * Delete a template.
     *
     * Default templates cannot be deleted.
     *
     * @param id Template ID to delete.
     * @return True if deleted, false if not found or is default.
     */
    fun delete(id: String): Boolean {
        val template = templates[id] ?: return false

        // Don't allow deleting default templates
        if (template.isDefault) {
            Log.w(TAG, "Cannot delete default template: $id")
            return false
        }

        template.shortcut?.let { shortcuts.remove(it) }
        templates.remove(id)
        syncState()

        Log.i(TAG, "Template deleted: $id")

        return true
    }

    /**
     * Remove a shortcut from all templates.
     */
    private fun removeShortcut(shortcut: String) {
        val existingId = shortcuts[shortcut] ?: return
        val template = templates[existingId]

        if (template != null && !template.isDefault) {
            templates[existingId] = template.copy(
                shortcut = null,
                updatedAt = System.currentTimeMillis()
            )
        }

        shortcuts.remove(shortcut)
    }

    // ============================================
    // Variable Substitution
    // ============================================

    /**
     * Apply template with context variables.
     *
     * @param template The template to apply.
     * @param context The context with variable values.
     * @return The template content with variables substituted.
     */
    fun apply(template: MessageTemplate, context: TemplateContext): String {
        var content = template.content

        // Build full context with automatic date/time
        val dateFormat = SimpleDateFormat("MMM d, yyyy", Locale.getDefault())
        val timeFormat = SimpleDateFormat("h:mm a", Locale.getDefault())
        val now = Date()

        val fullContext = mapOf(
            "hotline_name" to (context.hotlineName ?: ""),
            "operator_name" to (context.operatorName ?: ""),
            "caller_name" to (context.callerName ?: ""),
            "date" to (context.date ?: dateFormat.format(now)),
            "time" to (context.time ?: timeFormat.format(now))
        ) + context.customVariables

        // Replace all variables
        for ((key, value) in fullContext) {
            if (value.isNotEmpty()) {
                val regex = Regex("\\{\\{\\s*$key\\s*}}")
                content = content.replace(regex, value)
            }
        }

        // Remove any unreplaced variables
        content = content.replace(VARIABLE_PATTERN, "")

        return content
    }

    /**
     * Apply template by ID with context.
     *
     * @param id Template ID.
     * @param context The context with variable values.
     * @return The substituted content, or null if template not found.
     */
    fun applyById(id: String, context: TemplateContext): String? {
        val template = templates[id] ?: return null
        return apply(template, context)
    }

    /**
     * Apply template by shortcut with context.
     *
     * @param shortcut The keyboard shortcut.
     * @param context The context with variable values.
     * @return The substituted content, or null if shortcut not found.
     */
    fun applyByShortcut(shortcut: String, context: TemplateContext): String? {
        val template = getByShortcut(shortcut) ?: return null
        return apply(template, context)
    }

    /**
     * Extract variables from content.
     *
     * @param content The content to scan for variables.
     * @return List of unique variable names found.
     */
    fun extractVariables(content: String): List<String> {
        return VARIABLE_PATTERN.findAll(content)
            .map { it.groupValues[1] }
            .distinct()
            .toList()
    }

    // ============================================
    // Search
    // ============================================

    /**
     * Search templates by name or content.
     *
     * @param query The search query.
     * @return List of matching templates.
     */
    fun search(query: String): List<MessageTemplate> {
        if (query.isBlank()) return getAll()

        val lowerQuery = query.lowercase(Locale.getDefault())
        return getAll().filter {
            it.name.lowercase(Locale.getDefault()).contains(lowerQuery) ||
                it.content.lowercase(Locale.getDefault()).contains(lowerQuery)
        }
    }

    // ============================================
    // Import/Export
    // ============================================

    /**
     * Export all custom (non-default) templates.
     *
     * @return List of custom templates for serialization.
     */
    fun exportCustomTemplates(): List<MessageTemplate> {
        return templates.values.filter { !it.isDefault }
    }

    /**
     * Import templates.
     *
     * @param templateList List of templates to import.
     * @param overwrite Whether to overwrite existing templates with same ID.
     * @return Number of templates imported.
     */
    fun importTemplates(
        templateList: List<MessageTemplate>,
        overwrite: Boolean = false
    ): Int {
        var imported = 0

        for (template in templateList) {
            // Skip default templates
            if (template.isDefault) continue

            // Check for existing
            if (!overwrite && templates.containsKey(template.id)) continue

            // Generate new ID if importing without overwrite
            val id = if (!overwrite && templates.containsKey(template.id)) {
                UUID.randomUUID().toString()
            } else {
                template.id
            }

            val now = System.currentTimeMillis()
            val importedTemplate = template.copy(
                id = id,
                isDefault = false,
                createdAt = now,
                updatedAt = now
            )

            templates[id] = importedTemplate

            importedTemplate.shortcut?.let {
                removeShortcut(it)
                shortcuts[it] = id
            }

            imported++
        }

        if (imported > 0) {
            syncState()
            Log.i(TAG, "Imported $imported templates")
        }

        return imported
    }

    // ============================================
    // State Management
    // ============================================

    private fun syncState() {
        _templatesState.value = getAll()
        _categoriesState.value = getCategories()
    }

    /**
     * Reset to default templates only.
     */
    fun resetToDefaults() {
        val defaultIds = DEFAULT_TEMPLATES.map { it.id }.toSet()
        val toRemove = templates.keys.filter { it !in defaultIds }

        toRemove.forEach { id ->
            templates[id]?.shortcut?.let { shortcuts.remove(it) }
            templates.remove(id)
        }

        syncState()
        Log.i(TAG, "Reset to default templates, removed ${toRemove.size} custom templates")
    }

    // ============================================
    // Cleanup
    // ============================================

    /**
     * Close and release all resources.
     */
    fun close() {
        scope.cancel()
        Log.i(TAG, "TemplateManager closed")
    }
}
