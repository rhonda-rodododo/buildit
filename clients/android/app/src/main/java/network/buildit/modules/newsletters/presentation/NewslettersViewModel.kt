package network.buildit.modules.newsletters.presentation

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import network.buildit.core.modules.ModuleResult
import network.buildit.modules.newsletters.data.DeliveryStats
import network.buildit.modules.newsletters.data.local.*
import network.buildit.modules.newsletters.domain.ImportResult
import network.buildit.modules.newsletters.domain.NewslettersUseCase
import network.buildit.modules.newsletters.domain.SendingProgress
import java.io.InputStream
import java.io.OutputStream
import javax.inject.Inject

/**
 * ViewModel for the Newsletters module.
 *
 * Manages UI state for:
 * - Newsletter list and details
 * - Campaign management
 * - Subscriber management
 * - Sending progress
 */
@HiltViewModel
class NewslettersViewModel @Inject constructor(
    private val newslettersUseCase: NewslettersUseCase
) : ViewModel() {

    // ============== Newsletter List State ==============

    private val _newslettersState = MutableStateFlow<NewslettersListState>(NewslettersListState.Loading)
    val newslettersState: StateFlow<NewslettersListState> = _newslettersState.asStateFlow()

    // ============== Newsletter Detail State ==============

    private val _newsletterDetailState = MutableStateFlow<NewsletterDetailState>(NewsletterDetailState.Loading)
    val newsletterDetailState: StateFlow<NewsletterDetailState> = _newsletterDetailState.asStateFlow()

    // ============== Campaign Editor State ==============

    private val _campaignEditorState = MutableStateFlow<CampaignEditorState>(CampaignEditorState.Empty)
    val campaignEditorState: StateFlow<CampaignEditorState> = _campaignEditorState.asStateFlow()

    // ============== Subscribers State ==============

    private val _subscribersState = MutableStateFlow<SubscribersState>(SubscribersState.Loading)
    val subscribersState: StateFlow<SubscribersState> = _subscribersState.asStateFlow()

    // ============== Issue History State ==============

    private val _issueHistoryState = MutableStateFlow<IssueHistoryState>(IssueHistoryState.Loading)
    val issueHistoryState: StateFlow<IssueHistoryState> = _issueHistoryState.asStateFlow()

    // ============== Delivery Progress State ==============

    private val _deliveryProgressState = MutableStateFlow<DeliveryProgressState>(DeliveryProgressState.Idle)
    val deliveryProgressState: StateFlow<DeliveryProgressState> = _deliveryProgressState.asStateFlow()

    // ============== Sending Progress ==============

    val sendingProgress: StateFlow<SendingProgress?> = newslettersUseCase.sendingProgress

    // ============== Error State ==============

    private val _errorState = MutableStateFlow<String?>(null)
    val errorState: StateFlow<String?> = _errorState.asStateFlow()

    init {
        // Collect sending progress updates
        viewModelScope.launch {
            newslettersUseCase.sendingProgress.collect { progress ->
                if (progress != null) {
                    _deliveryProgressState.value = DeliveryProgressState.Sending(progress)
                }
            }
        }
    }

    // ============== Newsletter List Operations ==============

    /**
     * Loads all newsletters for the current user.
     */
    fun loadNewsletters() {
        viewModelScope.launch {
            _newslettersState.value = NewslettersListState.Loading
            newslettersUseCase.getMyNewsletters().collect { newsletters ->
                _newslettersState.value = NewslettersListState.Success(newsletters)
            }
        }
    }

    /**
     * Loads newsletters for a specific group.
     */
    fun loadNewslettersByGroup(groupId: String) {
        viewModelScope.launch {
            _newslettersState.value = NewslettersListState.Loading
            newslettersUseCase.getNewslettersByGroup(groupId).collect { newsletters ->
                _newslettersState.value = NewslettersListState.Success(newsletters)
            }
        }
    }

    /**
     * Creates a new newsletter.
     */
    fun createNewsletter(
        name: String,
        description: String? = null,
        groupId: String? = null,
        fromName: String? = null,
        replyTo: String? = null,
        visibility: NewsletterVisibility = NewsletterVisibility.GROUP,
        doubleOptIn: Boolean = true
    ) {
        viewModelScope.launch {
            _newslettersState.value = NewslettersListState.Creating

            when (val result = newslettersUseCase.createNewsletter(
                name = name,
                description = description,
                groupId = groupId,
                fromName = fromName,
                replyTo = replyTo,
                visibility = visibility,
                doubleOptIn = doubleOptIn
            )) {
                is ModuleResult.Success -> {
                    loadNewsletters()
                }
                is ModuleResult.Error -> {
                    _errorState.value = result.message
                    loadNewsletters()
                }
                ModuleResult.NotEnabled -> {
                    _errorState.value = "Newsletters module not enabled"
                }
            }
        }
    }

    /**
     * Deletes a newsletter.
     */
    fun deleteNewsletter(newsletterId: String) {
        viewModelScope.launch {
            when (val result = newslettersUseCase.deleteNewsletter(newsletterId)) {
                is ModuleResult.Success -> loadNewsletters()
                is ModuleResult.Error -> _errorState.value = result.message
                ModuleResult.NotEnabled -> _errorState.value = "Module not enabled"
            }
        }
    }

    // ============== Newsletter Detail Operations ==============

    /**
     * Loads newsletter details.
     */
    fun loadNewsletterDetail(newsletterId: String) {
        viewModelScope.launch {
            _newsletterDetailState.value = NewsletterDetailState.Loading

            newslettersUseCase.observeNewsletter(newsletterId).collect { newsletter ->
                if (newsletter == null) {
                    _newsletterDetailState.value = NewsletterDetailState.Error("Newsletter not found")
                } else {
                    _newsletterDetailState.value = NewsletterDetailState.Success(newsletter)
                }
            }
        }
    }

    /**
     * Updates newsletter settings.
     */
    fun updateNewsletter(newsletter: NewsletterEntity) {
        viewModelScope.launch {
            when (val result = newslettersUseCase.updateNewsletter(newsletter)) {
                is ModuleResult.Success -> {
                    _newsletterDetailState.value = NewsletterDetailState.Success(result.data)
                }
                is ModuleResult.Error -> {
                    _errorState.value = result.message
                }
                ModuleResult.NotEnabled -> {
                    _errorState.value = "Module not enabled"
                }
            }
        }
    }

    // ============== Campaign Operations ==============

    /**
     * Loads campaigns for a newsletter.
     */
    fun loadCampaigns(newsletterId: String) {
        viewModelScope.launch {
            newslettersUseCase.getCampaigns(newsletterId).collect { campaigns ->
                // Could update a separate campaigns state if needed
            }
        }
    }

    /**
     * Creates a new campaign draft.
     */
    fun createCampaign(
        newsletterId: String,
        subject: String,
        content: String,
        preheader: String? = null,
        contentType: CampaignContentType = CampaignContentType.MARKDOWN
    ) {
        viewModelScope.launch {
            _campaignEditorState.value = CampaignEditorState.Saving

            when (val result = newslettersUseCase.createCampaign(
                newsletterId = newsletterId,
                subject = subject,
                content = content,
                preheader = preheader,
                contentType = contentType
            )) {
                is ModuleResult.Success -> {
                    _campaignEditorState.value = CampaignEditorState.Saved(result.data)
                }
                is ModuleResult.Error -> {
                    _errorState.value = result.message
                    _campaignEditorState.value = CampaignEditorState.Empty
                }
                ModuleResult.NotEnabled -> {
                    _errorState.value = "Module not enabled"
                }
            }
        }
    }

    /**
     * Updates an existing campaign.
     */
    fun updateCampaign(campaign: CampaignEntity) {
        viewModelScope.launch {
            _campaignEditorState.value = CampaignEditorState.Saving

            when (val result = newslettersUseCase.updateCampaign(campaign)) {
                is ModuleResult.Success -> {
                    _campaignEditorState.value = CampaignEditorState.Saved(result.data)
                }
                is ModuleResult.Error -> {
                    _errorState.value = result.message
                }
                ModuleResult.NotEnabled -> {
                    _errorState.value = "Module not enabled"
                }
            }
        }
    }

    /**
     * Loads a campaign for editing.
     */
    fun loadCampaignForEditing(campaignId: String) {
        viewModelScope.launch {
            val campaign = newslettersUseCase.getCampaign(campaignId)
            if (campaign != null) {
                _campaignEditorState.value = CampaignEditorState.Editing(campaign)
            } else {
                _errorState.value = "Campaign not found"
            }
        }
    }

    /**
     * Deletes a campaign.
     */
    fun deleteCampaign(campaignId: String) {
        viewModelScope.launch {
            when (val result = newslettersUseCase.deleteCampaign(campaignId)) {
                is ModuleResult.Success -> {
                    _campaignEditorState.value = CampaignEditorState.Empty
                }
                is ModuleResult.Error -> {
                    _errorState.value = result.message
                }
                ModuleResult.NotEnabled -> {
                    _errorState.value = "Module not enabled"
                }
            }
        }
    }

    /**
     * Schedules a campaign for later sending.
     */
    fun scheduleCampaign(campaignId: String, scheduledAt: Long) {
        viewModelScope.launch {
            when (val result = newslettersUseCase.scheduleCampaign(campaignId, scheduledAt)) {
                is ModuleResult.Success -> {
                    _campaignEditorState.value = CampaignEditorState.Saved(result.data)
                }
                is ModuleResult.Error -> {
                    _errorState.value = result.message
                }
                ModuleResult.NotEnabled -> {
                    _errorState.value = "Module not enabled"
                }
            }
        }
    }

    /**
     * Sends a campaign immediately.
     */
    fun sendCampaign(campaignId: String) {
        viewModelScope.launch {
            _deliveryProgressState.value = DeliveryProgressState.Starting

            when (val result = newslettersUseCase.sendCampaign(campaignId)) {
                is ModuleResult.Success -> {
                    _deliveryProgressState.value = DeliveryProgressState.Complete(result.data)
                }
                is ModuleResult.Error -> {
                    _deliveryProgressState.value = DeliveryProgressState.Error(result.message)
                    _errorState.value = result.message
                }
                ModuleResult.NotEnabled -> {
                    _deliveryProgressState.value = DeliveryProgressState.Error("Module not enabled")
                }
            }
        }
    }

    // ============== Issue History Operations ==============

    /**
     * Loads sent campaigns (issue history).
     */
    fun loadIssueHistory(newsletterId: String) {
        viewModelScope.launch {
            _issueHistoryState.value = IssueHistoryState.Loading

            newslettersUseCase.getIssueHistory(newsletterId).collect { campaigns ->
                _issueHistoryState.value = IssueHistoryState.Success(campaigns)
            }
        }
    }

    // ============== Subscriber Operations ==============

    /**
     * Loads subscribers for a newsletter.
     */
    fun loadSubscribers(newsletterId: String) {
        viewModelScope.launch {
            _subscribersState.value = SubscribersState.Loading

            newslettersUseCase.getSubscribers(newsletterId).collect { subscribers ->
                _subscribersState.value = SubscribersState.Success(
                    subscribers = subscribers,
                    newsletterId = newsletterId
                )
            }
        }
    }

    /**
     * Searches subscribers.
     */
    fun searchSubscribers(newsletterId: String, query: String) {
        viewModelScope.launch {
            if (query.isBlank()) {
                loadSubscribers(newsletterId)
                return@launch
            }

            newslettersUseCase.searchSubscribers(newsletterId, query).collect { subscribers ->
                _subscribersState.value = SubscribersState.Success(
                    subscribers = subscribers,
                    newsletterId = newsletterId,
                    searchQuery = query
                )
            }
        }
    }

    /**
     * Adds a subscriber.
     */
    fun addSubscriber(
        newsletterId: String,
        email: String,
        name: String? = null,
        pubkey: String? = null
    ) {
        viewModelScope.launch {
            when (val result = newslettersUseCase.addSubscriber(
                newsletterId = newsletterId,
                email = email,
                name = name,
                pubkey = pubkey
            )) {
                is ModuleResult.Success -> {
                    loadSubscribers(newsletterId)
                }
                is ModuleResult.Error -> {
                    _errorState.value = result.message
                }
                ModuleResult.NotEnabled -> {
                    _errorState.value = "Module not enabled"
                }
            }
        }
    }

    /**
     * Removes a subscriber.
     */
    fun removeSubscriber(subscriberId: String, newsletterId: String) {
        viewModelScope.launch {
            when (val result = newslettersUseCase.removeSubscriber(subscriberId)) {
                is ModuleResult.Success -> {
                    loadSubscribers(newsletterId)
                }
                is ModuleResult.Error -> {
                    _errorState.value = result.message
                }
                ModuleResult.NotEnabled -> {
                    _errorState.value = "Module not enabled"
                }
            }
        }
    }

    /**
     * Unsubscribes a subscriber.
     */
    fun unsubscribeSubscriber(subscriberId: String, newsletterId: String) {
        viewModelScope.launch {
            when (val result = newslettersUseCase.unsubscribe(subscriberId)) {
                is ModuleResult.Success -> {
                    loadSubscribers(newsletterId)
                }
                is ModuleResult.Error -> {
                    _errorState.value = result.message
                }
                ModuleResult.NotEnabled -> {
                    _errorState.value = "Module not enabled"
                }
            }
        }
    }

    /**
     * Imports subscribers from CSV.
     */
    fun importSubscribersFromCsv(newsletterId: String, inputStream: InputStream) {
        viewModelScope.launch {
            _subscribersState.value = when (val current = _subscribersState.value) {
                is SubscribersState.Success -> current.copy(isImporting = true)
                else -> SubscribersState.Loading
            }

            when (val result = newslettersUseCase.importSubscribersFromCsv(newsletterId, inputStream)) {
                is ModuleResult.Success -> {
                    val importResult = result.data
                    _subscribersState.value = when (val current = _subscribersState.value) {
                        is SubscribersState.Success -> current.copy(
                            isImporting = false,
                            lastImportResult = importResult
                        )
                        else -> SubscribersState.Loading
                    }
                    loadSubscribers(newsletterId)
                }
                is ModuleResult.Error -> {
                    _errorState.value = result.message
                    _subscribersState.value = when (val current = _subscribersState.value) {
                        is SubscribersState.Success -> current.copy(isImporting = false)
                        else -> SubscribersState.Error(result.message)
                    }
                }
                ModuleResult.NotEnabled -> {
                    _errorState.value = "Module not enabled"
                }
            }
        }
    }

    /**
     * Exports subscribers to CSV.
     */
    fun exportSubscribersToCsv(
        newsletterId: String,
        outputStream: OutputStream,
        includeUnsubscribed: Boolean = false
    ) {
        viewModelScope.launch {
            _subscribersState.value = when (val current = _subscribersState.value) {
                is SubscribersState.Success -> current.copy(isExporting = true)
                else -> SubscribersState.Loading
            }

            when (val result = newslettersUseCase.exportSubscribersToCsv(
                newsletterId,
                outputStream,
                includeUnsubscribed
            )) {
                is ModuleResult.Success -> {
                    _subscribersState.value = when (val current = _subscribersState.value) {
                        is SubscribersState.Success -> current.copy(
                            isExporting = false,
                            lastExportCount = result.data
                        )
                        else -> SubscribersState.Loading
                    }
                }
                is ModuleResult.Error -> {
                    _errorState.value = result.message
                    _subscribersState.value = when (val current = _subscribersState.value) {
                        is SubscribersState.Success -> current.copy(isExporting = false)
                        else -> SubscribersState.Error(result.message)
                    }
                }
                ModuleResult.NotEnabled -> {
                    _errorState.value = "Module not enabled"
                }
            }
        }
    }

    // ============== Utility ==============

    /**
     * Clears error state.
     */
    fun clearError() {
        _errorState.value = null
    }

    /**
     * Resets campaign editor state.
     */
    fun resetCampaignEditor() {
        _campaignEditorState.value = CampaignEditorState.Empty
    }

    /**
     * Resets delivery progress state.
     */
    fun resetDeliveryProgress() {
        _deliveryProgressState.value = DeliveryProgressState.Idle
    }
}

// ============== UI State Classes ==============

/**
 * State for newsletters list screen.
 */
sealed class NewslettersListState {
    data object Loading : NewslettersListState()
    data object Creating : NewslettersListState()
    data class Success(val newsletters: List<NewsletterEntity>) : NewslettersListState()
    data class Error(val message: String) : NewslettersListState()
}

/**
 * State for newsletter detail screen.
 */
sealed class NewsletterDetailState {
    data object Loading : NewsletterDetailState()
    data class Success(val newsletter: NewsletterEntity) : NewsletterDetailState()
    data class Error(val message: String) : NewsletterDetailState()
}

/**
 * State for campaign editor.
 */
sealed class CampaignEditorState {
    data object Empty : CampaignEditorState()
    data class Editing(val campaign: CampaignEntity) : CampaignEditorState()
    data object Saving : CampaignEditorState()
    data class Saved(val campaign: CampaignEntity) : CampaignEditorState()
}

/**
 * State for subscribers screen.
 */
sealed class SubscribersState {
    data object Loading : SubscribersState()
    data class Success(
        val subscribers: List<SubscriberEntity>,
        val newsletterId: String,
        val searchQuery: String? = null,
        val isImporting: Boolean = false,
        val isExporting: Boolean = false,
        val lastImportResult: ImportResult? = null,
        val lastExportCount: Int? = null
    ) : SubscribersState()
    data class Error(val message: String) : SubscribersState()
}

/**
 * State for issue history screen.
 */
sealed class IssueHistoryState {
    data object Loading : IssueHistoryState()
    data class Success(val campaigns: List<CampaignEntity>) : IssueHistoryState()
    data class Error(val message: String) : IssueHistoryState()
}

/**
 * State for delivery progress screen.
 */
sealed class DeliveryProgressState {
    data object Idle : DeliveryProgressState()
    data object Starting : DeliveryProgressState()
    data class Sending(val progress: SendingProgress) : DeliveryProgressState()
    data class Complete(val stats: DeliveryStats) : DeliveryProgressState()
    data class Error(val message: String) : DeliveryProgressState()
}
