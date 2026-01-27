// TemplateManager.swift
// BuildIt - Decentralized Mesh Communication
//
// Manages canned response templates for messaging hotline.
// Supports variable substitution and keyboard shortcuts.

import Foundation
import Combine
import os.log

/// Message template for canned responses
public struct MessageTemplate: Codable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let content: String
    public let variables: [String]
    public var shortcut: String?
    public var category: String?
    public let isDefault: Bool
    public let createdAt: Int
    public var updatedAt: Int

    public init(
        id: String = UUID().uuidString,
        name: String,
        content: String,
        variables: [String] = [],
        shortcut: String? = nil,
        category: String? = nil,
        isDefault: Bool = false,
        createdAt: Int = Int(Date().timeIntervalSince1970),
        updatedAt: Int = Int(Date().timeIntervalSince1970)
    ) {
        self.id = id
        self.name = name
        self.content = content
        self.variables = variables
        self.shortcut = shortcut
        self.category = category
        self.isDefault = isDefault
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

/// Context for template variable substitution
public struct TemplateContext: Sendable {
    public var hotlineName: String?
    public var operatorName: String?
    public var callerName: String?
    public var date: String?
    public var time: String?
    public var custom: [String: String]

    public init(
        hotlineName: String? = nil,
        operatorName: String? = nil,
        callerName: String? = nil,
        date: String? = nil,
        time: String? = nil,
        custom: [String: String] = [:]
    ) {
        self.hotlineName = hotlineName
        self.operatorName = operatorName
        self.callerName = callerName
        self.date = date
        self.time = time
        self.custom = custom
    }

    /// Get all context values as a dictionary
    public func toDictionary() -> [String: String] {
        var dict = custom
        if let v = hotlineName { dict["hotline_name"] = v }
        if let v = operatorName { dict["operator_name"] = v }
        if let v = callerName { dict["caller_name"] = v }
        if let v = date { dict["date"] = v }
        if let v = time { dict["time"] = v }
        return dict
    }
}

/// Manager for message templates
@MainActor
public class TemplateManager: ObservableObject {
    // MARK: - Published Properties

    @Published public private(set) var templates: [String: MessageTemplate] = [:]

    // MARK: - Properties

    private var shortcuts: [String: String] = [:] // shortcut -> template id
    private let logger = Logger(subsystem: "com.buildit", category: "TemplateManager")

    /// Default templates
    private static let defaultTemplates: [MessageTemplate] = [
        MessageTemplate(
            id: "greeting",
            name: "Greeting",
            content: "Thank you for contacting {{hotline_name}}. My name is {{operator_name}} and I'm here to help you. How can I assist you today?",
            variables: ["hotline_name", "operator_name"],
            shortcut: "Cmd+G",
            category: "General",
            isDefault: true
        ),
        MessageTemplate(
            id: "info_request",
            name: "Request Info",
            content: "To help you better, could you please provide some additional information about your situation? Specifically, I'd like to know:\n\n1. When did this occur?\n2. Who was involved?\n3. What happened?",
            variables: [],
            shortcut: "Cmd+I",
            category: "General",
            isDefault: true
        ),
        MessageTemplate(
            id: "followup",
            name: "Follow-up Scheduled",
            content: "Thank you for the information, {{caller_name}}. We'll follow up with you within 24-48 hours. If you have any additional questions or concerns in the meantime, please don't hesitate to reach out.",
            variables: ["caller_name"],
            category: "General",
            isDefault: true
        ),
        MessageTemplate(
            id: "resolved",
            name: "Resolution",
            content: "I'm glad we could help resolve your concern today, {{caller_name}}. Is there anything else I can assist you with before we close this conversation?",
            variables: ["caller_name"],
            shortcut: "Cmd+R",
            category: "General",
            isDefault: true
        ),
        MessageTemplate(
            id: "hold_on",
            name: "Please Hold",
            content: "Thank you for your patience. I'm looking into this for you and will respond shortly.",
            variables: [],
            shortcut: "Cmd+H",
            category: "General",
            isDefault: true
        ),
        MessageTemplate(
            id: "transfer_notice",
            name: "Transfer Notice",
            content: "I'm going to transfer you to a colleague who can better assist with this matter. They'll have access to our conversation so you won't need to repeat yourself. Please hold.",
            variables: [],
            category: "General",
            isDefault: true
        ),
        MessageTemplate(
            id: "after_hours",
            name: "After Hours",
            content: "Thank you for contacting {{hotline_name}}. Our team is currently unavailable. Our normal hours are Monday-Friday, 9 AM - 5 PM. We'll respond to your message during the next business day.",
            variables: ["hotline_name"],
            category: "Auto-Response",
            isDefault: true
        ),
        MessageTemplate(
            id: "emergency_resources",
            name: "Emergency Resources",
            content: "If you're experiencing an emergency, please call 911. For mental health crisis support, you can reach the 988 Suicide & Crisis Lifeline by calling or texting 988. We're here to support you.",
            variables: [],
            shortcut: "Cmd+E",
            category: "Safety",
            isDefault: true
        ),
        MessageTemplate(
            id: "legal_disclaimer",
            name: "Legal Disclaimer",
            content: "Please note that the information provided here is for general guidance only and does not constitute legal advice. For specific legal questions, please consult with a qualified attorney.",
            variables: [],
            category: "Legal",
            isDefault: true
        ),
        MessageTemplate(
            id: "know_your_rights",
            name: "Know Your Rights",
            content: "Here are some important things to remember:\n\n• You have the right to remain silent\n• You have the right to refuse consent to search\n• You have the right to speak with an attorney\n• You have the right to make a local phone call\n\nIf you're being questioned, you can say \"I wish to remain silent\" and \"I want to speak to a lawyer.\"",
            variables: [],
            shortcut: "Cmd+K",
            category: "Legal",
            isDefault: true
        )
    ]

    // MARK: - Initialization

    public init() {
        loadDefaultTemplates()
    }

    private func loadDefaultTemplates() {
        let now = Int(Date().timeIntervalSince1970)
        for template in Self.defaultTemplates {
            var mutableTemplate = template
            // Ensure timestamps are set
            if mutableTemplate.createdAt == 0 {
                mutableTemplate = MessageTemplate(
                    id: template.id,
                    name: template.name,
                    content: template.content,
                    variables: template.variables,
                    shortcut: template.shortcut,
                    category: template.category,
                    isDefault: template.isDefault,
                    createdAt: now,
                    updatedAt: now
                )
            }
            templates[mutableTemplate.id] = mutableTemplate
            if let shortcut = mutableTemplate.shortcut {
                shortcuts[shortcut] = mutableTemplate.id
            }
        }
        logger.info("Loaded \(self.templates.count) default templates")
    }

    // MARK: - Template Access

    /// Get all templates
    public func getAll() -> [MessageTemplate] {
        Array(templates.values).sorted { $0.name < $1.name }
    }

    /// Get templates by category
    public func getByCategory(_ category: String) -> [MessageTemplate] {
        getAll().filter { $0.category == category }
    }

    /// Get template by ID
    public func get(_ id: String) -> MessageTemplate? {
        templates[id]
    }

    /// Get template by shortcut
    public func getByShortcut(_ shortcut: String) -> MessageTemplate? {
        guard let id = shortcuts[shortcut] else { return nil }
        return templates[id]
    }

    /// Get all unique categories
    public func getCategories() -> [String] {
        let categories = Set(templates.values.compactMap { $0.category })
        return Array(categories).sorted()
    }

    /// Search templates by name or content
    public func search(_ query: String) -> [MessageTemplate] {
        let lowerQuery = query.lowercased()
        return getAll().filter {
            $0.name.lowercased().contains(lowerQuery) ||
            $0.content.lowercased().contains(lowerQuery)
        }
    }

    /// Get all shortcuts
    public func getShortcuts() -> [String: String] {
        shortcuts
    }

    // MARK: - Template CRUD

    /// Add a new template
    public func add(
        name: String,
        content: String,
        variables: [String]? = nil,
        shortcut: String? = nil,
        category: String? = nil
    ) -> MessageTemplate {
        let id = UUID().uuidString
        let now = Int(Date().timeIntervalSince1970)

        // Extract variables if not provided
        let vars = variables ?? extractVariables(from: content)

        let template = MessageTemplate(
            id: id,
            name: name,
            content: content,
            variables: vars,
            shortcut: shortcut,
            category: category,
            isDefault: false,
            createdAt: now,
            updatedAt: now
        )

        templates[id] = template

        if let shortcut = shortcut {
            // Remove any existing shortcut mapping
            removeShortcut(shortcut)
            shortcuts[shortcut] = id
        }

        logger.info("Added template: \(name)")
        return template
    }

    /// Update an existing template
    public func update(
        _ id: String,
        name: String? = nil,
        content: String? = nil,
        variables: [String]? = nil,
        shortcut: String? = nil,
        category: String? = nil
    ) -> MessageTemplate? {
        guard let template = templates[id] else { return nil }

        // Don't allow modifying default templates - create a copy instead
        if template.isDefault {
            return add(
                name: name ?? template.name,
                content: content ?? template.content,
                variables: variables ?? template.variables,
                shortcut: shortcut,
                category: category ?? template.category
            )
        }

        let now = Int(Date().timeIntervalSince1970)

        // Handle shortcut change
        if let newShortcut = shortcut, newShortcut != template.shortcut {
            if let oldShortcut = template.shortcut {
                shortcuts.removeValue(forKey: oldShortcut)
            }
            removeShortcut(newShortcut)
            shortcuts[newShortcut] = id
        }

        // Determine variables
        let newContent = content ?? template.content
        let vars = variables ?? (content != nil ? extractVariables(from: newContent) : template.variables)

        let updated = MessageTemplate(
            id: id,
            name: name ?? template.name,
            content: newContent,
            variables: vars,
            shortcut: shortcut ?? template.shortcut,
            category: category ?? template.category,
            isDefault: template.isDefault,
            createdAt: template.createdAt,
            updatedAt: now
        )

        templates[id] = updated
        logger.info("Updated template: \(id)")
        return updated
    }

    /// Delete a template
    public func delete(_ id: String) -> Bool {
        guard let template = templates[id] else { return false }

        // Don't allow deleting default templates
        if template.isDefault { return false }

        if let shortcut = template.shortcut {
            shortcuts.removeValue(forKey: shortcut)
        }

        templates.removeValue(forKey: id)
        logger.info("Deleted template: \(id)")
        return true
    }

    // MARK: - Template Application

    /// Apply template with context variables
    public func apply(_ template: MessageTemplate, context: TemplateContext) -> String {
        var content = template.content

        // Add automatic date/time if not provided
        let dateFormatter = DateFormatter()
        dateFormatter.dateStyle = .medium
        let timeFormatter = DateFormatter()
        timeFormatter.timeStyle = .short

        var fullContext = context.toDictionary()
        if fullContext["date"] == nil {
            fullContext["date"] = dateFormatter.string(from: Date())
        }
        if fullContext["time"] == nil {
            fullContext["time"] = timeFormatter.string(from: Date())
        }

        // Replace all variables
        for (key, value) in fullContext {
            let pattern = "\\{\\{\\s*\(key)\\s*\\}\\}"
            if let regex = try? NSRegularExpression(pattern: pattern, options: []) {
                let range = NSRange(content.startIndex..., in: content)
                content = regex.stringByReplacingMatches(
                    in: content,
                    options: [],
                    range: range,
                    withTemplate: value
                )
            }
        }

        // Remove any unreplaced variables
        if let regex = try? NSRegularExpression(pattern: "\\{\\{[^}]+\\}\\}", options: []) {
            let range = NSRange(content.startIndex..., in: content)
            content = regex.stringByReplacingMatches(
                in: content,
                options: [],
                range: range,
                withTemplate: ""
            )
        }

        return content
    }

    /// Apply template by ID
    public func applyById(_ id: String, context: TemplateContext) -> String? {
        guard let template = templates[id] else { return nil }
        return apply(template, context: context)
    }

    /// Apply template by shortcut
    public func applyByShortcut(_ shortcut: String, context: TemplateContext) -> String? {
        guard let template = getByShortcut(shortcut) else { return nil }
        return apply(template, context: context)
    }

    // MARK: - Helpers

    /// Extract variables from content
    public func extractVariables(from content: String) -> [String] {
        guard let regex = try? NSRegularExpression(pattern: "\\{\\{(\\w+)\\}\\}", options: []) else {
            return []
        }

        let range = NSRange(content.startIndex..., in: content)
        let matches = regex.matches(in: content, options: [], range: range)

        var variables = Set<String>()
        for match in matches {
            if let varRange = Range(match.range(at: 1), in: content) {
                variables.insert(String(content[varRange]))
            }
        }

        return Array(variables).sorted()
    }

    private func removeShortcut(_ shortcut: String) {
        if let existingId = shortcuts[shortcut] {
            if var template = templates[existingId], !template.isDefault {
                template = MessageTemplate(
                    id: template.id,
                    name: template.name,
                    content: template.content,
                    variables: template.variables,
                    shortcut: nil,
                    category: template.category,
                    isDefault: template.isDefault,
                    createdAt: template.createdAt,
                    updatedAt: Int(Date().timeIntervalSince1970)
                )
                templates[existingId] = template
            }
            shortcuts.removeValue(forKey: shortcut)
        }
    }

    // MARK: - Persistence

    /// Save templates to persistent storage
    public func save() throws {
        let customTemplates = templates.values.filter { !$0.isDefault }
        let encoder = JSONEncoder()
        let data = try encoder.encode(Array(customTemplates))
        UserDefaults.standard.set(data, forKey: "messaging_templates")
        logger.info("Saved \(customTemplates.count) custom templates")
    }

    /// Load templates from persistent storage
    public func load() throws {
        guard let data = UserDefaults.standard.data(forKey: "messaging_templates") else {
            return
        }

        let decoder = JSONDecoder()
        let customTemplates = try decoder.decode([MessageTemplate].self, from: data)

        for template in customTemplates {
            templates[template.id] = template
            if let shortcut = template.shortcut {
                shortcuts[shortcut] = template.id
            }
        }

        logger.info("Loaded \(customTemplates.count) custom templates")
    }

    /// Clear custom templates (keep defaults)
    public func clearCustom() {
        let customIds = templates.values.filter { !$0.isDefault }.map { $0.id }
        for id in customIds {
            if let template = templates[id], let shortcut = template.shortcut {
                shortcuts.removeValue(forKey: shortcut)
            }
            templates.removeValue(forKey: id)
        }
        logger.info("Cleared custom templates")
    }
}
