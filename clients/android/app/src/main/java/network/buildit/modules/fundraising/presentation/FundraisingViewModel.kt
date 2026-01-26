package network.buildit.modules.fundraising.presentation

import android.content.Context
import android.content.Intent
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import network.buildit.core.modules.ModuleResult
import network.buildit.modules.fundraising.data.CampaignWithStats
import network.buildit.modules.fundraising.data.local.CampaignEntity
import network.buildit.modules.fundraising.data.local.CampaignStatus
import network.buildit.modules.fundraising.data.local.CampaignVisibility
import network.buildit.modules.fundraising.data.local.DonationEntity
import network.buildit.modules.fundraising.data.local.DonationTier
import network.buildit.modules.fundraising.data.local.ExpenseEntity
import network.buildit.modules.fundraising.data.local.PaymentMethod
import network.buildit.modules.fundraising.domain.DonationStats
import network.buildit.modules.fundraising.domain.ExpenseSummary
import network.buildit.modules.fundraising.domain.FundraisingUseCase
import javax.inject.Inject

/**
 * ViewModel for the Fundraising module.
 *
 * Manages UI state for:
 * - Campaign list
 * - Campaign details
 * - Donation flow
 * - Expense tracking
 */
@HiltViewModel
class FundraisingViewModel @Inject constructor(
    private val fundraisingUseCase: FundraisingUseCase,
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val _uiState = MutableStateFlow<FundraisingUiState>(FundraisingUiState.Loading)
    val uiState: StateFlow<FundraisingUiState> = _uiState.asStateFlow()

    private val _campaignDetailState = MutableStateFlow<CampaignDetailState>(CampaignDetailState.Loading)
    val campaignDetailState: StateFlow<CampaignDetailState> = _campaignDetailState.asStateFlow()

    private val _donateState = MutableStateFlow<DonateState>(DonateState.Idle)
    val donateState: StateFlow<DonateState> = _donateState.asStateFlow()

    private val _createCampaignState = MutableStateFlow<CreateCampaignState>(CreateCampaignState.Idle)
    val createCampaignState: StateFlow<CreateCampaignState> = _createCampaignState.asStateFlow()

    private var currentGroupId: String? = null

    /**
     * Loads campaigns for a specific group.
     */
    fun loadCampaigns(groupId: String?) {
        currentGroupId = groupId
        viewModelScope.launch {
            _uiState.value = FundraisingUiState.Loading
            fundraisingUseCase.getCampaigns(groupId).collect { campaigns ->
                _uiState.value = FundraisingUiState.CampaignList(
                    campaigns = campaigns,
                    groupId = groupId
                )
            }
        }
    }

    /**
     * Loads active campaigns.
     */
    fun loadActiveCampaigns() {
        viewModelScope.launch {
            _uiState.value = FundraisingUiState.Loading
            fundraisingUseCase.getActiveCampaigns().collect { campaigns ->
                _uiState.value = FundraisingUiState.CampaignList(
                    campaigns = campaigns,
                    groupId = null
                )
            }
        }
    }

    /**
     * Loads campaigns created by the current user.
     */
    fun loadMyCampaigns() {
        viewModelScope.launch {
            _uiState.value = FundraisingUiState.Loading
            fundraisingUseCase.getMyCampaigns().collect { campaigns ->
                _uiState.value = FundraisingUiState.CampaignList(
                    campaigns = campaigns,
                    groupId = null
                )
            }
        }
    }

    /**
     * Searches campaigns.
     */
    fun searchCampaigns(query: String) {
        viewModelScope.launch {
            fundraisingUseCase.searchCampaigns(currentGroupId, query).collect { campaigns ->
                _uiState.value = FundraisingUiState.CampaignList(
                    campaigns = campaigns,
                    groupId = currentGroupId,
                    searchQuery = query
                )
            }
        }
    }

    /**
     * Loads a specific campaign and its details.
     */
    fun loadCampaignDetail(campaignId: String) {
        viewModelScope.launch {
            _campaignDetailState.value = CampaignDetailState.Loading

            // Collect campaign, donations, and expenses
            fundraisingUseCase.observeCampaign(campaignId).collect { campaign ->
                if (campaign == null) {
                    _campaignDetailState.value = CampaignDetailState.Error("Campaign not found")
                    return@collect
                }

                // Get donations
                fundraisingUseCase.getCompletedDonations(campaignId).collect { donations ->
                    // Get stats
                    val donationStats = fundraisingUseCase.getDonationStats(campaignId)
                    val expenseSummary = fundraisingUseCase.getExpenseSummary(campaignId)

                    _campaignDetailState.value = CampaignDetailState.Success(
                        campaign = campaign,
                        donations = donations,
                        donationStats = donationStats,
                        expenseSummary = expenseSummary
                    )
                }
            }
        }
    }

    /**
     * Creates a new campaign.
     */
    fun createCampaign(
        title: String,
        description: String?,
        goal: Double,
        currency: String,
        groupId: String? = null,
        image: String? = null,
        tiers: List<DonationTier>? = null,
        startsAt: Long? = null,
        endsAt: Long? = null,
        visibility: CampaignVisibility = CampaignVisibility.GROUP
    ) {
        viewModelScope.launch {
            _createCampaignState.value = CreateCampaignState.Creating

            when (val result = fundraisingUseCase.createCampaign(
                title = title,
                description = description,
                goal = goal,
                currency = currency,
                groupId = groupId,
                image = image,
                tiers = tiers,
                startsAt = startsAt,
                endsAt = endsAt,
                visibility = visibility
            )) {
                is ModuleResult.Success -> {
                    _createCampaignState.value = CreateCampaignState.Success(result.data)
                    loadCampaigns(groupId)
                }
                is ModuleResult.Error -> {
                    _createCampaignState.value = CreateCampaignState.Error(result.message)
                }
                ModuleResult.NotEnabled -> {
                    _createCampaignState.value = CreateCampaignState.Error("Fundraising module not enabled")
                }
            }
        }
    }

    /**
     * Launches a campaign.
     */
    fun launchCampaign(campaignId: String) {
        viewModelScope.launch {
            when (val result = fundraisingUseCase.launchCampaign(campaignId)) {
                is ModuleResult.Success -> {
                    loadCampaignDetail(campaignId)
                }
                is ModuleResult.Error -> {
                    _campaignDetailState.value = CampaignDetailState.Error(result.message)
                }
                ModuleResult.NotEnabled -> {
                    _campaignDetailState.value = CampaignDetailState.Error("Fundraising module not enabled")
                }
            }
        }
    }

    /**
     * Pauses a campaign.
     */
    fun pauseCampaign(campaignId: String) {
        viewModelScope.launch {
            when (val result = fundraisingUseCase.pauseCampaign(campaignId)) {
                is ModuleResult.Success -> {
                    loadCampaignDetail(campaignId)
                }
                is ModuleResult.Error -> {
                    _campaignDetailState.value = CampaignDetailState.Error(result.message)
                }
                ModuleResult.NotEnabled -> {
                    _campaignDetailState.value = CampaignDetailState.Error("Fundraising module not enabled")
                }
            }
        }
    }

    /**
     * Completes a campaign.
     */
    fun completeCampaign(campaignId: String) {
        viewModelScope.launch {
            when (val result = fundraisingUseCase.completeCampaign(campaignId)) {
                is ModuleResult.Success -> {
                    loadCampaignDetail(campaignId)
                }
                is ModuleResult.Error -> {
                    _campaignDetailState.value = CampaignDetailState.Error(result.message)
                }
                ModuleResult.NotEnabled -> {
                    _campaignDetailState.value = CampaignDetailState.Error("Fundraising module not enabled")
                }
            }
        }
    }

    /**
     * Adds an update to a campaign.
     */
    fun addCampaignUpdate(campaignId: String, content: String) {
        viewModelScope.launch {
            when (val result = fundraisingUseCase.addCampaignUpdate(campaignId, content)) {
                is ModuleResult.Success -> {
                    loadCampaignDetail(campaignId)
                }
                is ModuleResult.Error -> {
                    _campaignDetailState.value = CampaignDetailState.Error(result.message)
                }
                ModuleResult.NotEnabled -> {
                    _campaignDetailState.value = CampaignDetailState.Error("Fundraising module not enabled")
                }
            }
        }
    }

    /**
     * Deletes a campaign.
     */
    fun deleteCampaign(campaignId: String) {
        viewModelScope.launch {
            when (val result = fundraisingUseCase.deleteCampaign(campaignId)) {
                is ModuleResult.Success -> {
                    loadCampaigns(currentGroupId)
                }
                is ModuleResult.Error -> {
                    _campaignDetailState.value = CampaignDetailState.Error(result.message)
                }
                ModuleResult.NotEnabled -> {
                    _campaignDetailState.value = CampaignDetailState.Error("Fundraising module not enabled")
                }
            }
        }
    }

    /**
     * Creates a donation.
     */
    fun donate(
        campaignId: String,
        amount: Double,
        currency: String,
        donorName: String?,
        anonymous: Boolean,
        message: String?,
        tierId: String?,
        paymentMethod: PaymentMethod
    ) {
        viewModelScope.launch {
            _donateState.value = DonateState.Processing

            when (val result = fundraisingUseCase.createDonation(
                campaignId = campaignId,
                amount = amount,
                currency = currency,
                donorName = donorName,
                anonymous = anonymous,
                message = message,
                tierId = tierId,
                paymentMethod = paymentMethod
            )) {
                is ModuleResult.Success -> {
                    // If crypto payment, initiate payment flow
                    if (paymentMethod == PaymentMethod.CRYPTO) {
                        _donateState.value = DonateState.AwaitingPayment(result.data)
                    } else {
                        // Mark as completed for other payment methods
                        fundraisingUseCase.completeDonation(result.data.id)
                        _donateState.value = DonateState.Success(result.data)
                        loadCampaignDetail(campaignId)
                    }
                }
                is ModuleResult.Error -> {
                    _donateState.value = DonateState.Error(result.message)
                }
                ModuleResult.NotEnabled -> {
                    _donateState.value = DonateState.Error("Fundraising module not enabled")
                }
            }
        }
    }

    /**
     * Confirms a crypto payment was completed.
     */
    fun confirmCryptoPayment(donationId: String) {
        viewModelScope.launch {
            when (val result = fundraisingUseCase.completeDonation(donationId)) {
                is ModuleResult.Success -> {
                    _donateState.value = DonateState.Success(result.data)
                    loadCampaignDetail(result.data.campaignId)
                }
                is ModuleResult.Error -> {
                    _donateState.value = DonateState.Error(result.message)
                }
                ModuleResult.NotEnabled -> {
                    _donateState.value = DonateState.Error("Fundraising module not enabled")
                }
            }
        }
    }

    /**
     * Resets the donate state.
     */
    fun resetDonateState() {
        _donateState.value = DonateState.Idle
    }

    /**
     * Resets the create campaign state.
     */
    fun resetCreateCampaignState() {
        _createCampaignState.value = CreateCampaignState.Idle
    }

    /**
     * Records an expense.
     */
    fun recordExpense(
        campaignId: String,
        amount: Double,
        currency: String,
        description: String,
        category: String?,
        vendor: String?
    ) {
        viewModelScope.launch {
            when (val result = fundraisingUseCase.recordExpense(
                campaignId = campaignId,
                amount = amount,
                currency = currency,
                description = description,
                category = category,
                vendor = vendor
            )) {
                is ModuleResult.Success -> {
                    loadCampaignDetail(campaignId)
                }
                is ModuleResult.Error -> {
                    _campaignDetailState.value = CampaignDetailState.Error(result.message)
                }
                ModuleResult.NotEnabled -> {
                    _campaignDetailState.value = CampaignDetailState.Error("Fundraising module not enabled")
                }
            }
        }
    }

    /**
     * Shares a campaign.
     */
    fun shareCampaign(campaignId: String) {
        viewModelScope.launch {
            val shareText = fundraisingUseCase.getShareText(campaignId) ?: return@launch

            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, shareText)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            context.startActivity(
                Intent.createChooser(shareIntent, "Share Campaign").apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            )
        }
    }

    /**
     * Gets shareable link for a campaign.
     */
    fun getShareableLink(campaignId: String): String {
        return fundraisingUseCase.getShareableLink(campaignId)
    }
}

/**
 * UI state for the campaigns list screen.
 */
sealed class FundraisingUiState {
    data object Loading : FundraisingUiState()
    data class CampaignList(
        val campaigns: List<CampaignEntity>,
        val groupId: String?,
        val searchQuery: String? = null
    ) : FundraisingUiState()
    data class Error(val message: String) : FundraisingUiState()
}

/**
 * UI state for the campaign detail screen.
 */
sealed class CampaignDetailState {
    data object Loading : CampaignDetailState()
    data class Success(
        val campaign: CampaignEntity,
        val donations: List<DonationEntity>,
        val donationStats: DonationStats,
        val expenseSummary: ExpenseSummary
    ) : CampaignDetailState()
    data class Error(val message: String) : CampaignDetailState()
}

/**
 * UI state for the donate flow.
 */
sealed class DonateState {
    data object Idle : DonateState()
    data object Processing : DonateState()
    data class AwaitingPayment(val donation: DonationEntity) : DonateState()
    data class Success(val donation: DonationEntity) : DonateState()
    data class Error(val message: String) : DonateState()
}

/**
 * UI state for creating a campaign.
 */
sealed class CreateCampaignState {
    data object Idle : CreateCampaignState()
    data object Creating : CreateCampaignState()
    data class Success(val campaign: CampaignEntity) : CreateCampaignState()
    data class Error(val message: String) : CreateCampaignState()
}
