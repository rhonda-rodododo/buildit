package network.buildit.modules.search.domain

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import network.buildit.modules.search.data.InverseDocumentFrequencyDao
import network.buildit.modules.search.data.InverseDocumentFrequencyEntity
import network.buildit.modules.search.data.SearchDocumentDao
import network.buildit.modules.search.data.TermFrequencyDao
import network.buildit.modules.search.data.TermFrequencyEntity
import network.buildit.modules.search.models.SearchDocument
import network.buildit.modules.search.models.SparseVector
import java.text.Normalizer
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.ln
import kotlin.math.sqrt

/**
 * TF-IDF (Term Frequency-Inverse Document Frequency) engine for semantic ranking.
 *
 * Provides:
 * - Text tokenization and normalization
 * - TF-IDF vector computation
 * - Cosine similarity scoring
 * - Incremental index updates
 *
 * The engine uses a sparse vector representation where only non-zero terms are stored,
 * making it memory-efficient for large vocabularies.
 */
@Singleton
class TFIDFEngine @Inject constructor(
    private val searchDocumentDao: SearchDocumentDao,
    private val termFrequencyDao: TermFrequencyDao,
    private val idfDao: InverseDocumentFrequencyDao
) {
    companion object {
        // Common English stop words to exclude from indexing
        private val STOP_WORDS = setOf(
            "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
            "has", "he", "in", "is", "it", "its", "of", "on", "that", "the",
            "to", "was", "were", "will", "with", "the", "this", "but", "they",
            "have", "had", "what", "when", "where", "who", "which", "why", "how",
            "all", "each", "every", "both", "few", "more", "most", "other",
            "some", "such", "no", "nor", "not", "only", "own", "same", "so",
            "than", "too", "very", "just", "can", "should", "now", "been", "being"
        )

        // Minimum term length to index
        private const val MIN_TERM_LENGTH = 2

        // Maximum term length to index
        private const val MAX_TERM_LENGTH = 50

        // Smoothing factor for IDF calculation (prevents division by zero)
        private const val IDF_SMOOTHING = 1.0
    }

    /**
     * Tokenizes and normalizes text into indexable terms.
     *
     * Applies:
     * - Unicode normalization (NFD)
     * - Lowercasing
     * - Punctuation removal
     * - Stop word filtering
     * - Length filtering
     * - Basic stemming (suffix stripping)
     */
    fun tokenize(text: String): List<String> {
        // Normalize unicode
        val normalized = Normalizer.normalize(text, Normalizer.Form.NFD)
            .replace(Regex("\\p{M}"), "") // Remove diacritics

        // Split into words, lowercase, and filter
        return normalized
            .lowercase(Locale.ROOT)
            .split(Regex("[\\s\\p{Punct}]+"))
            .filter { token ->
                token.length in MIN_TERM_LENGTH..MAX_TERM_LENGTH &&
                        token !in STOP_WORDS &&
                        token.any { it.isLetter() } // Must contain at least one letter
            }
            .map { stem(it) }
            .distinct()
    }

    /**
     * Basic Porter-like stemmer for English.
     * Removes common suffixes to normalize word forms.
     */
    private fun stem(word: String): String {
        var result = word

        // Remove common suffixes
        val suffixes = listOf(
            "ingly", "ingly", "ation", "ments", "ment", "ness", "less",
            "able", "ible", "ful", "ous", "ive", "ing", "ies", "ied",
            "ion", "ity", "ers", "est", "ed", "ly", "er", "es", "s"
        )

        for (suffix in suffixes) {
            if (result.endsWith(suffix) && result.length - suffix.length >= 3) {
                result = result.dropLast(suffix.length)
                break
            }
        }

        return result
    }

    /**
     * Computes term frequencies for a document.
     *
     * @param text The document text
     * @return Map of term to raw frequency
     */
    fun computeTermFrequencies(text: String): Map<String, Int> {
        val tokens = tokenize(text)
        return tokens.groupingBy { it }.eachCount()
    }

    /**
     * Computes normalized term frequency using augmented frequency.
     * Prevents bias toward longer documents.
     *
     * tf(t,d) = 0.5 + 0.5 * (f(t,d) / max{f(t',d)})
     */
    fun computeNormalizedTf(termFrequencies: Map<String, Int>): Map<String, Double> {
        if (termFrequencies.isEmpty()) return emptyMap()

        val maxFreq = termFrequencies.values.maxOrNull()?.toDouble() ?: 1.0
        return termFrequencies.mapValues { (_, freq) ->
            0.5 + 0.5 * (freq / maxFreq)
        }
    }

    /**
     * Computes IDF value for a term.
     *
     * idf(t) = log(N / (df(t) + 1)) + 1
     *
     * Where N is total documents and df(t) is documents containing term t.
     * The +1 smoothing prevents log(0) and ensures rare terms get higher weight.
     */
    fun computeIdf(totalDocuments: Int, documentFrequency: Int): Double {
        return ln((totalDocuments.toDouble() + IDF_SMOOTHING) / (documentFrequency + IDF_SMOOTHING)) + 1.0
    }

    /**
     * Computes TF-IDF vector for a document.
     */
    suspend fun computeTfIdfVector(
        documentId: String,
        text: String,
        groupId: String
    ): SparseVector = withContext(Dispatchers.Default) {
        val termFreqs = computeTermFrequencies(text)
        val normalizedTf = computeNormalizedTf(termFreqs)

        // Get IDF values for terms
        val terms = termFreqs.keys.toList()
        val idfEntities = idfDao.getIdfsForTerms(terms)
        val idfMap = idfEntities.associate { it.term to it.idfValue }

        // Compute TF-IDF for each term
        val tfidfVector = mutableMapOf<String, Double>()
        for ((term, tf) in normalizedTf) {
            val idf = idfMap[term] ?: 1.0 // Default IDF for new terms
            tfidfVector[term] = tf * idf
        }

        // L2 normalize the vector
        normalizeVector(tfidfVector)
    }

    /**
     * L2 normalizes a vector in place.
     */
    private fun normalizeVector(vector: MutableMap<String, Double>): Map<String, Double> {
        val magnitude = sqrt(vector.values.sumOf { it * it })
        if (magnitude > 0) {
            for ((key, value) in vector) {
                vector[key] = value / magnitude
            }
        }
        return vector
    }

    /**
     * Computes cosine similarity between two TF-IDF vectors.
     * Returns value between 0 (no similarity) and 1 (identical).
     */
    fun cosineSimilarity(vec1: SparseVector, vec2: SparseVector): Double {
        if (vec1.isEmpty() || vec2.isEmpty()) return 0.0

        // Compute dot product
        var dotProduct = 0.0
        for ((term, weight1) in vec1) {
            val weight2 = vec2[term] ?: continue
            dotProduct += weight1 * weight2
        }

        // Vectors are already normalized, so dot product is the cosine similarity
        return dotProduct
    }

    /**
     * Indexes a document for TF-IDF search.
     *
     * @param document The document to index
     * @return The computed TF-IDF vector
     */
    suspend fun indexDocument(document: SearchDocument): SparseVector = withContext(Dispatchers.IO) {
        // Combine searchable text
        val fullText = buildString {
            append(document.title)
            append(" ")
            append(document.content)
            append(" ")
            document.tags.forEach { tag ->
                append(tag)
                append(" ")
            }
        }

        // Compute term frequencies
        val termFreqs = computeTermFrequencies(fullText)
        val normalizedTf = computeNormalizedTf(termFreqs)

        // Store term frequencies
        val termFrequencyEntities = normalizedTf.map { (term, normalizedFreq) ->
            TermFrequencyEntity(
                documentId = document.id,
                term = term,
                groupId = document.groupId,
                frequency = termFreqs[term] ?: 0,
                normalizedFrequency = normalizedFreq
            )
        }

        // Delete existing term frequencies for this document
        termFrequencyDao.deleteTermsForDocument(document.id)
        termFrequencyDao.insertTermFrequencies(termFrequencyEntities)

        // Update IDF values for affected terms
        updateIdfForTerms(termFreqs.keys.toList())

        // Compute and return TF-IDF vector
        computeTfIdfVector(document.id, fullText, document.groupId)
    }

    /**
     * Updates IDF values for a set of terms.
     */
    suspend fun updateIdfForTerms(terms: List<String>) = withContext(Dispatchers.IO) {
        val totalDocuments = searchDocumentDao.getDocumentCount()
        val currentTime = System.currentTimeMillis()

        val idfEntities = terms.map { term ->
            val documentFreq = termFrequencyDao.getDocumentsForTerm(term).size
            InverseDocumentFrequencyEntity(
                term = term,
                documentCount = documentFreq,
                idfValue = computeIdf(totalDocuments, documentFreq),
                lastUpdated = currentTime
            )
        }

        idfDao.insertIdfs(idfEntities)
    }

    /**
     * Removes a document from the TF-IDF index.
     */
    suspend fun removeDocument(documentId: String) = withContext(Dispatchers.IO) {
        // Get terms to update before deleting
        val terms = termFrequencyDao.getTermsForDocument(documentId)
        val termStrings = terms.map { it.term }

        // Delete term frequencies
        termFrequencyDao.deleteTermsForDocument(documentId)

        // Update IDF values for affected terms
        updateIdfForTerms(termStrings)
    }

    /**
     * Performs semantic search using TF-IDF vectors.
     *
     * @param query The search query
     * @param candidateDocuments Documents to score (pre-filtered by FTS)
     * @param limit Maximum results to return
     * @return List of document IDs with similarity scores, sorted by score descending
     */
    suspend fun semanticSearch(
        query: String,
        candidateDocuments: List<SearchDocument>,
        limit: Int = 50
    ): List<Pair<String, Double>> = withContext(Dispatchers.Default) {
        if (candidateDocuments.isEmpty()) return@withContext emptyList()

        // Compute query vector
        val queryTermFreqs = computeTermFrequencies(query)
        val normalizedQueryTf = computeNormalizedTf(queryTermFreqs)

        // Get IDF values for query terms
        val queryTerms = queryTermFreqs.keys.toList()
        val idfEntities = idfDao.getIdfsForTerms(queryTerms)
        val idfMap = idfEntities.associate { it.term to it.idfValue }

        // Compute query TF-IDF vector
        val queryVector = mutableMapOf<String, Double>()
        for ((term, tf) in normalizedQueryTf) {
            val idf = idfMap[term] ?: 1.0
            queryVector[term] = tf * idf
        }
        normalizeVector(queryVector)

        // Score each candidate document
        val scores = candidateDocuments.mapNotNull { doc ->
            val docVector = doc.vector ?: return@mapNotNull null
            val similarity = cosineSimilarity(queryVector, docVector)
            if (similarity > 0) {
                doc.id to similarity
            } else {
                null
            }
        }

        // Sort by similarity and return top results
        scores.sortedByDescending { it.second }.take(limit)
    }

    /**
     * Rebuilds the entire TF-IDF index.
     * Should be called periodically or after significant changes.
     */
    suspend fun rebuildIndex() = withContext(Dispatchers.IO) {
        // Clear existing index
        termFrequencyDao.deleteAllTermFrequencies()
        idfDao.deleteAllIdfs()

        // Get all documents in batches
        var offset = 0
        val batchSize = 100
        val allTerms = mutableSetOf<String>()

        while (true) {
            val documents = searchDocumentDao.getAllDocuments(batchSize, offset)
            if (documents.isEmpty()) break

            for (entity in documents) {
                val document = entity.toSearchDocument()
                val fullText = buildString {
                    append(document.title)
                    append(" ")
                    append(document.content)
                    append(" ")
                    document.tags.forEach { tag ->
                        append(tag)
                        append(" ")
                    }
                }

                val termFreqs = computeTermFrequencies(fullText)
                val normalizedTf = computeNormalizedTf(termFreqs)

                val termFrequencyEntities = normalizedTf.map { (term, normalizedFreq) ->
                    TermFrequencyEntity(
                        documentId = document.id,
                        term = term,
                        groupId = document.groupId,
                        frequency = termFreqs[term] ?: 0,
                        normalizedFrequency = normalizedFreq
                    )
                }

                termFrequencyDao.insertTermFrequencies(termFrequencyEntities)
                allTerms.addAll(termFreqs.keys)
            }

            offset += batchSize
        }

        // Update all IDF values
        updateIdfForTerms(allTerms.toList())
    }

    /**
     * Gets index statistics.
     */
    suspend fun getIndexStats(): TFIDFStats = withContext(Dispatchers.IO) {
        TFIDFStats(
            uniqueTerms = termFrequencyDao.getUniqueTermCount(),
            totalDocuments = searchDocumentDao.getDocumentCount()
        )
    }
}

/**
 * Statistics about the TF-IDF index.
 */
data class TFIDFStats(
    val uniqueTerms: Int,
    val totalDocuments: Int
)
