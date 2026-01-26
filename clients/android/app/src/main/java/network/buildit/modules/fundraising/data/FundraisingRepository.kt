package network.buildit.modules.fundraising.data

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import network.buildit.modules.fundraising.data.local.CampaignEntity
import network.buildit.modules.fundraising.data.local.CampaignStatus
import network.buildit.modules.fundraising.data.local.CampaignsDao
import network.buildit.modules.fundraising.data.local.DonationEntity
import network.buildit.modules.fundraising.data.local.DonationStatus
import network.buildit.modules.fundraising.data.local.DonationsDao
import network.buildit.modules.fundraising.data.local.ExpenseEntity
import network.buildit.modules.fundraising.data.local.ExpensesDao
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for fundraising data.
 *
 * Provides a clean API for accessing campaigns, donations, and expenses from local storage.
 * Handles data synchronization and caching.
 */
@Singleton
class FundraisingRepository @Inject constructor(
    private val campaignsDao: CampaignsDao,
    private val donationsDao: DonationsDao,
    private val expensesDao: ExpensesDao
) {
    // ============== Campaign Methods ==============

    /**
     * Gets all campaigns for a specific group.
     */
    fun getCampaignsByGroup(groupId: String): Flow<List<CampaignEntity>> {
        return campaignsDao.getCampaignsByGroup(groupId)
    }

    /**
     * Gets all public campaigns.
     */
    fun getPublicCampaigns(): Flow<List<CampaignEntity>> {
        return campaignsDao.getPublicCampaigns()
    }

    /**
     * Gets campaigns by status.
     */
    fun getCampaignsByStatus(status: CampaignStatus): Flow<List<CampaignEntity>> {
        return campaignsDao.getCampaignsByStatus(status)
    }

    /**
     * Gets campaigns created by a specific user.
     */
    fun getCampaignsByCreator(pubkey: String): Flow<List<CampaignEntity>> {
        return campaignsDao.getCampaignsByCreator(pubkey)
    }

    /**
     * Gets a specific campaign by ID.
     */
    suspend fun getCampaign(id: String): CampaignEntity? {
        return campaignsDao.getCampaign(id)
    }

    /**
     * Observes a specific campaign.
     */
    fun observeCampaign(id: String): Flow<CampaignEntity?> {
        return campaignsDao.observeCampaign(id)
    }

    /**
     * Gets all active campaigns.
     */
    fun getActiveCampaigns(): Flow<List<CampaignEntity>> {
        return campaignsDao.getActiveCampaigns()
    }

    /**
     * Gets active campaigns for a specific group.
     */
    fun getActiveCampaignsByGroup(groupId: String): Flow<List<CampaignEntity>> {
        return campaignsDao.getActiveCampaignsByGroup(groupId)
    }

    /**
     * Searches campaigns by title or description.
     */
    fun searchCampaigns(groupId: String?, query: String): Flow<List<CampaignEntity>> {
        return campaignsDao.searchCampaigns(groupId, query)
    }

    /**
     * Saves a campaign to local storage.
     */
    suspend fun saveCampaign(campaign: CampaignEntity) {
        campaignsDao.insertCampaign(campaign)
    }

    /**
     * Updates an existing campaign.
     */
    suspend fun updateCampaign(campaign: CampaignEntity) {
        campaignsDao.updateCampaign(campaign)
    }

    /**
     * Deletes a campaign.
     */
    suspend fun deleteCampaign(campaignId: String) {
        campaignsDao.deleteCampaignById(campaignId)
    }

    /**
     * Updates campaign status.
     */
    suspend fun updateCampaignStatus(campaignId: String, status: CampaignStatus) {
        campaignsDao.updateStatus(campaignId, status)
    }

    /**
     * Adds a donation amount to a campaign.
     */
    suspend fun addDonationToCampaign(campaignId: String, amount: Double) {
        campaignsDao.addDonation(campaignId, amount)
    }

    /**
     * Gets count of active campaigns for a group.
     */
    suspend fun getActiveCampaignCount(groupId: String): Int {
        return campaignsDao.getActiveCampaignCount(groupId)
    }

    /**
     * Gets total raised amount for a group.
     */
    suspend fun getTotalRaised(groupId: String): Double {
        return campaignsDao.getTotalRaised(groupId) ?: 0.0
    }

    /**
     * Gets total donor count for a group.
     */
    suspend fun getTotalDonorCount(groupId: String): Int {
        return campaignsDao.getTotalDonorCount(groupId) ?: 0
    }

    // ============== Donation Methods ==============

    /**
     * Gets all donations for a campaign.
     */
    fun getDonationsForCampaign(campaignId: String): Flow<List<DonationEntity>> {
        return donationsDao.getDonationsForCampaign(campaignId)
    }

    /**
     * Gets completed donations for a campaign.
     */
    fun getCompletedDonationsForCampaign(campaignId: String): Flow<List<DonationEntity>> {
        return donationsDao.getCompletedDonationsForCampaign(campaignId)
    }

    /**
     * Gets donations by a specific donor.
     */
    fun getDonationsByDonor(pubkey: String): Flow<List<DonationEntity>> {
        return donationsDao.getDonationsByDonor(pubkey)
    }

    /**
     * Gets a specific donation.
     */
    suspend fun getDonation(id: String): DonationEntity? {
        return donationsDao.getDonation(id)
    }

    /**
     * Observes a specific donation.
     */
    fun observeDonation(id: String): Flow<DonationEntity?> {
        return donationsDao.observeDonation(id)
    }

    /**
     * Gets top donations for a campaign.
     */
    fun getTopDonations(campaignId: String, limit: Int = 10): Flow<List<DonationEntity>> {
        return donationsDao.getTopDonations(campaignId, limit)
    }

    /**
     * Gets recent donations for a campaign.
     */
    fun getRecentDonations(campaignId: String, since: Long): Flow<List<DonationEntity>> {
        return donationsDao.getRecentDonations(campaignId, since)
    }

    /**
     * Saves a donation to local storage.
     */
    suspend fun saveDonation(donation: DonationEntity) {
        donationsDao.insertDonation(donation)
    }

    /**
     * Updates a donation.
     */
    suspend fun updateDonation(donation: DonationEntity) {
        donationsDao.updateDonation(donation)
    }

    /**
     * Deletes a donation.
     */
    suspend fun deleteDonation(donationId: String) {
        donationsDao.deleteDonationById(donationId)
    }

    /**
     * Updates donation status.
     */
    suspend fun updateDonationStatus(donationId: String, status: DonationStatus) {
        donationsDao.updateStatus(donationId, status)
    }

    /**
     * Gets donation count for a campaign.
     */
    suspend fun getDonationCount(campaignId: String): Int {
        return donationsDao.getDonationCount(campaignId)
    }

    /**
     * Gets total donations for a campaign.
     */
    suspend fun getTotalDonations(campaignId: String): Double {
        return donationsDao.getTotalDonations(campaignId) ?: 0.0
    }

    /**
     * Gets average donation for a campaign.
     */
    suspend fun getAverageDonation(campaignId: String): Double {
        return donationsDao.getAverageDonation(campaignId) ?: 0.0
    }

    // ============== Expense Methods ==============

    /**
     * Gets all expenses for a campaign.
     */
    fun getExpensesForCampaign(campaignId: String): Flow<List<ExpenseEntity>> {
        return expensesDao.getExpensesForCampaign(campaignId)
    }

    /**
     * Gets expenses recorded by a specific user.
     */
    fun getExpensesByRecorder(pubkey: String): Flow<List<ExpenseEntity>> {
        return expensesDao.getExpensesByRecorder(pubkey)
    }

    /**
     * Gets a specific expense.
     */
    suspend fun getExpense(id: String): ExpenseEntity? {
        return expensesDao.getExpense(id)
    }

    /**
     * Gets expenses by category for a campaign.
     */
    fun getExpensesByCategory(campaignId: String, category: String): Flow<List<ExpenseEntity>> {
        return expensesDao.getExpensesByCategory(campaignId, category)
    }

    /**
     * Saves an expense to local storage.
     */
    suspend fun saveExpense(expense: ExpenseEntity) {
        expensesDao.insertExpense(expense)
    }

    /**
     * Updates an expense.
     */
    suspend fun updateExpense(expense: ExpenseEntity) {
        expensesDao.updateExpense(expense)
    }

    /**
     * Deletes an expense.
     */
    suspend fun deleteExpense(expenseId: String) {
        expensesDao.deleteExpenseById(expenseId)
    }

    /**
     * Gets total expenses for a campaign.
     */
    suspend fun getTotalExpenses(campaignId: String): Double {
        return expensesDao.getTotalExpenses(campaignId) ?: 0.0
    }

    /**
     * Gets total expenses by category for a campaign.
     */
    suspend fun getTotalExpensesByCategory(campaignId: String, category: String): Double {
        return expensesDao.getTotalExpensesByCategory(campaignId, category) ?: 0.0
    }

    /**
     * Gets expense categories for a campaign.
     */
    suspend fun getExpenseCategories(campaignId: String): List<String> {
        return expensesDao.getExpenseCategories(campaignId)
    }

    // ============== Sync Methods ==============

    /**
     * Syncs campaigns from remote source.
     */
    suspend fun syncCampaigns(campaigns: List<CampaignEntity>) {
        campaignsDao.insertCampaigns(campaigns)
    }

    /**
     * Syncs donations from remote source.
     */
    suspend fun syncDonations(donations: List<DonationEntity>) {
        donationsDao.insertDonations(donations)
    }

    /**
     * Syncs expenses from remote source.
     */
    suspend fun syncExpenses(expenses: List<ExpenseEntity>) {
        expensesDao.insertExpenses(expenses)
    }

    /**
     * Gets campaigns with their donation stats.
     */
    fun getCampaignsWithStats(groupId: String): Flow<List<CampaignWithStats>> {
        return getCampaignsByGroup(groupId).map { campaigns ->
            campaigns.map { campaign ->
                val donationCount = getDonationCount(campaign.id)
                val totalDonations = getTotalDonations(campaign.id)
                val totalExpenses = getTotalExpenses(campaign.id)
                CampaignWithStats(
                    campaign = campaign,
                    actualDonationCount = donationCount,
                    actualTotalRaised = totalDonations,
                    totalExpenses = totalExpenses,
                    netAmount = totalDonations - totalExpenses
                )
            }
        }
    }
}

/**
 * Campaign with computed statistics.
 */
data class CampaignWithStats(
    val campaign: CampaignEntity,
    val actualDonationCount: Int,
    val actualTotalRaised: Double,
    val totalExpenses: Double,
    val netAmount: Double
)
