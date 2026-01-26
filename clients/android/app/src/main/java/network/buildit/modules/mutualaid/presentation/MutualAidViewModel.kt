package network.buildit.modules.mutualaid.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import network.buildit.modules.mutualaid.data.local.*
import network.buildit.modules.mutualaid.domain.MutualAidUseCase
import javax.inject.Inject

/**
 * UI state for the mutual aid screen.
 */
data class MutualAidUiState(
    val requests: List<AidRequestEntity> = emptyList(),
    val offers: List<AidOfferEntity> = emptyList(),
    val selectedCategory: AidCategory? = null,
    val selectedTab: Int = 0, // 0 = Requests, 1 = Offers
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

/**
 * ViewModel for the mutual aid list screen.
 */
@HiltViewModel
class MutualAidViewModel @Inject constructor(
    private val useCase: MutualAidUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(MutualAidUiState())
    val uiState: StateFlow<MutualAidUiState> = _uiState.asStateFlow()

    private val _selectedCategory = MutableStateFlow<AidCategory?>(null)

    init {
        loadData()
    }

    private fun loadData() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }

            // Combine flows for requests
            combine(
                _selectedCategory,
                _selectedCategory.flatMapLatest { category ->
                    if (category != null) {
                        useCase.getActiveRequestsByCategory(category)
                    } else {
                        useCase.getActiveRequests()
                    }
                }
            ) { _, requests ->
                requests
            }.collect { requests ->
                _uiState.update {
                    it.copy(
                        requests = requests,
                        isLoading = false
                    )
                }
            }
        }

        viewModelScope.launch {
            // Combine flows for offers
            combine(
                _selectedCategory,
                _selectedCategory.flatMapLatest { category ->
                    if (category != null) {
                        useCase.getActiveOffersByCategory(category)
                    } else {
                        useCase.getActiveOffers()
                    }
                }
            ) { _, offers ->
                offers
            }.collect { offers ->
                _uiState.update { it.copy(offers = offers) }
            }
        }
    }

    fun selectTab(tab: Int) {
        _uiState.update { it.copy(selectedTab = tab) }
    }

    fun selectCategory(category: AidCategory?) {
        _selectedCategory.value = category
        _uiState.update { it.copy(selectedCategory = category) }
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }
}

/**
 * UI state for creating a request.
 */
data class CreateRequestUiState(
    val title: String = "",
    val description: String = "",
    val category: AidCategory = AidCategory.OTHER,
    val urgency: UrgencyLevel = UrgencyLevel.MEDIUM,
    val locationCity: String = "",
    val locationFlexible: Boolean = false,
    val hasDeadline: Boolean = false,
    val neededBy: Long? = null,
    val hasQuantity: Boolean = false,
    val quantityNeeded: String = "",
    val unit: String = "",
    val anonymousRequest: Boolean = false,
    val isSubmitting: Boolean = false,
    val isComplete: Boolean = false,
    val errorMessage: String? = null
)

/**
 * ViewModel for creating a request.
 */
@HiltViewModel
class CreateRequestViewModel @Inject constructor(
    private val useCase: MutualAidUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(CreateRequestUiState())
    val uiState: StateFlow<CreateRequestUiState> = _uiState.asStateFlow()

    fun updateTitle(title: String) {
        _uiState.update { it.copy(title = title) }
    }

    fun updateDescription(description: String) {
        _uiState.update { it.copy(description = description) }
    }

    fun updateCategory(category: AidCategory) {
        _uiState.update { it.copy(category = category) }
    }

    fun updateUrgency(urgency: UrgencyLevel) {
        _uiState.update { it.copy(urgency = urgency) }
    }

    fun updateLocationCity(city: String) {
        _uiState.update { it.copy(locationCity = city) }
    }

    fun updateLocationFlexible(flexible: Boolean) {
        _uiState.update { it.copy(locationFlexible = flexible) }
    }

    fun updateHasDeadline(hasDeadline: Boolean) {
        _uiState.update { it.copy(hasDeadline = hasDeadline) }
    }

    fun updateNeededBy(neededBy: Long?) {
        _uiState.update { it.copy(neededBy = neededBy) }
    }

    fun updateHasQuantity(hasQuantity: Boolean) {
        _uiState.update { it.copy(hasQuantity = hasQuantity) }
    }

    fun updateQuantityNeeded(quantity: String) {
        _uiState.update { it.copy(quantityNeeded = quantity) }
    }

    fun updateUnit(unit: String) {
        _uiState.update { it.copy(unit = unit) }
    }

    fun updateAnonymousRequest(anonymous: Boolean) {
        _uiState.update { it.copy(anonymousRequest = anonymous) }
    }

    fun isValid(): Boolean {
        return _uiState.value.title.isNotBlank()
    }

    fun submit() {
        if (!isValid()) return

        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, errorMessage = null) }

            try {
                val state = _uiState.value

                useCase.createRequest(
                    title = state.title.trim(),
                    description = state.description.ifBlank { null },
                    category = state.category,
                    urgency = state.urgency,
                    anonymousRequest = state.anonymousRequest,
                    locationCity = if (!state.locationFlexible && state.locationCity.isNotBlank()) state.locationCity else null,
                    locationType = if (state.locationFlexible) "flexible" else if (state.locationCity.isNotBlank()) "area" else null,
                    neededBy = if (state.hasDeadline) state.neededBy else null,
                    quantityNeeded = if (state.hasQuantity) state.quantityNeeded.toDoubleOrNull() else null,
                    unit = if (state.hasQuantity && state.unit.isNotBlank()) state.unit else null
                )

                _uiState.update { it.copy(isSubmitting = false, isComplete = true) }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        errorMessage = e.message ?: "Failed to create request"
                    )
                }
            }
        }
    }
}

/**
 * UI state for creating an offer.
 */
data class CreateOfferUiState(
    val title: String = "",
    val description: String = "",
    val category: AidCategory = AidCategory.OTHER,
    val locationCity: String = "",
    val locationFlexible: Boolean = false,
    val hasEndDate: Boolean = false,
    val availableFrom: Long = System.currentTimeMillis(),
    val availableUntil: Long? = null,
    val hasQuantity: Boolean = false,
    val quantity: String = "",
    val unit: String = "",
    val isSubmitting: Boolean = false,
    val isComplete: Boolean = false,
    val errorMessage: String? = null
)

/**
 * ViewModel for creating an offer.
 */
@HiltViewModel
class CreateOfferViewModel @Inject constructor(
    private val useCase: MutualAidUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(CreateOfferUiState())
    val uiState: StateFlow<CreateOfferUiState> = _uiState.asStateFlow()

    fun updateTitle(title: String) {
        _uiState.update { it.copy(title = title) }
    }

    fun updateDescription(description: String) {
        _uiState.update { it.copy(description = description) }
    }

    fun updateCategory(category: AidCategory) {
        _uiState.update { it.copy(category = category) }
    }

    fun updateLocationCity(city: String) {
        _uiState.update { it.copy(locationCity = city) }
    }

    fun updateLocationFlexible(flexible: Boolean) {
        _uiState.update { it.copy(locationFlexible = flexible) }
    }

    fun updateHasEndDate(hasEnd: Boolean) {
        _uiState.update { it.copy(hasEndDate = hasEnd) }
    }

    fun updateAvailableFrom(from: Long) {
        _uiState.update { it.copy(availableFrom = from) }
    }

    fun updateAvailableUntil(until: Long?) {
        _uiState.update { it.copy(availableUntil = until) }
    }

    fun updateHasQuantity(hasQuantity: Boolean) {
        _uiState.update { it.copy(hasQuantity = hasQuantity) }
    }

    fun updateQuantity(quantity: String) {
        _uiState.update { it.copy(quantity = quantity) }
    }

    fun updateUnit(unit: String) {
        _uiState.update { it.copy(unit = unit) }
    }

    fun isValid(): Boolean {
        return _uiState.value.title.isNotBlank()
    }

    fun submit() {
        if (!isValid()) return

        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, errorMessage = null) }

            try {
                val state = _uiState.value

                useCase.createOffer(
                    title = state.title.trim(),
                    description = state.description.ifBlank { null },
                    category = state.category,
                    locationCity = if (!state.locationFlexible && state.locationCity.isNotBlank()) state.locationCity else null,
                    locationType = if (state.locationFlexible) "remote" else if (state.locationCity.isNotBlank()) "area" else null,
                    availableFrom = state.availableFrom,
                    availableUntil = if (state.hasEndDate) state.availableUntil else null,
                    quantity = if (state.hasQuantity) state.quantity.toDoubleOrNull() else null,
                    unit = if (state.hasQuantity && state.unit.isNotBlank()) state.unit else null
                )

                _uiState.update { it.copy(isSubmitting = false, isComplete = true) }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        errorMessage = e.message ?: "Failed to create offer"
                    )
                }
            }
        }
    }
}

/**
 * UI state for request detail.
 */
data class RequestDetailUiState(
    val request: AidRequestEntity? = null,
    val fulfillments: List<FulfillmentEntity> = emptyList(),
    val isLoading: Boolean = true,
    val errorMessage: String? = null
)

/**
 * ViewModel for request detail.
 */
@HiltViewModel
class RequestDetailViewModel @Inject constructor(
    private val useCase: MutualAidUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(RequestDetailUiState())
    val uiState: StateFlow<RequestDetailUiState> = _uiState.asStateFlow()

    fun loadRequest(requestId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }

            useCase.observeRequest(requestId).collect { request ->
                _uiState.update { it.copy(request = request, isLoading = false) }
            }
        }

        viewModelScope.launch {
            useCase.getFulfillmentsByRequest(requestId).collect { fulfillments ->
                _uiState.update { it.copy(fulfillments = fulfillments) }
            }
        }
    }

    fun offerFulfillment(
        requestId: String,
        quantity: Double?,
        message: String?,
        scheduledFor: Long?
    ) {
        viewModelScope.launch {
            try {
                useCase.offerFulfillment(requestId, quantity, message, scheduledFor)
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = e.message) }
            }
        }
    }
}
