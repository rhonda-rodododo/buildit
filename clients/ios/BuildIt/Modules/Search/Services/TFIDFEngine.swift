// TFIDFEngine.swift
// BuildIt - Decentralized Mesh Communication
//
// TF-IDF (Term Frequency - Inverse Document Frequency) engine for semantic ranking.
// Provides document similarity and relevance scoring beyond simple text matching.

import Foundation
import os.log

// MARK: - TFIDFEngine

/// TF-IDF engine for semantic search and document ranking
public actor TFIDFEngine {
    // MARK: - Properties

    private let logger = Logger(subsystem: "com.buildit", category: "TFIDFEngine")

    /// Document frequency for each term (number of documents containing the term)
    private var documentFrequency: [String: Int] = [:]

    /// Total number of documents in the corpus
    private var totalDocuments: Int = 0

    /// Cached IDF values
    private var idfCache: [String: Double] = [:]

    /// Porter stemmer for term normalization
    private let stemmer = PorterStemmer()

    // MARK: - Public API

    /// Update the corpus statistics from the database
    /// - Parameters:
    ///   - documentFrequencies: Map of term to document count
    ///   - totalDocuments: Total number of documents
    public func updateCorpus(documentFrequencies: [String: Int], totalDocuments: Int) {
        self.documentFrequency = documentFrequencies
        self.totalDocuments = totalDocuments
        self.idfCache.removeAll()

        logger.info("Updated corpus: \(totalDocuments) documents, \(documentFrequencies.count) terms")
    }

    /// Add a document to the corpus
    /// - Parameter document: The document to add
    public func addDocument(_ document: SearchDocument) {
        let terms = tokenize(document.title + " " + document.content)
        let uniqueTerms = Set(terms)

        for term in uniqueTerms {
            documentFrequency[term, default: 0] += 1
            idfCache.removeValue(forKey: term)
        }
        totalDocuments += 1
    }

    /// Remove a document from the corpus
    /// - Parameter document: The document to remove
    public func removeDocument(_ document: SearchDocument) {
        let terms = tokenize(document.title + " " + document.content)
        let uniqueTerms = Set(terms)

        for term in uniqueTerms {
            if let count = documentFrequency[term] {
                if count <= 1 {
                    documentFrequency.removeValue(forKey: term)
                } else {
                    documentFrequency[term] = count - 1
                }
                idfCache.removeValue(forKey: term)
            }
        }
        totalDocuments = max(0, totalDocuments - 1)
    }

    /// Calculate the TF-IDF vector for a document
    /// - Parameter document: The document to vectorize
    /// - Returns: Sparse vector of term weights
    public func vectorize(_ document: SearchDocument) -> SparseVector {
        let titleTerms = tokenize(document.title)
        let contentTerms = tokenize(document.content)
        let tagTerms = (document.tags ?? []).flatMap { tokenize($0) }

        // Combine with field weights
        var termFrequencies: [String: Double] = [:]

        // Title terms get higher weight
        for term in titleTerms {
            termFrequencies[term, default: 0] += 2.0
        }

        // Content terms
        for term in contentTerms {
            termFrequencies[term, default: 0] += 1.0
        }

        // Tag terms get higher weight
        for term in tagTerms {
            termFrequencies[term, default: 0] += 1.5
        }

        // Calculate TF-IDF for each term
        var vector: SparseVector = [:]
        let totalTerms = Double(titleTerms.count + contentTerms.count + tagTerms.count)

        for (term, frequency) in termFrequencies {
            let tf = frequency / max(totalTerms, 1)
            let idf = getIDF(term)
            vector[term] = tf * idf
        }

        return vector
    }

    /// Calculate the TF-IDF vector for a query
    /// - Parameter query: The parsed query
    /// - Returns: Sparse vector of term weights
    public func vectorizeQuery(_ query: ParsedQuery) -> SparseVector {
        var terms: [String] = []

        // Add keywords
        terms.append(contentsOf: query.keywords.flatMap { tokenize($0) })

        // Add phrase terms
        for phrase in query.phrases {
            terms.append(contentsOf: tokenize(phrase))
        }

        // Add expanded terms with lower weight
        if let expanded = query.expandedTerms {
            terms.append(contentsOf: expanded.flatMap { tokenize($0) })
        }

        // Calculate term frequencies
        var termFrequencies: [String: Double] = [:]
        for term in terms {
            termFrequencies[term, default: 0] += 1.0
        }

        // Calculate TF-IDF for each term
        var vector: SparseVector = [:]
        let totalTerms = Double(terms.count)

        for (term, frequency) in termFrequencies {
            let tf = frequency / max(totalTerms, 1)
            let idf = getIDF(term)
            vector[term] = tf * idf
        }

        return vector
    }

    /// Calculate cosine similarity between two vectors
    /// - Parameters:
    ///   - a: First vector
    ///   - b: Second vector
    /// - Returns: Similarity score between 0 and 1
    public func cosineSimilarity(_ a: SparseVector, _ b: SparseVector) -> Double {
        // Calculate dot product
        var dotProduct = 0.0
        for (term, weightA) in a {
            if let weightB = b[term] {
                dotProduct += weightA * weightB
            }
        }

        // Calculate magnitudes
        let magnitudeA = sqrt(a.values.map { $0 * $0 }.reduce(0, +))
        let magnitudeB = sqrt(b.values.map { $0 * $0 }.reduce(0, +))

        // Avoid division by zero
        guard magnitudeA > 0 && magnitudeB > 0 else { return 0 }

        return dotProduct / (magnitudeA * magnitudeB)
    }

    /// Score a document against a query using TF-IDF similarity
    /// - Parameters:
    ///   - document: The document to score
    ///   - query: The parsed query
    /// - Returns: Relevance score between 0 and 1
    public func score(document: SearchDocument, query: ParsedQuery) -> Double {
        let documentVector = document.vector ?? vectorize(document)
        let queryVector = vectorizeQuery(query)

        return cosineSimilarity(documentVector, queryVector)
    }

    /// Re-rank results using TF-IDF semantic similarity
    /// - Parameters:
    ///   - results: The results to re-rank
    ///   - query: The parsed query
    ///   - semanticWeight: Weight given to semantic score (0-1)
    /// - Returns: Re-ranked results
    public func rerank(
        results: [SearchResult],
        query: ParsedQuery,
        semanticWeight: Double = 0.3
    ) -> [SearchResult] {
        let queryVector = vectorizeQuery(query)

        return results.map { result in
            let documentVector = result.document.vector ?? vectorize(result.document)
            let semanticScore = cosineSimilarity(documentVector, queryVector)

            // Combine BM25/FTS score with semantic score
            let combinedScore = (1 - semanticWeight) * result.score + semanticWeight * semanticScore

            return SearchResult(
                document: result.document,
                score: combinedScore,
                matchedTerms: result.matchedTerms,
                matchedFields: result.matchedFields,
                highlightedExcerpt: result.highlightedExcerpt
            )
        }.sorted { $0.score > $1.score }
    }

    /// Find similar documents to a given document
    /// - Parameters:
    ///   - document: The reference document
    ///   - candidates: Candidate documents to compare
    ///   - limit: Maximum number of similar documents to return
    /// - Returns: Similar documents sorted by similarity
    public func findSimilar(
        to document: SearchDocument,
        among candidates: [SearchDocument],
        limit: Int = 10
    ) -> [(document: SearchDocument, similarity: Double)] {
        let referenceVector = document.vector ?? vectorize(document)

        var similarities: [(document: SearchDocument, similarity: Double)] = []

        for candidate in candidates where candidate.id != document.id {
            let candidateVector = candidate.vector ?? vectorize(candidate)
            let similarity = cosineSimilarity(referenceVector, candidateVector)

            if similarity > 0.1 { // Threshold for relevance
                similarities.append((candidate, similarity))
            }
        }

        return similarities
            .sorted { $0.similarity > $1.similarity }
            .prefix(limit)
            .map { $0 }
    }

    /// Get top terms for a document (for keyword extraction)
    /// - Parameters:
    ///   - document: The document
    ///   - limit: Maximum number of terms
    /// - Returns: Top terms sorted by TF-IDF weight
    public func getTopTerms(for document: SearchDocument, limit: Int = 10) -> [(term: String, weight: Double)] {
        let vector = document.vector ?? vectorize(document)

        return vector
            .map { (term: $0.key, weight: $0.value) }
            .sorted { $0.weight > $1.weight }
            .prefix(limit)
            .map { $0 }
    }

    // MARK: - Private Methods

    /// Get the IDF (Inverse Document Frequency) for a term
    private func getIDF(_ term: String) -> Double {
        if let cached = idfCache[term] {
            return cached
        }

        let docFreq = documentFrequency[term] ?? 0
        let idf: Double

        if docFreq == 0 || totalDocuments == 0 {
            // Unknown term - give it a high IDF (rare)
            idf = log(Double(max(totalDocuments, 1)) + 1)
        } else {
            // Standard IDF formula with smoothing
            idf = log(Double(totalDocuments + 1) / Double(docFreq + 1)) + 1
        }

        idfCache[term] = idf
        return idf
    }

    /// Tokenize text into normalized terms
    private func tokenize(_ text: String) -> [String] {
        let lowercased = text.lowercased()

        // Split on non-alphanumeric characters
        let words = lowercased.components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { $0.count >= 2 }

        // Apply stemming
        return words.map { stemmer.stem($0) }
    }
}

// MARK: - Porter Stemmer

/// Simple Porter Stemmer implementation for English
/// In production, consider using a more robust library
private struct PorterStemmer {
    /// Stem a word using simplified Porter algorithm
    func stem(_ word: String) -> String {
        guard word.count > 2 else { return word }

        var result = word.lowercased()

        // Step 1a: Remove plural suffixes
        if result.hasSuffix("sses") {
            result = String(result.dropLast(2))
        } else if result.hasSuffix("ies") {
            result = String(result.dropLast(2))
        } else if result.hasSuffix("ss") {
            // Keep as is
        } else if result.hasSuffix("s") {
            result = String(result.dropLast(1))
        }

        // Step 1b: Remove past tense suffixes
        if result.hasSuffix("eed") {
            if result.count > 4 {
                result = String(result.dropLast(1))
            }
        } else if result.hasSuffix("ed") {
            let stem = String(result.dropLast(2))
            if containsVowel(stem) {
                result = stem
                result = cleanupAfterStep1b(result)
            }
        } else if result.hasSuffix("ing") {
            let stem = String(result.dropLast(3))
            if containsVowel(stem) {
                result = stem
                result = cleanupAfterStep1b(result)
            }
        }

        // Step 1c: Replace y with i
        if result.hasSuffix("y") {
            let stem = String(result.dropLast(1))
            if containsVowel(stem) {
                result = stem + "i"
            }
        }

        // Step 2: Remove common suffixes
        let step2Suffixes: [(String, String)] = [
            ("ational", "ate"),
            ("tional", "tion"),
            ("enci", "ence"),
            ("anci", "ance"),
            ("izer", "ize"),
            ("abli", "able"),
            ("alli", "al"),
            ("entli", "ent"),
            ("eli", "e"),
            ("ousli", "ous"),
            ("ization", "ize"),
            ("ation", "ate"),
            ("ator", "ate"),
            ("alism", "al"),
            ("iveness", "ive"),
            ("fulness", "ful"),
            ("ousness", "ous"),
            ("aliti", "al"),
            ("iviti", "ive"),
            ("biliti", "ble")
        ]

        for (suffix, replacement) in step2Suffixes {
            if result.hasSuffix(suffix) {
                let stem = String(result.dropLast(suffix.count))
                if stem.count > 0 {
                    result = stem + replacement
                    break
                }
            }
        }

        // Step 3: Remove more suffixes
        let step3Suffixes: [(String, String)] = [
            ("icate", "ic"),
            ("ative", ""),
            ("alize", "al"),
            ("iciti", "ic"),
            ("ical", "ic"),
            ("ful", ""),
            ("ness", "")
        ]

        for (suffix, replacement) in step3Suffixes {
            if result.hasSuffix(suffix) {
                let stem = String(result.dropLast(suffix.count))
                if stem.count > 0 {
                    result = stem + replacement
                    break
                }
            }
        }

        // Step 4: Remove final suffixes
        let step4Suffixes = ["al", "ance", "ence", "er", "ic", "able", "ible", "ant", "ement", "ment", "ent", "ion", "ou", "ism", "ate", "iti", "ous", "ive", "ize"]

        for suffix in step4Suffixes {
            if result.hasSuffix(suffix) {
                let stem = String(result.dropLast(suffix.count))
                if stem.count > 1 {
                    result = stem
                    break
                }
            }
        }

        // Step 5: Final cleanup
        if result.hasSuffix("e") && result.count > 2 {
            result = String(result.dropLast(1))
        }
        if result.hasSuffix("ll") && result.count > 2 {
            result = String(result.dropLast(1))
        }

        return result
    }

    /// Check if a string contains a vowel
    private func containsVowel(_ s: String) -> Bool {
        let vowels: Set<Character> = ["a", "e", "i", "o", "u"]
        return s.contains { vowels.contains($0) }
    }

    /// Cleanup after step 1b
    private func cleanupAfterStep1b(_ s: String) -> String {
        var result = s

        if result.hasSuffix("at") || result.hasSuffix("bl") || result.hasSuffix("iz") {
            result += "e"
        } else if isDoubleConsonant(result) && !["l", "s", "z"].contains(String(result.last!)) {
            result = String(result.dropLast(1))
        } else if result.count <= 3 && !containsVowel(result) {
            result += "e"
        }

        return result
    }

    /// Check if string ends with double consonant
    private func isDoubleConsonant(_ s: String) -> Bool {
        guard s.count >= 2 else { return false }
        let last = s.last!
        let secondLast = s[s.index(s.endIndex, offsetBy: -2)]
        return last == secondLast && !["a", "e", "i", "o", "u"].contains(String(last))
    }
}

// MARK: - Batch Operations

public extension TFIDFEngine {
    /// Vectorize multiple documents in batch
    /// - Parameter documents: Documents to vectorize
    /// - Returns: Map of document ID to vector
    func vectorizeBatch(_ documents: [SearchDocument]) -> [String: SparseVector] {
        var results: [String: SparseVector] = [:]
        for document in documents {
            results[document.id] = vectorize(document)
        }
        return results
    }

    /// Update corpus from a batch of documents
    /// - Parameter documents: All documents in the corpus
    func rebuildCorpus(from documents: [SearchDocument]) {
        var frequencies: [String: Int] = [:]

        for document in documents {
            let terms = Set(tokenize(document.title + " " + document.content))
            for term in terms {
                frequencies[term, default: 0] += 1
            }
        }

        self.documentFrequency = frequencies
        self.totalDocuments = documents.count
        self.idfCache.removeAll()

        logger.info("Rebuilt corpus from \(documents.count) documents, \(frequencies.count) unique terms")
    }
}
