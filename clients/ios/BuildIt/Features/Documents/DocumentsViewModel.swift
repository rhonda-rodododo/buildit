// DocumentsViewModel.swift
// BuildIt - Decentralized Mesh Communication
//
// ViewModel for document browsing and viewing.

import Foundation
import Combine
import os.log

/// Document model
struct Document: Identifiable, Equatable {
    let id: String
    let title: String
    let content: String
    let type: DocumentType
    let createdAt: Date
    let updatedAt: Date
    let groupId: String?

    enum DocumentType {
        case markdown
        case plainText
        case richText
    }
}

/// ViewModel for Documents feature
@MainActor
class DocumentsViewModel: ObservableObject {
    // MARK: - Published Properties

    @Published var documents: [Document] = []
    @Published var selectedDocument: Document?
    @Published var isLoading = false
    @Published var searchQuery = ""
    @Published var error: String?

    // MARK: - Private Properties

    private let logger = Logger(subsystem: "com.buildit", category: "DocumentsViewModel")
    private var allDocuments: [Document] = []

    // MARK: - Initialization

    init() {
        loadDocuments()
    }

    // MARK: - Public Methods

    /// Loads documents from local storage and synced groups
    func loadDocuments() {
        isLoading = true
        defer { isLoading = false }

        // Sample documents for now
        // In production, this would fetch from local storage and group sync
        allDocuments = [
            Document(
                id: UUID().uuidString,
                title: "Getting Started Guide",
                content: """
                # Getting Started with BuildIt

                Welcome to BuildIt, a privacy-first organizing platform.

                ## Key Features

                - **End-to-end encryption** - All messages are encrypted
                - **BLE mesh networking** - Works without internet
                - **Decentralized** - No central server required

                ## Quick Start

                1. Create your identity
                2. Connect with nearby devices
                3. Join or create a group
                4. Start organizing!
                """,
                type: .markdown,
                createdAt: Date().addingTimeInterval(-86400),
                updatedAt: Date(),
                groupId: nil
            ),
            Document(
                id: UUID().uuidString,
                title: "Meeting Notes - Jan 20",
                content: """
                # Weekly Sync Meeting

                **Date:** January 20, 2026
                **Attendees:** Alice, Bob, Charlie

                ## Agenda

                1. Project updates
                2. Upcoming events
                3. Action items

                ## Discussion

                - Reviewed progress on community outreach
                - Discussed venue for next event
                - Assigned tasks for the week

                ## Action Items

                - [ ] Alice: Contact venue
                - [ ] Bob: Update flyers
                - [ ] Charlie: Send reminder emails
                """,
                type: .markdown,
                createdAt: Date().addingTimeInterval(-172800),
                updatedAt: Date().addingTimeInterval(-86400),
                groupId: "group-1"
            )
        ]

        documents = allDocuments
        logger.info("Loaded \(self.documents.count) documents")
    }

    /// Searches documents by title or content
    func search() {
        if searchQuery.isEmpty {
            documents = allDocuments
        } else {
            documents = allDocuments.filter { doc in
                doc.title.localizedCaseInsensitiveContains(searchQuery) ||
                doc.content.localizedCaseInsensitiveContains(searchQuery)
            }
        }
    }

    /// Selects a document to view
    func selectDocument(_ document: Document) {
        selectedDocument = document
    }

    /// Clears the selected document
    func clearSelection() {
        selectedDocument = nil
    }

    /// Refreshes the document list
    func refresh() {
        loadDocuments()
    }

    /// Clears error state
    func clearError() {
        error = nil
    }
}
