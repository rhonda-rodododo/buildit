package network.buildit.modules.tasks.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import network.buildit.core.modules.ModuleResult
import network.buildit.modules.tasks.data.local.TaskEntity
import network.buildit.modules.tasks.data.local.TaskPriority
import network.buildit.modules.tasks.data.local.TaskStatus
import network.buildit.modules.tasks.domain.TasksUseCase
import javax.inject.Inject

/**
 * UI state for the tasks list screen.
 */
data class TasksUiState(
    val tasks: List<TaskEntity> = emptyList(),
    val filteredTasks: List<TaskEntity> = emptyList(),
    val groupId: String? = null,
    val selectedStatus: TaskStatus? = null,
    val searchQuery: String = "",
    val viewMode: TaskViewMode = TaskViewMode.LIST,
    val isLoading: Boolean = true,
    val error: String? = null,
    val taskCounts: Map<TaskStatus, Int> = emptyMap()
)

/**
 * UI state for task detail screen.
 */
data class TaskDetailUiState(
    val task: TaskEntity? = null,
    val subtasks: List<TaskEntity> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null
)

/**
 * View mode toggle for tasks.
 */
enum class TaskViewMode {
    LIST,
    BOARD
}

/**
 * ViewModel for the Tasks module.
 */
@HiltViewModel
class TasksViewModel @Inject constructor(
    private val tasksUseCase: TasksUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(TasksUiState())
    val uiState: StateFlow<TasksUiState> = _uiState.asStateFlow()

    private val _detailState = MutableStateFlow(TaskDetailUiState())
    val detailState: StateFlow<TaskDetailUiState> = _detailState.asStateFlow()

    /**
     * Loads tasks for a group.
     */
    fun loadTasks(groupId: String) {
        _uiState.update { it.copy(groupId = groupId, isLoading = true, error = null) }

        viewModelScope.launch {
            tasksUseCase.getTasks(groupId)
                .catch { e -> _uiState.update { it.copy(error = e.message, isLoading = false) } }
                .collect { tasks ->
                    _uiState.update { state ->
                        state.copy(
                            tasks = tasks,
                            filteredTasks = applyFilters(tasks, state.selectedStatus, state.searchQuery),
                            isLoading = false
                        )
                    }
                }
        }

        // Load task counts
        viewModelScope.launch {
            try {
                val counts = TaskStatus.entries.associateWith { status ->
                    tasksUseCase.getTaskCountByStatus(groupId, status)
                }
                _uiState.update { it.copy(taskCounts = counts) }
            } catch (e: Exception) {
                // Non-critical, don't show error
            }
        }
    }

    /**
     * Creates a new task.
     */
    fun createTask(
        title: String,
        description: String? = null,
        assigneePubkey: String? = null,
        dueDate: Long? = null,
        priority: TaskPriority = TaskPriority.Medium,
        parentTaskId: String? = null
    ) {
        val groupId = _uiState.value.groupId ?: return

        viewModelScope.launch {
            when (val result = tasksUseCase.createTask(
                groupId = groupId,
                title = title,
                description = description,
                assigneePubkey = assigneePubkey,
                dueDate = dueDate,
                priority = priority,
                parentTaskId = parentTaskId
            )) {
                is ModuleResult.Success -> {
                    loadTasks(groupId)
                }
                is ModuleResult.Error -> {
                    _uiState.update { it.copy(error = result.message) }
                }
                ModuleResult.NotEnabled -> {
                    _uiState.update { it.copy(error = "Tasks module not enabled") }
                }
            }
        }
    }

    /**
     * Updates task status.
     */
    fun updateTaskStatus(taskId: String, status: TaskStatus) {
        viewModelScope.launch {
            when (val result = tasksUseCase.updateStatus(taskId, status)) {
                is ModuleResult.Success -> {
                    _uiState.value.groupId?.let { loadTasks(it) }
                }
                is ModuleResult.Error -> {
                    _uiState.update { it.copy(error = result.message) }
                }
                ModuleResult.NotEnabled -> {
                    _uiState.update { it.copy(error = "Tasks module not enabled") }
                }
            }
        }
    }

    /**
     * Assigns a task to a user.
     */
    fun assignTask(taskId: String, assigneePubkey: String?) {
        viewModelScope.launch {
            when (val result = tasksUseCase.assignTask(taskId, assigneePubkey)) {
                is ModuleResult.Success -> {
                    _uiState.value.groupId?.let { loadTasks(it) }
                }
                is ModuleResult.Error -> {
                    _uiState.update { it.copy(error = result.message) }
                }
                ModuleResult.NotEnabled -> {
                    _uiState.update { it.copy(error = "Tasks module not enabled") }
                }
            }
        }
    }

    /**
     * Deletes a task.
     */
    fun deleteTask(taskId: String) {
        viewModelScope.launch {
            when (val result = tasksUseCase.deleteTask(taskId)) {
                is ModuleResult.Success -> {
                    _uiState.value.groupId?.let { loadTasks(it) }
                }
                is ModuleResult.Error -> {
                    _uiState.update { it.copy(error = result.message) }
                }
                ModuleResult.NotEnabled -> {
                    _uiState.update { it.copy(error = "Tasks module not enabled") }
                }
            }
        }
    }

    /**
     * Loads task detail with subtasks.
     */
    fun loadTaskDetail(taskId: String) {
        _detailState.update { it.copy(isLoading = true, error = null) }

        viewModelScope.launch {
            tasksUseCase.observeTask(taskId)
                .catch { e -> _detailState.update { it.copy(error = e.message, isLoading = false) } }
                .collect { task ->
                    _detailState.update { it.copy(task = task, isLoading = false) }
                }
        }

        viewModelScope.launch {
            tasksUseCase.getSubtasks(taskId)
                .catch { /* non-critical */ }
                .collect { subtasks ->
                    _detailState.update { it.copy(subtasks = subtasks) }
                }
        }
    }

    /**
     * Filters by status.
     */
    fun filterByStatus(status: TaskStatus?) {
        _uiState.update { state ->
            state.copy(
                selectedStatus = status,
                filteredTasks = applyFilters(state.tasks, status, state.searchQuery)
            )
        }
    }

    /**
     * Searches tasks.
     */
    fun search(query: String) {
        _uiState.update { state ->
            state.copy(
                searchQuery = query,
                filteredTasks = applyFilters(state.tasks, state.selectedStatus, query)
            )
        }
    }

    /**
     * Toggles view mode.
     */
    fun toggleViewMode() {
        _uiState.update {
            it.copy(
                viewMode = if (it.viewMode == TaskViewMode.LIST) TaskViewMode.BOARD else TaskViewMode.LIST
            )
        }
    }

    /**
     * Clears error state.
     */
    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    private fun applyFilters(
        tasks: List<TaskEntity>,
        status: TaskStatus?,
        query: String
    ): List<TaskEntity> {
        var result = tasks
        if (status != null) {
            result = result.filter { it.status == status }
        }
        if (query.isNotBlank()) {
            val lowered = query.lowercase()
            result = result.filter {
                it.title.lowercase().contains(lowered) ||
                    it.description?.lowercase()?.contains(lowered) == true
            }
        }
        return result
    }
}
