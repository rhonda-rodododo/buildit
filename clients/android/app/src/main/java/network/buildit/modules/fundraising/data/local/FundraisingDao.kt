package network.buildit.modules.fundraising.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

/**
 * Data Access Object for campaigns.
 */
@Dao
interface CampaignsDao {
    @Query("SELECT * FROM campaigns WHERE groupId = :groupId ORDER BY createdAt DESC")
    fun getCampaignsByGroup(groupId: String): Flow<List<CampaignEntity>>

    @Query("SELECT * FROM campaigns WHERE groupId IS NULL OR visibility = 'public' ORDER BY createdAt DESC")
    fun getPublicCampaigns(): Flow<List<CampaignEntity>>

    @Query("SELECT * FROM campaigns WHERE status = :status ORDER BY createdAt DESC")
    fun getCampaignsByStatus(status: CampaignStatus): Flow<List<CampaignEntity>>

    @Query("SELECT * FROM campaigns WHERE createdBy = :pubkey ORDER BY createdAt DESC")
    fun getCampaignsByCreator(pubkey: String): Flow<List<CampaignEntity>>

    @Query("SELECT * FROM campaigns WHERE id = :id")
    suspend fun getCampaign(id: String): CampaignEntity?

    @Query("SELECT * FROM campaigns WHERE id = :id")
    fun observeCampaign(id: String): Flow<CampaignEntity?>

    @Query("SELECT * FROM campaigns WHERE status = 'active' AND (endsAt IS NULL OR endsAt > :currentTime) ORDER BY createdAt DESC")
    fun getActiveCampaigns(currentTime: Long = System.currentTimeMillis() / 1000): Flow<List<CampaignEntity>>

    @Query("SELECT * FROM campaigns WHERE groupId = :groupId AND status = 'active' ORDER BY createdAt DESC")
    fun getActiveCampaignsByGroup(groupId: String): Flow<List<CampaignEntity>>

    @Query("""
        SELECT * FROM campaigns
        WHERE (groupId = :groupId OR visibility = 'public')
        AND (title LIKE '%' || :query || '%' OR description LIKE '%' || :query || '%')
        ORDER BY createdAt DESC
    """)
    fun searchCampaigns(groupId: String?, query: String): Flow<List<CampaignEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCampaign(campaign: CampaignEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCampaigns(campaigns: List<CampaignEntity>)

    @Update
    suspend fun updateCampaign(campaign: CampaignEntity)

    @Delete
    suspend fun deleteCampaign(campaign: CampaignEntity)

    @Query("DELETE FROM campaigns WHERE id = :id")
    suspend fun deleteCampaignById(id: String)

    @Query("UPDATE campaigns SET raised = raised + :amount, donorCount = donorCount + 1, updatedAt = :updatedAt WHERE id = :campaignId")
    suspend fun addDonation(campaignId: String, amount: Double, updatedAt: Long = System.currentTimeMillis() / 1000)

    @Query("UPDATE campaigns SET status = :status, updatedAt = :updatedAt WHERE id = :campaignId")
    suspend fun updateStatus(campaignId: String, status: CampaignStatus, updatedAt: Long = System.currentTimeMillis() / 1000)

    @Query("SELECT COUNT(*) FROM campaigns WHERE groupId = :groupId AND status = 'active'")
    suspend fun getActiveCampaignCount(groupId: String): Int

    @Query("SELECT SUM(raised) FROM campaigns WHERE groupId = :groupId")
    suspend fun getTotalRaised(groupId: String): Double?

    @Query("SELECT SUM(donorCount) FROM campaigns WHERE groupId = :groupId")
    suspend fun getTotalDonorCount(groupId: String): Int?
}

/**
 * Data Access Object for donations.
 */
@Dao
interface DonationsDao {
    @Query("SELECT * FROM donations WHERE campaignId = :campaignId ORDER BY donatedAt DESC")
    fun getDonationsForCampaign(campaignId: String): Flow<List<DonationEntity>>

    @Query("SELECT * FROM donations WHERE campaignId = :campaignId AND status = 'completed' ORDER BY donatedAt DESC")
    fun getCompletedDonationsForCampaign(campaignId: String): Flow<List<DonationEntity>>

    @Query("SELECT * FROM donations WHERE donorPubkey = :pubkey ORDER BY donatedAt DESC")
    fun getDonationsByDonor(pubkey: String): Flow<List<DonationEntity>>

    @Query("SELECT * FROM donations WHERE id = :id")
    suspend fun getDonation(id: String): DonationEntity?

    @Query("SELECT * FROM donations WHERE id = :id")
    fun observeDonation(id: String): Flow<DonationEntity?>

    @Query("SELECT * FROM donations WHERE campaignId = :campaignId ORDER BY amount DESC LIMIT :limit")
    fun getTopDonations(campaignId: String, limit: Int = 10): Flow<List<DonationEntity>>

    @Query("SELECT * FROM donations WHERE campaignId = :campaignId AND donatedAt > :since ORDER BY donatedAt DESC")
    fun getRecentDonations(campaignId: String, since: Long): Flow<List<DonationEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDonation(donation: DonationEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDonations(donations: List<DonationEntity>)

    @Update
    suspend fun updateDonation(donation: DonationEntity)

    @Delete
    suspend fun deleteDonation(donation: DonationEntity)

    @Query("DELETE FROM donations WHERE id = :id")
    suspend fun deleteDonationById(id: String)

    @Query("UPDATE donations SET status = :status WHERE id = :donationId")
    suspend fun updateStatus(donationId: String, status: DonationStatus)

    @Query("SELECT COUNT(*) FROM donations WHERE campaignId = :campaignId AND status = 'completed'")
    suspend fun getDonationCount(campaignId: String): Int

    @Query("SELECT SUM(amount) FROM donations WHERE campaignId = :campaignId AND status = 'completed'")
    suspend fun getTotalDonations(campaignId: String): Double?

    @Query("SELECT AVG(amount) FROM donations WHERE campaignId = :campaignId AND status = 'completed'")
    suspend fun getAverageDonation(campaignId: String): Double?
}

/**
 * Data Access Object for expenses.
 */
@Dao
interface ExpensesDao {
    @Query("SELECT * FROM campaign_expenses WHERE campaignId = :campaignId ORDER BY recordedAt DESC")
    fun getExpensesForCampaign(campaignId: String): Flow<List<ExpenseEntity>>

    @Query("SELECT * FROM campaign_expenses WHERE recordedBy = :pubkey ORDER BY recordedAt DESC")
    fun getExpensesByRecorder(pubkey: String): Flow<List<ExpenseEntity>>

    @Query("SELECT * FROM campaign_expenses WHERE id = :id")
    suspend fun getExpense(id: String): ExpenseEntity?

    @Query("SELECT * FROM campaign_expenses WHERE campaignId = :campaignId AND category = :category ORDER BY recordedAt DESC")
    fun getExpensesByCategory(campaignId: String, category: String): Flow<List<ExpenseEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExpense(expense: ExpenseEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExpenses(expenses: List<ExpenseEntity>)

    @Update
    suspend fun updateExpense(expense: ExpenseEntity)

    @Delete
    suspend fun deleteExpense(expense: ExpenseEntity)

    @Query("DELETE FROM campaign_expenses WHERE id = :id")
    suspend fun deleteExpenseById(id: String)

    @Query("SELECT SUM(amount) FROM campaign_expenses WHERE campaignId = :campaignId")
    suspend fun getTotalExpenses(campaignId: String): Double?

    @Query("SELECT SUM(amount) FROM campaign_expenses WHERE campaignId = :campaignId AND category = :category")
    suspend fun getTotalExpensesByCategory(campaignId: String, category: String): Double?

    @Query("SELECT DISTINCT category FROM campaign_expenses WHERE campaignId = :campaignId AND category IS NOT NULL")
    suspend fun getExpenseCategories(campaignId: String): List<String>
}
