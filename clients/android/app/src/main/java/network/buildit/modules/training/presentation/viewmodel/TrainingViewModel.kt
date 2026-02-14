package network.buildit.modules.training.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import network.buildit.generated.schemas.training.CourseCategory
import network.buildit.generated.schemas.training.CourseDifficulty
import network.buildit.generated.schemas.training.CourseStatus
import network.buildit.modules.training.domain.model.*
import network.buildit.modules.training.domain.usecase.*
import javax.inject.Inject

/**
 * UI state for the training courses list screen.
 */
data class TrainingUiState(
    val isLoading: Boolean = true,
    val courses: List<Course> = emptyList(),
    val enrolledCourses: List<CourseProgress> = emptyList(),
    val certifications: List<CertificationWithCourse> = emptyList(),
    val selectedCategory: CourseCategory? = null,
    val selectedDifficulty: CourseDifficulty? = null,
    val searchQuery: String = "",
    val error: String? = null
)

/**
 * ViewModel for the main Training module screens.
 */
@HiltViewModel
class TrainingViewModel @Inject constructor(
    private val getCoursesUseCase: GetCoursesUseCase,
    private val getCertificationsUseCase: GetCertificationsUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(TrainingUiState())
    val uiState: StateFlow<TrainingUiState> = _uiState.asStateFlow()

    private var currentGroupId: String? = null

    init {
        loadCourses()
        loadCertifications()
    }

    /**
     * Loads all available courses.
     */
    fun loadCourses(groupId: String? = null) {
        currentGroupId = groupId
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                val coursesFlow = if (groupId != null) {
                    getCoursesUseCase.forGroup(groupId)
                } else {
                    getCoursesUseCase()
                }

                coursesFlow.collect { courses ->
                    _uiState.update { state ->
                        state.copy(
                            isLoading = false,
                            courses = applyFilters(courses, state)
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isLoading = false, error = e.message)
                }
            }
        }
    }

    /**
     * Loads certifications for the current user.
     */
    private fun loadCertifications() {
        viewModelScope.launch {
            getCertificationsUseCase().collect { certs ->
                _uiState.update { it.copy(certifications = certs) }
            }
        }
    }

    /**
     * Filters courses by category.
     */
    fun filterByCategory(category: CourseCategory?) {
        _uiState.update { state ->
            val filtered = applyFilters(state.courses, state.copy(selectedCategory = category))
            state.copy(selectedCategory = category, courses = filtered)
        }
        // Reload to apply filters at query level
        loadCoursesWithCurrentFilters()
    }

    /**
     * Filters courses by difficulty.
     */
    fun filterByDifficulty(difficulty: CourseDifficulty?) {
        _uiState.update { state ->
            val filtered = applyFilters(state.courses, state.copy(selectedDifficulty = difficulty))
            state.copy(selectedDifficulty = difficulty, courses = filtered)
        }
        loadCoursesWithCurrentFilters()
    }

    /**
     * Searches courses.
     */
    fun search(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
        loadCoursesWithCurrentFilters()
    }

    /**
     * Clears all filters.
     */
    fun clearFilters() {
        _uiState.update {
            it.copy(
                selectedCategory = null,
                selectedDifficulty = null,
                searchQuery = ""
            )
        }
        loadCourses(currentGroupId)
    }

    /**
     * Refreshes data.
     */
    fun refresh() {
        loadCourses(currentGroupId)
        loadCertifications()
    }

    private fun loadCoursesWithCurrentFilters() {
        viewModelScope.launch {
            val state = _uiState.value
            val options = CourseQueryOptions(
                groupId = currentGroupId,
                category = state.selectedCategory,
                difficulty = state.selectedDifficulty,
                search = state.searchQuery.takeIf { it.isNotBlank() },
                status = CourseStatus.Published
            )

            getCoursesUseCase.withOptions(options).collect { courses ->
                _uiState.update { it.copy(courses = courses) }
            }
        }
    }

    private fun applyFilters(courses: List<Course>, state: TrainingUiState): List<Course> {
        return courses.filter { course ->
            val matchesCategory = state.selectedCategory == null || course.category == state.selectedCategory
            val matchesDifficulty = state.selectedDifficulty == null || course.difficulty == state.selectedDifficulty
            val matchesSearch = state.searchQuery.isBlank() ||
                    course.title.contains(state.searchQuery, ignoreCase = true) ||
                    course.description.contains(state.searchQuery, ignoreCase = true)
            matchesCategory && matchesDifficulty && matchesSearch
        }
    }
}

/**
 * UI state for course detail screen.
 */
sealed class CourseDetailUiState {
    data object Loading : CourseDetailUiState()
    data class Success(
        val courseDetail: CourseDetail,
        val isEnrolled: Boolean
    ) : CourseDetailUiState()
    data class Error(val message: String) : CourseDetailUiState()
}

/**
 * ViewModel for course detail screen.
 */
@HiltViewModel
class CourseDetailViewModel @Inject constructor(
    private val getCourseDetailUseCase: GetCourseDetailUseCase,
    private val startLessonUseCase: StartLessonUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow<CourseDetailUiState>(CourseDetailUiState.Loading)
    val uiState: StateFlow<CourseDetailUiState> = _uiState.asStateFlow()

    private var currentCourseId: String? = null

    /**
     * Loads course detail.
     */
    fun loadCourse(courseId: String) {
        currentCourseId = courseId
        viewModelScope.launch {
            _uiState.value = CourseDetailUiState.Loading

            getCourseDetailUseCase(courseId).collect { detail ->
                if (detail != null) {
                    _uiState.value = CourseDetailUiState.Success(
                        courseDetail = detail,
                        isEnrolled = detail.progress != null
                    )
                } else {
                    _uiState.value = CourseDetailUiState.Error("Course not found")
                }
            }
        }
    }

    /**
     * Starts or resumes a lesson.
     */
    suspend fun startLesson(lessonId: String): Boolean {
        return when (val result = startLessonUseCase(lessonId)) {
            is network.buildit.core.modules.ModuleResult.Success -> true
            else -> false
        }
    }

    /**
     * Refreshes course detail.
     */
    fun refresh() {
        currentCourseId?.let { loadCourse(it) }
    }
}

/**
 * UI state for certifications screen.
 */
data class CertificationsUiState(
    val isLoading: Boolean = true,
    val certifications: List<CertificationWithCourse> = emptyList(),
    val expiringSoon: List<CertificationWithCourse> = emptyList(),
    val error: String? = null
)

/**
 * ViewModel for certifications screen.
 */
@HiltViewModel
class CertificationsViewModel @Inject constructor(
    private val getCertificationsUseCase: GetCertificationsUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(CertificationsUiState())
    val uiState: StateFlow<CertificationsUiState> = _uiState.asStateFlow()

    init {
        loadCertifications()
    }

    /**
     * Loads all certifications.
     */
    fun loadCertifications() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                combine(
                    getCertificationsUseCase.validOnly(),
                    getCertificationsUseCase.expiringSoon(30)
                ) { all, expiring ->
                    Pair(all, expiring)
                }.collect { (all, expiring) ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            certifications = all,
                            expiringSoon = expiring
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isLoading = false, error = e.message)
                }
            }
        }
    }

    /**
     * Verifies a certification by code.
     */
    suspend fun verifyCertification(code: String): CertificationVerification {
        return getCertificationsUseCase.verify(code)
    }
}
