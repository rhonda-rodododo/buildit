// QueryParser.swift
// BuildIt - Decentralized Mesh Communication
//
// Parses search query syntax including phrases, filters, and operators.
// Supports organizing-focused concept expansion.

import Foundation
import os.log

// MARK: - QueryParser

/// Parses and normalizes search queries
public struct QueryParser: Sendable {
    // MARK: - Properties

    private let logger = Logger(subsystem: "com.buildit", category: "QueryParser")
    private let conceptExpansions: [String: ConceptExpansion]

    // MARK: - Initialization

    public init() {
        // Initialize with organizing-focused concept expansions
        self.conceptExpansions = Self.defaultConceptExpansions
    }

    // MARK: - Public API

    /// Parse a raw query string into a structured ParsedQuery
    /// - Parameters:
    ///   - query: The raw query string
    ///   - scope: The search scope
    /// - Returns: A parsed and normalized query
    public func parse(_ query: String, scope: SearchScope = .global) -> ParsedQuery {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)

        // Extract quoted phrases
        let (withoutPhrases, phrases) = extractPhrases(from: trimmed)

        // Extract filters (e.g., author:name, tag:value, date:2024-01)
        let (withoutFilters, filters) = extractFilters(from: withoutPhrases)

        // Extract keywords
        let keywords = extractKeywords(from: withoutFilters)

        // Expand concepts for semantic search
        let expandedTerms = expandConcepts(keywords: keywords)

        return ParsedQuery(
            raw: query,
            keywords: keywords,
            phrases: phrases,
            expandedTerms: expandedTerms.isEmpty ? nil : expandedTerms,
            filters: filters,
            scope: scope
        )
    }

    /// Stem a word for matching
    public func stem(_ word: String) -> String {
        // Simple English stemmer - in production, use a proper stemmer library
        var stemmed = word.lowercased()

        // Remove common suffixes
        let suffixes = ["ing", "ed", "ly", "es", "s", "er", "est", "ment", "ness", "tion", "sion"]
        for suffix in suffixes {
            if stemmed.hasSuffix(suffix) && stemmed.count > suffix.count + 2 {
                stemmed = String(stemmed.dropLast(suffix.count))
                break
            }
        }

        return stemmed
    }

    /// Check if a query is empty or only contains operators
    public func isEmpty(_ query: String) -> Bool {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        let parsed = parse(trimmed)
        return parsed.keywords.isEmpty && parsed.phrases.isEmpty && parsed.filters.isEmpty
    }

    // MARK: - Private Methods

    /// Extract quoted phrases from query
    private func extractPhrases(from query: String) -> (remaining: String, phrases: [String]) {
        var remaining = query
        var phrases: [String] = []

        // Match double-quoted phrases
        let doubleQuotePattern = "\"([^\"]+)\""
        if let regex = try? NSRegularExpression(pattern: doubleQuotePattern) {
            let range = NSRange(remaining.startIndex..., in: remaining)
            let matches = regex.matches(in: remaining, range: range)

            for match in matches.reversed() {
                if let phraseRange = Range(match.range(at: 1), in: remaining) {
                    phrases.insert(String(remaining[phraseRange]), at: 0)
                }
                if let fullRange = Range(match.range, in: remaining) {
                    remaining.removeSubrange(fullRange)
                }
            }
        }

        // Match single-quoted phrases
        let singleQuotePattern = "'([^']+)'"
        if let regex = try? NSRegularExpression(pattern: singleQuotePattern) {
            let range = NSRange(remaining.startIndex..., in: remaining)
            let matches = regex.matches(in: remaining, range: range)

            for match in matches.reversed() {
                if let phraseRange = Range(match.range(at: 1), in: remaining) {
                    phrases.insert(String(remaining[phraseRange]), at: 0)
                }
                if let fullRange = Range(match.range, in: remaining) {
                    remaining.removeSubrange(fullRange)
                }
            }
        }

        return (remaining, phrases)
    }

    /// Extract filter expressions from query
    private func extractFilters(from query: String) -> (remaining: String, filters: [QueryFilter]) {
        var remaining = query
        var filters: [QueryFilter] = []

        // Pattern for filters like field:value or field:"quoted value"
        let filterPattern = "(author|tag|type|module|group|from|to|date|before|after):(?:\"([^\"]+)\"|([^\\s]+))"

        if let regex = try? NSRegularExpression(pattern: filterPattern, options: .caseInsensitive) {
            let range = NSRange(remaining.startIndex..., in: remaining)
            let matches = regex.matches(in: remaining, range: range)

            for match in matches.reversed() {
                guard let fieldRange = Range(match.range(at: 1), in: remaining) else { continue }
                let field = String(remaining[fieldRange]).lowercased()

                // Get value from either quoted or unquoted capture group
                var value: String?
                if match.range(at: 2).location != NSNotFound,
                   let valueRange = Range(match.range(at: 2), in: remaining) {
                    value = String(remaining[valueRange])
                } else if let valueRange = Range(match.range(at: 3), in: remaining) {
                    value = String(remaining[valueRange])
                }

                if let value = value {
                    if let filter = createFilter(field: field, value: value) {
                        filters.insert(filter, at: 0)
                    }
                }

                if let fullRange = Range(match.range, in: remaining) {
                    remaining.removeSubrange(fullRange)
                }
            }
        }

        return (remaining, filters)
    }

    /// Create a filter from field and value
    private func createFilter(field: String, value: String) -> QueryFilter? {
        switch field {
        case "author", "from":
            return QueryFilter(field: "authorPubkey", operator: .contains, value: .string(value))

        case "tag":
            return QueryFilter(field: "tags", operator: .contains, value: .string(value))

        case "type", "module":
            return QueryFilter(field: "moduleType", operator: .eq, value: .string(value))

        case "group":
            return QueryFilter(field: "groupId", operator: .eq, value: .string(value))

        case "date":
            // Parse date value
            if let timestamp = parseDate(value) {
                let dayStart = timestamp
                let dayEnd = timestamp + 86400000 // +24 hours in ms
                return QueryFilter(field: "createdAt", operator: .range, value: .range(min: Double(dayStart), max: Double(dayEnd)))
            }

        case "before":
            if let timestamp = parseDate(value) {
                return QueryFilter(field: "createdAt", operator: .lt, value: .number(Double(timestamp)))
            }

        case "after":
            if let timestamp = parseDate(value) {
                return QueryFilter(field: "createdAt", operator: .gt, value: .number(Double(timestamp)))
            }

        default:
            break
        }

        return nil
    }

    /// Parse a date string to Unix timestamp (ms)
    private func parseDate(_ value: String) -> Int64? {
        let formatters: [DateFormatter] = {
            let formats = ["yyyy-MM-dd", "yyyy-MM", "yyyy", "MM/dd/yyyy", "dd/MM/yyyy"]
            return formats.map { format in
                let formatter = DateFormatter()
                formatter.dateFormat = format
                return formatter
            }
        }()

        for formatter in formatters {
            if let date = formatter.date(from: value) {
                return Int64(date.timeIntervalSince1970 * 1000)
            }
        }

        // Try relative dates
        let lowercased = value.lowercased()
        let now = Date()
        let calendar = Calendar.current

        switch lowercased {
        case "today":
            return Int64(calendar.startOfDay(for: now).timeIntervalSince1970 * 1000)
        case "yesterday":
            if let date = calendar.date(byAdding: .day, value: -1, to: now) {
                return Int64(calendar.startOfDay(for: date).timeIntervalSince1970 * 1000)
            }
        case "thisweek":
            if let date = calendar.date(from: calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: now)) {
                return Int64(date.timeIntervalSince1970 * 1000)
            }
        case "thismonth":
            if let date = calendar.date(from: calendar.dateComponents([.year, .month], from: now)) {
                return Int64(date.timeIntervalSince1970 * 1000)
            }
        default:
            break
        }

        return nil
    }

    /// Extract keywords from query
    private func extractKeywords(from query: String) -> [String] {
        // Remove special characters and split by whitespace
        let cleaned = query.lowercased()
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty && $0.count >= 2 }

        // Remove stop words
        let stopWords: Set<String> = [
            "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
            "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
            "be", "have", "has", "had", "do", "does", "did", "will", "would",
            "could", "should", "may", "might", "must", "shall", "can", "need",
            "that", "this", "these", "those", "it", "its", "they", "them", "their",
            "we", "us", "our", "you", "your", "he", "she", "him", "her", "his"
        ]

        return cleaned.filter { !stopWords.contains($0) }
    }

    /// Expand concepts with synonyms and related terms
    private func expandConcepts(keywords: [String]) -> [String] {
        var expanded: Set<String> = []

        for keyword in keywords {
            let stemmed = stem(keyword)

            // Check direct expansions
            if let expansion = conceptExpansions[stemmed] {
                expanded.formUnion(expansion.synonyms)
                if let narrower = expansion.narrower {
                    expanded.formUnion(narrower)
                }
            }

            // Check if keyword matches any synonym
            for (term, expansion) in conceptExpansions {
                if expansion.synonyms.contains(stemmed) {
                    expanded.insert(term)
                    expanded.formUnion(expansion.synonyms)
                }
            }
        }

        // Remove original keywords from expansion
        let keywordSet = Set(keywords.map { stem($0) })
        return Array(expanded.subtracting(keywordSet))
    }

    // MARK: - Concept Expansions

    /// Default concept expansions for organizing contexts
    private static let defaultConceptExpansions: [String: ConceptExpansion] = [
        "meeting": ConceptExpansion(
            term: "meeting",
            synonyms: ["assembly", "gathering", "session", "conference", "huddle", "standup"],
            broader: "event",
            narrower: ["general assembly", "committee meeting", "caucus"]
        ),
        "vote": ConceptExpansion(
            term: "vote",
            synonyms: ["ballot", "poll", "election", "referendum", "decision"],
            broader: "governance",
            narrower: ["motion", "resolution", "amendment"]
        ),
        "action": ConceptExpansion(
            term: "action",
            synonyms: ["campaign", "protest", "rally", "demonstration", "march", "strike", "boycott"],
            broader: "organizing",
            narrower: ["direct action", "civil disobedience", "sit-in"]
        ),
        "member": ConceptExpansion(
            term: "member",
            synonyms: ["participant", "organizer", "volunteer", "activist", "comrade", "ally"],
            broader: "person"
        ),
        "mutual aid": ConceptExpansion(
            term: "mutual aid",
            synonyms: ["solidarity", "support", "assistance", "help", "resource sharing"],
            broader: "organizing"
        ),
        "union": ConceptExpansion(
            term: "union",
            synonyms: ["labor union", "trade union", "workers union", "guild", "collective"],
            broader: "organization",
            narrower: ["local", "chapter", "branch"]
        ),
        "coop": ConceptExpansion(
            term: "coop",
            synonyms: ["cooperative", "co-op", "worker cooperative", "collective", "commune"],
            broader: "organization"
        ),
        "proposal": ConceptExpansion(
            term: "proposal",
            synonyms: ["motion", "resolution", "recommendation", "suggestion", "initiative"],
            broader: "governance"
        ),
        "consensus": ConceptExpansion(
            term: "consensus",
            synonyms: ["agreement", "accord", "unity", "collective decision"],
            broader: "governance"
        ),
        "fundrais": ConceptExpansion(
            term: "fundraising",
            synonyms: ["donation", "contribution", "crowdfunding", "campaign", "drive"],
            broader: "resources"
        ),
        "outreach": ConceptExpansion(
            term: "outreach",
            synonyms: ["canvassing", "door-knocking", "phone banking", "tabling", "recruitment"],
            broader: "organizing"
        ),
        "train": ConceptExpansion(
            term: "training",
            synonyms: ["workshop", "education", "skill-building", "orientation", "onboarding"],
            broader: "event"
        ),
        "document": ConceptExpansion(
            term: "document",
            synonyms: ["file", "record", "report", "minutes", "notes", "resource"],
            broader: nil
        )
    ]
}

// MARK: - Query Suggestion

/// Suggests search queries based on partial input
public struct QuerySuggester: Sendable {
    private let recentSearches: [RecentSearch]
    private let savedSearches: [SavedSearch]
    private let popularTerms: [String]

    public init(
        recentSearches: [RecentSearch] = [],
        savedSearches: [SavedSearch] = [],
        popularTerms: [String] = []
    ) {
        self.recentSearches = recentSearches
        self.savedSearches = savedSearches
        self.popularTerms = popularTerms
    }

    /// Get suggestions for a partial query
    /// - Parameter prefix: The partial query string
    /// - Returns: Array of suggested queries
    public func suggest(for prefix: String) -> [String] {
        let lowercased = prefix.lowercased()
        var suggestions: [String] = []

        // Add matching recent searches
        for recent in recentSearches where recent.query.lowercased().hasPrefix(lowercased) {
            if !suggestions.contains(recent.query) {
                suggestions.append(recent.query)
            }
        }

        // Add matching saved searches
        for saved in savedSearches where saved.query.lowercased().hasPrefix(lowercased) {
            if !suggestions.contains(saved.query) {
                suggestions.append(saved.query)
            }
        }

        // Add filter suggestions if typing a filter
        if lowercased.contains(":") {
            suggestions.append(contentsOf: suggestFilters(for: lowercased))
        }

        // Limit suggestions
        return Array(suggestions.prefix(10))
    }

    /// Suggest filter completions
    private func suggestFilters(for prefix: String) -> [String] {
        let filterPrefixes = [
            "author:", "tag:", "type:", "module:", "group:",
            "date:", "before:", "after:", "from:"
        ]

        let lowercased = prefix.lowercased()

        // If just starting a filter, suggest filter types
        for filterPrefix in filterPrefixes {
            if filterPrefix.hasPrefix(lowercased) && filterPrefix != lowercased {
                return [filterPrefix]
            }
        }

        // If typing a filter value, could suggest common values
        // This would require access to the index to get popular values

        return []
    }
}
