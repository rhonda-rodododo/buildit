package network.buildit.modules.marketplace.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import network.buildit.core.modules.ModuleResult
import network.buildit.modules.marketplace.data.local.CoopProfileEntity
import network.buildit.modules.marketplace.data.local.GovernanceModel
import network.buildit.modules.marketplace.data.local.ListingEntity
import network.buildit.modules.marketplace.data.local.ListingType
import network.buildit.modules.marketplace.data.local.LocationValue
import network.buildit.modules.marketplace.data.local.ResourceShareEntity
import network.buildit.modules.marketplace.data.local.ResourceShareType
import network.buildit.modules.marketplace.data.local.ReviewEntity
import network.buildit.modules.marketplace.data.local.SkillExchangeEntity
import network.buildit.modules.marketplace.domain.MarketplaceUseCase
import network.buildit.modules.marketplace.domain.ReviewStats
import javax.inject.Inject

/**
 * ViewModel for the Marketplace module.
 *
 * Manages UI state for:
 * - Listings list and detail
 * - Co-op directory
 * - Skill exchanges
 * - Resource library
 * - Create forms
 */
@HiltViewModel
class MarketplaceViewModel @Inject constructor(
    private val marketplaceUseCase: MarketplaceUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow<MarketplaceUiState>(MarketplaceUiState.Loading)
    val uiState: StateFlow<MarketplaceUiState> = _uiState.asStateFlow()

    private val _listingDetailState = MutableStateFlow<ListingDetailState>(ListingDetailState.Loading)
    val listingDetailState: StateFlow<ListingDetailState> = _listingDetailState.asStateFlow()

    private val _coopsState = MutableStateFlow<CoopsUiState>(CoopsUiState.Loading)
    val coopsState: StateFlow<CoopsUiState> = _coopsState.asStateFlow()

    private val _exchangesState = MutableStateFlow<ExchangesUiState>(ExchangesUiState.Loading)
    val exchangesState: StateFlow<ExchangesUiState> = _exchangesState.asStateFlow()

    private val _resourcesState = MutableStateFlow<ResourcesUiState>(ResourcesUiState.Loading)
    val resourcesState: StateFlow<ResourcesUiState> = _resourcesState.asStateFlow()

    private val _createListingState = MutableStateFlow<CreateListingState>(CreateListingState.Idle)
    val createListingState: StateFlow<CreateListingState> = _createListingState.asStateFlow()

    // ============== Listings ==============

    /**
     * Loads active listings.
     */
    fun loadListings() {
        viewModelScope.launch {
            _uiState.value = MarketplaceUiState.Loading
            marketplaceUseCase.getActiveListings().collect { listings ->
                _uiState.value = MarketplaceUiState.ListingList(listings = listings)
            }
        }
    }

    /**
     * Loads listings filtered by type.
     */
    fun loadListingsByType(type: ListingType) {
        viewModelScope.launch {
            _uiState.value = MarketplaceUiState.Loading
            marketplaceUseCase.getActiveListingsByType(type).collect { listings ->
                _uiState.value = MarketplaceUiState.ListingList(
                    listings = listings,
                    filterType = type
                )
            }
        }
    }

    /**
     * Loads user's own listings.
     */
    fun loadMyListings() {
        viewModelScope.launch {
            _uiState.value = MarketplaceUiState.Loading
            marketplaceUseCase.getMyListings().collect { listings ->
                _uiState.value = MarketplaceUiState.ListingList(listings = listings)
            }
        }
    }

    /**
     * Searches listings.
     */
    fun searchListings(query: String) {
        viewModelScope.launch {
            marketplaceUseCase.searchListings(query).collect { listings ->
                _uiState.value = MarketplaceUiState.ListingList(
                    listings = listings,
                    searchQuery = query
                )
            }
        }
    }

    /**
     * Loads listing detail.
     */
    fun loadListingDetail(listingId: String) {
        viewModelScope.launch {
            _listingDetailState.value = ListingDetailState.Loading

            marketplaceUseCase.observeListing(listingId).collect { listing ->
                if (listing == null) {
                    _listingDetailState.value = ListingDetailState.Error("Listing not found")
                    return@collect
                }

                marketplaceUseCase.getReviewsForListing(listingId).collect { reviews ->
                    val reviewStats = marketplaceUseCase.getReviewStats(listingId)
                    _listingDetailState.value = ListingDetailState.Success(
                        listing = listing,
                        reviews = reviews,
                        reviewStats = reviewStats
                    )
                }
            }
        }
    }

    /**
     * Creates a new listing.
     */
    fun createListing(
        type: ListingType,
        title: String,
        description: String?,
        price: Double?,
        currency: String = "USD",
        images: List<String> = emptyList(),
        location: LocationValue? = null,
        availability: String? = null,
        tags: List<String> = emptyList(),
        expiresAt: Long? = null,
        groupId: String? = null,
        coopId: String? = null,
        contactMethod: String = "dm"
    ) {
        viewModelScope.launch {
            _createListingState.value = CreateListingState.Creating

            when (val result = marketplaceUseCase.createListing(
                type = type,
                title = title,
                description = description,
                price = price,
                currency = currency,
                images = images,
                location = location,
                availability = availability,
                tags = tags,
                expiresAt = expiresAt,
                groupId = groupId,
                coopId = coopId,
                contactMethod = contactMethod
            )) {
                is ModuleResult.Success -> {
                    _createListingState.value = CreateListingState.Success(result.data)
                    loadListings()
                }
                is ModuleResult.Error -> {
                    _createListingState.value = CreateListingState.Error(result.message)
                }
                ModuleResult.NotEnabled -> {
                    _createListingState.value = CreateListingState.Error("Marketplace module not enabled")
                }
            }
        }
    }

    /**
     * Deletes a listing.
     */
    fun deleteListing(listingId: String) {
        viewModelScope.launch {
            marketplaceUseCase.deleteListing(listingId)
            loadListings()
        }
    }

    /**
     * Resets create listing state.
     */
    fun resetCreateListingState() {
        _createListingState.value = CreateListingState.Idle
    }

    // ============== Co-ops ==============

    /**
     * Loads co-op directory.
     */
    fun loadCoops() {
        viewModelScope.launch {
            _coopsState.value = CoopsUiState.Loading
            marketplaceUseCase.getAllCoopProfiles().collect { coops ->
                _coopsState.value = CoopsUiState.CoopList(coops = coops)
            }
        }
    }

    /**
     * Searches co-op profiles.
     */
    fun searchCoops(query: String) {
        viewModelScope.launch {
            marketplaceUseCase.searchCoopProfiles(query).collect { coops ->
                _coopsState.value = CoopsUiState.CoopList(coops = coops, searchQuery = query)
            }
        }
    }

    // ============== Skill Exchanges ==============

    /**
     * Loads active skill exchanges.
     */
    fun loadExchanges() {
        viewModelScope.launch {
            _exchangesState.value = ExchangesUiState.Loading
            marketplaceUseCase.getActiveExchanges().collect { exchanges ->
                _exchangesState.value = ExchangesUiState.ExchangeList(exchanges = exchanges)
            }
        }
    }

    // ============== Resources ==============

    /**
     * Loads available resources.
     */
    fun loadResources() {
        viewModelScope.launch {
            _resourcesState.value = ResourcesUiState.Loading
            marketplaceUseCase.getAvailableResources().collect { resources ->
                _resourcesState.value = ResourcesUiState.ResourceList(resources = resources)
            }
        }
    }

    /**
     * Loads resources filtered by type.
     */
    fun loadResourcesByType(type: ResourceShareType) {
        viewModelScope.launch {
            _resourcesState.value = ResourcesUiState.Loading
            marketplaceUseCase.getAvailableResourcesByType(type).collect { resources ->
                _resourcesState.value = ResourcesUiState.ResourceList(
                    resources = resources,
                    filterType = type
                )
            }
        }
    }
}

// ============== UI State Classes ==============

/**
 * UI state for the marketplace listings screen.
 */
sealed class MarketplaceUiState {
    data object Loading : MarketplaceUiState()
    data class ListingList(
        val listings: List<ListingEntity>,
        val filterType: ListingType? = null,
        val searchQuery: String? = null
    ) : MarketplaceUiState()
    data class Error(val message: String) : MarketplaceUiState()
}

/**
 * UI state for listing detail screen.
 */
sealed class ListingDetailState {
    data object Loading : ListingDetailState()
    data class Success(
        val listing: ListingEntity,
        val reviews: List<ReviewEntity>,
        val reviewStats: ReviewStats
    ) : ListingDetailState()
    data class Error(val message: String) : ListingDetailState()
}

/**
 * UI state for co-op directory.
 */
sealed class CoopsUiState {
    data object Loading : CoopsUiState()
    data class CoopList(
        val coops: List<CoopProfileEntity>,
        val searchQuery: String? = null
    ) : CoopsUiState()
    data class Error(val message: String) : CoopsUiState()
}

/**
 * UI state for skill exchanges.
 */
sealed class ExchangesUiState {
    data object Loading : ExchangesUiState()
    data class ExchangeList(
        val exchanges: List<SkillExchangeEntity>,
        val searchQuery: String? = null
    ) : ExchangesUiState()
    data class Error(val message: String) : ExchangesUiState()
}

/**
 * UI state for resource library.
 */
sealed class ResourcesUiState {
    data object Loading : ResourcesUiState()
    data class ResourceList(
        val resources: List<ResourceShareEntity>,
        val filterType: ResourceShareType? = null,
        val searchQuery: String? = null
    ) : ResourcesUiState()
    data class Error(val message: String) : ResourcesUiState()
}

/**
 * UI state for creating a listing.
 */
sealed class CreateListingState {
    data object Idle : CreateListingState()
    data object Creating : CreateListingState()
    data class Success(val listing: ListingEntity) : CreateListingState()
    data class Error(val message: String) : CreateListingState()
}
