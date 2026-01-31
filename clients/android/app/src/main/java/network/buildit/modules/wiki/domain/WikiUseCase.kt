package network.buildit.modules.wiki.domain

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.nostr.NostrClient
import network.buildit.modules.wiki.data.WikiRepository
import network.buildit.modules.wiki.data.local.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Use case for wiki business logic.
 */
@Singleton
class WikiUseCase @Inject constructor(
    private val repository: WikiRepository,
    private val nostrClient: NostrClient,
    private val cryptoManager: CryptoManager
) {
    companion object {
        const val KIND_WIKI_PAGE = 40301
        const val KIND_WIKI_CATEGORY = 40302
        const val KIND_PAGE_REVISION = 40303
    }

    // Current user ID
    private val currentUserId: String
        get() = cryptoManager.getPublicKeyHex() ?: ""

    // MARK: - Pages

    fun getPublishedPages(): Flow<List<WikiPageEntity>> = repository.getPublishedPages()

    fun getPublishedPagesByGroup(groupId: String): Flow<List<WikiPageEntity>> =
        repository.getPublishedPagesByGroup(groupId)

    fun getPublishedPagesByCategory(categoryId: String): Flow<List<WikiPageEntity>> =
        repository.getPublishedPagesByCategory(categoryId)

    fun getRecentPages(limit: Int = 10): Flow<List<WikiPageEntity>> = repository.getRecentPages(limit)

    fun observePage(id: String): Flow<WikiPageEntity?> = repository.observePage(id)

    suspend fun getPageById(id: String): WikiPageEntity? = repository.getPageById(id)

    suspend fun getPageBySlug(slug: String, groupId: String): WikiPageEntity? =
        repository.getPageBySlug(slug, groupId)

    suspend fun searchPages(query: String, groupId: String? = null): List<WikiSearchResult> {
        val pages = repository.searchPages(query, groupId)
        val lowercaseQuery = query.lowercase()

        return pages.map { page ->
            // Create excerpt from content containing the query
            val excerpt = createExcerpt(page.content, lowercaseQuery)

            // Simple scoring based on where match is found
            var score = 0.0
            if (page.title.lowercase().contains(lowercaseQuery)) score += 10.0
            if (page.summary?.lowercase()?.contains(lowercaseQuery) == true) score += 5.0
            if (page.content.lowercase().contains(lowercaseQuery)) score += 1.0

            val matchedTags = page.tags.filter { it.lowercase().contains(lowercaseQuery) }
            score += matchedTags.size * 3.0

            WikiSearchResult(
                pageId = page.id,
                title = page.title,
                slug = page.slug,
                summary = page.summary,
                excerpt = excerpt,
                score = score,
                matchedTags = matchedTags,
                categoryName = null, // Would need to look up category
                updatedAt = page.updatedAt
            )
        }.sortedByDescending { it.score }
    }

    private fun createExcerpt(content: String, query: String, contextLength: Int = 100): String? {
        val lowercaseContent = content.lowercase()
        val index = lowercaseContent.indexOf(query)
        if (index == -1) return null

        val startIndex = maxOf(0, index - contextLength)
        val endIndex = minOf(content.length, index + query.length + contextLength)

        var excerpt = content.substring(startIndex, endIndex)
        if (startIndex > 0) excerpt = "...$excerpt"
        if (endIndex < content.length) excerpt = "$excerpt..."

        return excerpt
    }

    // MARK: - Categories

    fun getCategoriesByGroup(groupId: String): Flow<List<WikiCategoryEntity>> =
        repository.getCategoriesByGroup(groupId)

    suspend fun getCategoryById(id: String): WikiCategoryEntity? = repository.getCategoryById(id)

    // MARK: - Revisions

    fun getRevisionsByPage(pageId: String): Flow<List<PageRevisionEntity>> =
        repository.getRevisionsByPage(pageId)

    suspend fun getRevisionByVersion(pageId: String, version: Int): PageRevisionEntity? =
        repository.getRevisionByVersion(pageId, version)

    // MARK: - Table of Contents

    /**
     * Extract table of contents from markdown content.
     */
    fun extractTableOfContents(content: String): List<TableOfContentsEntry> {
        val entries = mutableListOf<TableOfContentsEntry>()
        val lines = content.split("\n")

        for (line in lines) {
            val trimmed = line.trim()

            // Check for markdown headers
            if (trimmed.startsWith("#")) {
                var level = 0
                var title = trimmed

                while (title.startsWith("#")) {
                    level++
                    title = title.substring(1)
                }

                title = title.trim()

                if (title.isNotEmpty() && level in 1..6) {
                    val anchor = title
                        .lowercase()
                        .replace(" ", "-")
                        .filter { it.isLetterOrDigit() || it == '-' }

                    entries.add(
                        TableOfContentsEntry(
                            title = title,
                            level = level,
                            anchor = anchor
                        )
                    )
                }
            }
        }

        return entries
    }

    // MARK: - Nostr Publishing

    private suspend fun publishPage(page: WikiPageEntity) {
        android.util.Log.d("WikiUseCase", "Would publish page: ${page.id}")
    }

    private suspend fun publishCategory(category: WikiCategoryEntity) {
        android.util.Log.d("WikiUseCase", "Would publish category: ${category.id}")
    }

    private suspend fun publishRevision(revision: PageRevisionEntity) {
        android.util.Log.d("WikiUseCase", "Would publish revision: ${revision.id}")
    }
}
