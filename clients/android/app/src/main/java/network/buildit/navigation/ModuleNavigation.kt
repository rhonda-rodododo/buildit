package network.buildit.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Article
import androidx.compose.material.icons.filled.*
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * Navigation routes for all module screens.
 *
 * These routes are registered in the main NavHost and are used by:
 * - Bottom navigation / navigation drawer items
 * - Deep link routing
 * - Module-level navigation within groups
 */
object ModuleRoutes {

    // ====== Tasks Module ======
    const val TASKS_LIST = "tasks/{groupId}"
    const val TASKS_DETAIL = "tasks/{groupId}/{taskId}"
    const val TASKS_CREATE = "tasks/{groupId}/create"

    fun tasksListRoute(groupId: String) = "tasks/$groupId"
    fun tasksDetailRoute(groupId: String, taskId: String) = "tasks/$groupId/$taskId"
    fun tasksCreateRoute(groupId: String) = "tasks/$groupId/create"

    // ====== Files Module ======
    const val FILES_LIST = "files/{groupId}"
    const val FILES_FOLDER = "files/{groupId}/folder/{folderId}"

    fun filesListRoute(groupId: String) = "files/$groupId"
    fun filesFolderRoute(groupId: String, folderId: String) = "files/$groupId/folder/$folderId"

    // ====== Polls Module ======
    const val POLLS_LIST = "polls/{groupId}"
    const val POLLS_DETAIL = "polls/{groupId}/{pollId}"
    const val POLLS_CREATE = "polls/{groupId}/create"

    fun pollsListRoute(groupId: String) = "polls/$groupId"
    fun pollsDetailRoute(groupId: String, pollId: String) = "polls/$groupId/$pollId"
    fun pollsCreateRoute(groupId: String) = "polls/$groupId/create"

    // ====== Wiki Module ======
    const val WIKI_LIST = "wiki/{groupId}"
    const val WIKI_PAGE = "wiki/{groupId}/page/{pageId}"
    const val WIKI_EDITOR = "wiki/{groupId}/editor"
    const val WIKI_EDITOR_EDIT = "wiki/{groupId}/editor/{pageId}"
    const val WIKI_HISTORY = "wiki/{groupId}/history/{pageId}"
    const val WIKI_CATEGORIES = "wiki/{groupId}/categories"
    const val WIKI_CATEGORY = "wiki/{groupId}/categories/{categoryId}"

    fun wikiListRoute(groupId: String) = "wiki/$groupId"
    fun wikiPageRoute(groupId: String, pageId: String) = "wiki/$groupId/page/$pageId"
    fun wikiEditorRoute(groupId: String) = "wiki/$groupId/editor"
    fun wikiEditorEditRoute(groupId: String, pageId: String) = "wiki/$groupId/editor/$pageId"
    fun wikiHistoryRoute(groupId: String, pageId: String) = "wiki/$groupId/history/$pageId"
    fun wikiCategoriesRoute(groupId: String) = "wiki/$groupId/categories"
    fun wikiCategoryRoute(groupId: String, categoryId: String) = "wiki/$groupId/categories/$categoryId"

    // ====== Events Module (enhancements) ======
    const val EVENTS_LIST = "events/{groupId}"
    const val EVENTS_CALENDAR = "events/{groupId}/calendar"
    const val EVENTS_SEARCH = "events/{groupId}/search"
    const val EVENTS_ATTENDEES = "events/{groupId}/{eventId}/attendees"

    fun eventsListRoute(groupId: String) = "events/$groupId"
    fun eventsCalendarRoute(groupId: String) = "events/$groupId/calendar"
    fun eventsSearchRoute(groupId: String) = "events/$groupId/search"
    fun eventsAttendeesRoute(groupId: String, eventId: String) = "events/$groupId/$eventId/attendees"

    // ====== Messaging Module (enhancements) ======
    const val MESSAGE_SEARCH = "messages/search"
    const val MESSAGE_SEARCH_IN_CONVERSATION = "messages/search/{conversationId}"
    const val MESSAGE_THREAD = "messages/thread/{messageId}"

    fun messageSearchRoute() = "messages/search"
    fun messageSearchInConversationRoute(conversationId: String) = "messages/search/$conversationId"
    fun messageThreadRoute(messageId: String) = "messages/thread/$messageId"
}

/**
 * Module navigation items for display in navigation drawer or group navigation.
 *
 * Each item represents a module that can be enabled/disabled per group.
 */
data class ModuleNavItem(
    val moduleId: String,
    val label: String,
    val icon: ImageVector,
    val route: (groupId: String) -> String,
    val description: String
)

/**
 * All available module navigation items.
 *
 * These are shown in the group navigation drawer/tabs when the module is enabled.
 */
val moduleNavItems = listOf(
    ModuleNavItem(
        moduleId = "events",
        label = "Events",
        icon = Icons.Default.Event,
        route = { ModuleRoutes.eventsListRoute(it) },
        description = "Create and manage events with RSVPs"
    ),
    ModuleNavItem(
        moduleId = "tasks",
        label = "Tasks",
        icon = Icons.Default.TaskAlt,
        route = { ModuleRoutes.tasksListRoute(it) },
        description = "Organize work with task boards"
    ),
    ModuleNavItem(
        moduleId = "files",
        label = "Files",
        icon = Icons.Default.Folder,
        route = { ModuleRoutes.filesListRoute(it) },
        description = "Encrypted shared file storage"
    ),
    ModuleNavItem(
        moduleId = "polls",
        label = "Polls",
        icon = Icons.Default.Poll,
        route = { ModuleRoutes.pollsListRoute(it) },
        description = "Create polls and surveys"
    ),
    ModuleNavItem(
        moduleId = "wiki",
        label = "Wiki",
        icon = Icons.AutoMirrored.Filled.Article,
        route = { ModuleRoutes.wikiListRoute(it) },
        description = "Collaborative knowledge base"
    ),
    ModuleNavItem(
        moduleId = "governance",
        label = "Governance",
        icon = Icons.Default.HowToVote,
        route = { "governance/$it" },
        description = "Proposals and voting"
    ),
    ModuleNavItem(
        moduleId = "mutual_aid",
        label = "Mutual Aid",
        icon = Icons.Default.VolunteerActivism,
        route = { "mutual_aid/$it" },
        description = "Community resource sharing"
    ),
    ModuleNavItem(
        moduleId = "fundraising",
        label = "Fundraising",
        icon = Icons.Default.Payments,
        route = { "fundraising/$it" },
        description = "Campaign fundraising"
    ),
    ModuleNavItem(
        moduleId = "training",
        label = "Training",
        icon = Icons.Default.School,
        route = { "training/$it" },
        description = "Courses and learning materials"
    ),
    ModuleNavItem(
        moduleId = "newsletters",
        label = "Newsletters",
        icon = Icons.Default.Email,
        route = { "newsletters/$it" },
        description = "Group newsletters and announcements"
    ),
    ModuleNavItem(
        moduleId = "publishing",
        label = "Publishing",
        icon = Icons.Default.Newspaper,
        route = { "publishing/$it" },
        description = "Long-form content publishing"
    ),
    ModuleNavItem(
        moduleId = "forms",
        label = "Forms",
        icon = Icons.Default.Assignment,
        route = { "forms/$it" },
        description = "Custom forms and surveys"
    )
)
