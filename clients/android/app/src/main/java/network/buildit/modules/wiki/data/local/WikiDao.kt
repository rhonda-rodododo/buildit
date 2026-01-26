package network.buildit.modules.wiki.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

/**
 * DAO for wiki page operations.
 */
@Dao
interface WikiPagesDao {
    @Query("SELECT * FROM wiki_pages ORDER BY title ASC")
    fun getAllPages(): Flow<List<WikiPageEntity>>

    @Query("SELECT * FROM wiki_pages WHERE groupId = :groupId ORDER BY title ASC")
    fun getPagesByGroup(groupId: String): Flow<List<WikiPageEntity>>

    @Query("SELECT * FROM wiki_pages WHERE status = 'PUBLISHED' ORDER BY title ASC")
    fun getPublishedPages(): Flow<List<WikiPageEntity>>

    @Query("SELECT * FROM wiki_pages WHERE status = 'PUBLISHED' AND groupId = :groupId ORDER BY title ASC")
    fun getPublishedPagesByGroup(groupId: String): Flow<List<WikiPageEntity>>

    @Query("SELECT * FROM wiki_pages WHERE status = 'PUBLISHED' AND categoryId = :categoryId ORDER BY title ASC")
    fun getPublishedPagesByCategory(categoryId: String): Flow<List<WikiPageEntity>>

    @Query("SELECT * FROM wiki_pages WHERE status = 'PUBLISHED' AND groupId = :groupId AND categoryId = :categoryId ORDER BY title ASC")
    fun getPublishedPagesByGroupAndCategory(groupId: String, categoryId: String): Flow<List<WikiPageEntity>>

    @Query("SELECT * FROM wiki_pages WHERE status = 'PUBLISHED' ORDER BY updatedAt DESC LIMIT :limit")
    fun getRecentPages(limit: Int): Flow<List<WikiPageEntity>>

    @Query("SELECT * FROM wiki_pages WHERE id = :id")
    fun observePage(id: String): Flow<WikiPageEntity?>

    @Query("SELECT * FROM wiki_pages WHERE id = :id")
    suspend fun getPageById(id: String): WikiPageEntity?

    @Query("SELECT * FROM wiki_pages WHERE slug = :slug AND groupId = :groupId")
    suspend fun getPageBySlug(slug: String, groupId: String): WikiPageEntity?

    @Query("SELECT * FROM wiki_pages WHERE status = 'PUBLISHED' AND (title LIKE '%' || :query || '%' OR content LIKE '%' || :query || '%' OR summary LIKE '%' || :query || '%')")
    suspend fun searchPages(query: String): List<WikiPageEntity>

    @Query("SELECT * FROM wiki_pages WHERE status = 'PUBLISHED' AND groupId = :groupId AND (title LIKE '%' || :query || '%' OR content LIKE '%' || :query || '%' OR summary LIKE '%' || :query || '%')")
    suspend fun searchPagesInGroup(query: String, groupId: String): List<WikiPageEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPage(page: WikiPageEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPages(pages: List<WikiPageEntity>)

    @Update
    suspend fun updatePage(page: WikiPageEntity)

    @Query("UPDATE wiki_pages SET status = :status, updatedAt = :updatedAt WHERE id = :id")
    suspend fun updatePageStatus(id: String, status: PageStatus, updatedAt: Long = System.currentTimeMillis())

    @Query("DELETE FROM wiki_pages WHERE id = :id")
    suspend fun deletePage(id: String)

    @Query("SELECT COUNT(*) FROM wiki_pages WHERE status = 'PUBLISHED'")
    fun getPublishedPageCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM wiki_pages WHERE categoryId = :categoryId AND status = 'PUBLISHED'")
    suspend fun getPageCountByCategory(categoryId: String): Int
}

/**
 * DAO for wiki category operations.
 */
@Dao
interface WikiCategoriesDao {
    @Query("SELECT * FROM wiki_categories ORDER BY `order` ASC, name ASC")
    fun getAllCategories(): Flow<List<WikiCategoryEntity>>

    @Query("SELECT * FROM wiki_categories WHERE groupId = :groupId ORDER BY `order` ASC, name ASC")
    fun getCategoriesByGroup(groupId: String): Flow<List<WikiCategoryEntity>>

    @Query("SELECT * FROM wiki_categories WHERE id = :id")
    suspend fun getCategoryById(id: String): WikiCategoryEntity?

    @Query("SELECT * FROM wiki_categories WHERE slug = :slug AND groupId = :groupId")
    suspend fun getCategoryBySlug(slug: String, groupId: String): WikiCategoryEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCategory(category: WikiCategoryEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCategories(categories: List<WikiCategoryEntity>)

    @Update
    suspend fun updateCategory(category: WikiCategoryEntity)

    @Query("UPDATE wiki_categories SET pageCount = :count, updatedAt = :updatedAt WHERE id = :id")
    suspend fun updatePageCount(id: String, count: Int, updatedAt: Long = System.currentTimeMillis())

    @Query("DELETE FROM wiki_categories WHERE id = :id")
    suspend fun deleteCategory(id: String)
}

/**
 * DAO for page revision operations.
 */
@Dao
interface PageRevisionsDao {
    @Query("SELECT * FROM page_revisions WHERE pageId = :pageId ORDER BY version DESC")
    fun getRevisionsByPage(pageId: String): Flow<List<PageRevisionEntity>>

    @Query("SELECT * FROM page_revisions WHERE id = :id")
    suspend fun getRevisionById(id: String): PageRevisionEntity?

    @Query("SELECT * FROM page_revisions WHERE pageId = :pageId AND version = :version")
    suspend fun getRevisionByVersion(pageId: String, version: Int): PageRevisionEntity?

    @Query("SELECT MAX(version) FROM page_revisions WHERE pageId = :pageId")
    suspend fun getLatestVersionNumber(pageId: String): Int?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRevision(revision: PageRevisionEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRevisions(revisions: List<PageRevisionEntity>)

    @Query("DELETE FROM page_revisions WHERE pageId = :pageId")
    suspend fun deleteRevisionsByPage(pageId: String)
}
