package network.buildit.modules.wiki.data

import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.modules.wiki.data.local.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for wiki data operations.
 */
@Singleton
class WikiRepository @Inject constructor(
    private val pagesDao: WikiPagesDao,
    private val categoriesDao: WikiCategoriesDao,
    private val revisionsDao: PageRevisionsDao
) {
    private val json = Json { ignoreUnknownKeys = true }

    // MARK: - Pages

    fun getAllPages(): Flow<List<WikiPageEntity>> = pagesDao.getAllPages()

    fun getPublishedPages(): Flow<List<WikiPageEntity>> = pagesDao.getPublishedPages()

    fun getPublishedPagesByGroup(groupId: String): Flow<List<WikiPageEntity>> =
        pagesDao.getPublishedPagesByGroup(groupId)

    fun getPublishedPagesByCategory(categoryId: String): Flow<List<WikiPageEntity>> =
        pagesDao.getPublishedPagesByCategory(categoryId)

    fun getPublishedPagesByGroupAndCategory(groupId: String, categoryId: String): Flow<List<WikiPageEntity>> =
        pagesDao.getPublishedPagesByGroupAndCategory(groupId, categoryId)

    fun getRecentPages(limit: Int = 10): Flow<List<WikiPageEntity>> =
        pagesDao.getRecentPages(limit)

    fun observePage(id: String): Flow<WikiPageEntity?> = pagesDao.observePage(id)

    suspend fun getPageById(id: String): WikiPageEntity? = pagesDao.getPageById(id)

    suspend fun getPageBySlug(slug: String, groupId: String): WikiPageEntity? =
        pagesDao.getPageBySlug(slug, groupId)

    suspend fun searchPages(query: String, groupId: String? = null): List<WikiPageEntity> {
        return if (groupId != null) {
            pagesDao.searchPagesInGroup(query, groupId)
        } else {
            pagesDao.searchPages(query)
        }
    }

    suspend fun createPage(
        groupId: String,
        slug: String,
        title: String,
        content: String,
        summary: String? = null,
        categoryId: String? = null,
        status: PageStatus = PageStatus.DRAFT,
        visibility: PageVisibility = PageVisibility.GROUP,
        tags: List<String> = emptyList(),
        createdBy: String
    ): WikiPageEntity {
        val page = WikiPageEntity(
            id = java.util.UUID.randomUUID().toString(),
            groupId = groupId,
            slug = slug,
            title = title,
            content = content,
            summary = summary,
            version = 1,
            parentId = null,
            categoryId = categoryId,
            status = status,
            visibility = visibility,
            tagsJson = json.encodeToString(tags),
            createdBy = createdBy,
            lastEditedBy = null,
            contributorsJson = json.encodeToString(listOf(createdBy))
        )
        pagesDao.insertPage(page)

        // Update category page count
        categoryId?.let { updateCategoryPageCount(it) }

        return page
    }

    suspend fun updatePage(page: WikiPageEntity) {
        pagesDao.updatePage(page.copy(updatedAt = System.currentTimeMillis() / 1000))
    }

    suspend fun updatePageStatus(id: String, status: PageStatus) {
        pagesDao.updatePageStatus(id, status)
    }

    suspend fun deletePage(id: String) {
        val page = pagesDao.getPageById(id)
        pagesDao.deletePage(id)
        revisionsDao.deleteRevisionsByPage(id)

        // Update category page count
        page?.categoryId?.let { updateCategoryPageCount(it) }
    }

    fun getPublishedPageCount(): Flow<Int> = pagesDao.getPublishedPageCount()

    private suspend fun updateCategoryPageCount(categoryId: String) {
        val count = pagesDao.getPageCountByCategory(categoryId)
        categoriesDao.updatePageCount(categoryId, count)
    }

    // MARK: - Categories

    fun getAllCategories(): Flow<List<WikiCategoryEntity>> = categoriesDao.getAllCategories()

    fun getCategoriesByGroup(groupId: String): Flow<List<WikiCategoryEntity>> =
        categoriesDao.getCategoriesByGroup(groupId)

    suspend fun getCategoryById(id: String): WikiCategoryEntity? = categoriesDao.getCategoryById(id)

    suspend fun createCategory(
        groupId: String,
        name: String,
        slug: String,
        description: String? = null,
        icon: String? = null,
        color: String? = null,
        order: Int = 0,
        createdBy: String
    ): WikiCategoryEntity {
        val category = WikiCategoryEntity(
            id = java.util.UUID.randomUUID().toString(),
            groupId = groupId,
            name = name,
            slug = slug,
            description = description,
            parentId = null,
            icon = icon,
            color = color,
            order = order,
            pageCount = 0,
            createdBy = createdBy
        )
        categoriesDao.insertCategory(category)
        return category
    }

    suspend fun updateCategory(category: WikiCategoryEntity) {
        categoriesDao.updateCategory(category.copy(updatedAt = System.currentTimeMillis() / 1000))
    }

    suspend fun deleteCategory(id: String) {
        categoriesDao.deleteCategory(id)
    }

    // MARK: - Revisions

    fun getRevisionsByPage(pageId: String): Flow<List<PageRevisionEntity>> =
        revisionsDao.getRevisionsByPage(pageId)

    suspend fun getRevisionById(id: String): PageRevisionEntity? = revisionsDao.getRevisionById(id)

    suspend fun getRevisionByVersion(pageId: String, version: Int): PageRevisionEntity? =
        revisionsDao.getRevisionByVersion(pageId, version)

    suspend fun createRevision(
        pageId: String,
        title: String,
        content: String,
        summary: String? = null,
        diff: String? = null,
        editedBy: String,
        editType: EditType = EditType.EDIT,
        revertedFrom: Int? = null
    ): PageRevisionEntity {
        val latestVersion = revisionsDao.getLatestVersionNumber(pageId) ?: 0
        val newVersion = latestVersion + 1

        val revision = PageRevisionEntity(
            id = java.util.UUID.randomUUID().toString(),
            pageId = pageId,
            version = newVersion,
            title = title,
            content = content,
            summary = summary,
            diff = diff,
            editedBy = editedBy,
            editType = editType,
            revertedFrom = revertedFrom
        )
        revisionsDao.insertRevision(revision)
        return revision
    }

    // MARK: - Batch Operations

    suspend fun insertPagesFromNostr(pages: List<WikiPageEntity>) {
        pagesDao.insertPages(pages)
    }

    suspend fun insertCategoriesFromNostr(categories: List<WikiCategoryEntity>) {
        categoriesDao.insertCategories(categories)
    }
}
