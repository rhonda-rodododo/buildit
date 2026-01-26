package network.buildit.modules.governance

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.HowToVote
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.IntoSet
import network.buildit.core.modules.BuildItModule
import network.buildit.core.modules.ModuleRoute
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrEvent
import network.buildit.core.nostr.NostrFilter
import network.buildit.core.storage.BuildItDatabase
import network.buildit.modules.governance.data.local.*
import network.buildit.modules.governance.domain.GovernanceUseCase
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Governance module for BuildIt.
 *
 * Provides proposal creation, voting, and decision-making functionality.
 */
class GovernanceModuleImpl @Inject constructor(
    private val useCase: GovernanceUseCase,
    private val nostrClient: NostrClient
) : BuildItModule {
    override val identifier: String = "governance"
    override val version: String = "1.0.0"
    override val displayName: String = "Governance"
    override val description: String = "Proposals, voting, and decision-making"

    private var subscriptionId: String? = null

    override suspend fun initialize() {
        // Subscribe to governance events
        subscriptionId = nostrClient.subscribe(
            NostrFilter(
                kinds = getHandledEventKinds(),
                since = System.currentTimeMillis() / 1000 - 86400 * 30 // Last 30 days
            )
        )
    }

    override suspend fun shutdown() {
        subscriptionId?.let { nostrClient.unsubscribe(it) }
    }

    override suspend fun handleEvent(event: NostrEvent): Boolean {
        return when (event.kind) {
            GovernanceUseCase.KIND_PROPOSAL -> {
                handleProposalEvent(event)
                true
            }
            GovernanceUseCase.KIND_VOTE -> {
                handleVoteEvent(event)
                true
            }
            GovernanceUseCase.KIND_DELEGATION -> {
                handleDelegationEvent(event)
                true
            }
            GovernanceUseCase.KIND_RESULT -> {
                handleResultEvent(event)
                true
            }
            NostrClient.KIND_DELETE -> {
                handleDeletion(event)
                true
            }
            else -> false
        }
    }

    override fun getNavigationRoutes(): List<ModuleRoute> {
        return listOf(
            ModuleRoute(
                route = "governance",
                title = "Governance",
                icon = Icons.Default.HowToVote,
                showInNavigation = true,
                content = { _ ->
                    // GovernanceScreen()
                }
            ),
            ModuleRoute(
                route = "governance/proposal/{proposalId}",
                title = "Proposal Details",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    val proposalId = args["proposalId"] ?: return@ModuleRoute
                    // ProposalDetailScreen(proposalId = proposalId)
                }
            ),
            ModuleRoute(
                route = "governance/create-proposal",
                title = "New Proposal",
                icon = null,
                showInNavigation = false,
                content = { _ ->
                    // CreateProposalScreen()
                }
            )
        )
    }

    override fun getHandledEventKinds(): List<Int> {
        return listOf(
            GovernanceUseCase.KIND_PROPOSAL,
            GovernanceUseCase.KIND_VOTE,
            GovernanceUseCase.KIND_DELEGATION,
            GovernanceUseCase.KIND_RESULT,
            NostrClient.KIND_DELETE
        )
    }

    private suspend fun handleProposalEvent(nostrEvent: NostrEvent) {
        try {
            android.util.Log.d("GovernanceModule", "Received proposal event: ${nostrEvent.id}")
        } catch (e: Exception) {
            android.util.Log.e("GovernanceModule", "Failed to handle proposal event", e)
        }
    }

    private suspend fun handleVoteEvent(nostrEvent: NostrEvent) {
        try {
            android.util.Log.d("GovernanceModule", "Received vote event: ${nostrEvent.id}")
        } catch (e: Exception) {
            android.util.Log.e("GovernanceModule", "Failed to handle vote event", e)
        }
    }

    private suspend fun handleDelegationEvent(nostrEvent: NostrEvent) {
        try {
            android.util.Log.d("GovernanceModule", "Received delegation event: ${nostrEvent.id}")
        } catch (e: Exception) {
            android.util.Log.e("GovernanceModule", "Failed to handle delegation event", e)
        }
    }

    private suspend fun handleResultEvent(nostrEvent: NostrEvent) {
        try {
            android.util.Log.d("GovernanceModule", "Received result event: ${nostrEvent.id}")
        } catch (e: Exception) {
            android.util.Log.e("GovernanceModule", "Failed to handle result event", e)
        }
    }

    private suspend fun handleDeletion(nostrEvent: NostrEvent) {
        try {
            val eventIds = nostrEvent.tags.filter { it.firstOrNull() == "e" }
                .mapNotNull { it.getOrNull(1) }

            android.util.Log.d("GovernanceModule", "Received deletion for: $eventIds")
        } catch (e: Exception) {
            android.util.Log.e("GovernanceModule", "Failed to handle deletion", e)
        }
    }
}

/**
 * Hilt module for Governance dependencies.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class GovernanceHiltModule {
    @Binds
    @IntoSet
    abstract fun bindGovernanceModule(impl: GovernanceModuleImpl): BuildItModule
}

/**
 * Provides DAOs for Governance module.
 */
@Module
@InstallIn(SingletonComponent::class)
object GovernanceDaoModule {
    @Provides
    @Singleton
    fun provideProposalsDao(database: BuildItDatabase): ProposalsDao {
        return database.proposalsDao()
    }

    @Provides
    @Singleton
    fun provideVotesDao(database: BuildItDatabase): VotesDao {
        return database.votesDao()
    }

    @Provides
    @Singleton
    fun provideDelegationsDao(database: BuildItDatabase): DelegationsDao {
        return database.delegationsDao()
    }

    @Provides
    @Singleton
    fun provideProposalResultsDao(database: BuildItDatabase): ProposalResultsDao {
        return database.proposalResultsDao()
    }
}
