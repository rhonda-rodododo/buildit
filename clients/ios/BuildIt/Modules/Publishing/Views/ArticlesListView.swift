// ArticlesListView.swift
// BuildIt - Decentralized Mesh Communication
//
// Main list view for managing articles.

import SwiftUI

// Import localization
private typealias Strings = L10n.Publishing

// MARK: - Main List View

struct ArticlesListView: View {
    @ObservedObject var service: PublishingService
    @State private var searchText = ""
    @State private var selectedFilter: ArticleFilter = .all
    @State private var showingNewArticle = false
    @State private var showingSettings = false
    @State private var selectedArticle: Article?
    @State private var searchResults: [Article] = []
    @State private var isSearching = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Filter tabs
                FilterTabBar(selectedFilter: $selectedFilter)

                // Content
                if service.isLoading {
                    Spacer()
                    ProgressView("publishing_loadingArticles".localized)
                    Spacer()
                } else if !searchText.isEmpty && isSearching {
                    SearchResultsView(results: searchResults, service: service)
                } else if filteredArticles.isEmpty {
                    emptyState
                } else {
                    articlesList
                }
            }
            .navigationTitle(Strings.title)
            .searchable(text: $searchText, prompt: Text("publishing_searchPlaceholder".localized))
            .onChange(of: searchText) { _, newValue in
                performSearch(query: newValue)
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        showingSettings = true
                    } label: {
                        Image(systemName: "gearshape")
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        showingNewArticle = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingNewArticle) {
                ArticleEditorView(service: service, article: nil)
            }
            .sheet(isPresented: $showingSettings) {
                PublicationSettingsView(service: service)
            }
            .task {
                await service.refreshArticles()
                await service.refreshPublications()
            }
            .refreshable {
                await service.refreshArticles()
            }
        }
    }

    private var filteredArticles: [Article] {
        let allArticles = service.articles + service.drafts
        switch selectedFilter {
        case .all:
            return allArticles.sorted { ($0.updatedAt ?? $0.createdAt) > ($1.updatedAt ?? $1.createdAt) }
        case .published:
            return service.articles
        case .drafts:
            return service.drafts.filter { $0.status == .draft }
        case .scheduled:
            return service.drafts.filter { $0.status == .scheduled }
        case .archived:
            return allArticles.filter { $0.status == .archived }
        }
    }

    private var articlesList: some View {
        List {
            ForEach(filteredArticles) { article in
                NavigationLink {
                    ArticleEditorView(service: service, article: article)
                } label: {
                    ArticleRow(article: article)
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    if article.status == .draft {
                        Button {
                            Task {
                                _ = try? await service.publishArticle(article)
                            }
                        } label: {
                            Label("publishing_publish".localized, systemImage: "arrow.up.circle")
                        }
                        .tint(.green)
                    }

                    if article.status != .archived {
                        Button {
                            Task {
                                _ = try? await service.archiveArticle(article)
                            }
                        } label: {
                            Label("publishing_archive".localized, systemImage: "archivebox")
                        }
                        .tint(.orange)
                    }

                    Button(role: .destructive) {
                        Task {
                            try? await service.deleteArticle(article)
                        }
                    } label: {
                        Label(L10n.Common.delete, systemImage: "trash")
                    }
                }
            }
        }
        .listStyle(.plain)
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: emptyStateIcon)
                .font(.system(size: 64))
                .foregroundColor(.secondary)

            Text(emptyStateTitle)
                .font(.title2)
                .fontWeight(.semibold)

            Text(emptyStateMessage)
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            if selectedFilter == .all || selectedFilter == .drafts {
                Button {
                    showingNewArticle = true
                } label: {
                    Label("publishing_createArticle".localized, systemImage: "plus")
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding()
    }

    private var emptyStateIcon: String {
        switch selectedFilter {
        case .all, .drafts: return "doc.richtext"
        case .published: return "checkmark.circle"
        case .scheduled: return "clock"
        case .archived: return "archivebox"
        }
    }

    private var emptyStateTitle: String {
        switch selectedFilter {
        case .all: return "publishing_noArticles".localized
        case .published: return "publishing_noPublished".localized
        case .drafts: return "publishing_noDrafts".localized
        case .scheduled: return "publishing_noScheduled".localized
        case .archived: return "publishing_noArchived".localized
        }
    }

    private var emptyStateMessage: String {
        switch selectedFilter {
        case .all, .drafts:
            return "publishing_createFirstHint".localized
        case .published:
            return "publishing_publishedWillAppear".localized
        case .scheduled:
            return "publishing_scheduledWillAppear".localized
        case .archived:
            return "publishing_archivedWillAppear".localized
        }
    }

    private func performSearch(query: String) {
        guard !query.isEmpty else {
            isSearching = false
            searchResults = []
            return
        }

        isSearching = true
        Task {
            do {
                searchResults = try await service.searchArticles(query: query)
            } catch {
                searchResults = []
            }
        }
    }
}

// MARK: - Filter Tab Bar

enum ArticleFilter: String, CaseIterable {
    case all = "All"
    case published = "Published"
    case drafts = "Drafts"
    case scheduled = "Scheduled"
    case archived = "Archived"

    var icon: String {
        switch self {
        case .all: return "square.grid.2x2"
        case .published: return "checkmark.circle"
        case .drafts: return "doc"
        case .scheduled: return "clock"
        case .archived: return "archivebox"
        }
    }
}

struct FilterTabBar: View {
    @Binding var selectedFilter: ArticleFilter

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(ArticleFilter.allCases, id: \.self) { filter in
                    FilterChip(
                        title: filter.rawValue,
                        icon: filter.icon,
                        isSelected: selectedFilter == filter
                    ) {
                        selectedFilter = filter
                    }
                }
            }
            .padding(.horizontal)
        }
        .padding(.vertical, 8)
        .background(Color(.systemGroupedBackground))
    }
}

struct FilterChip: View {
    let title: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.caption)
                Text(title)
                    .font(.subheadline)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(isSelected ? Color.accentColor : Color.secondary.opacity(0.2))
            .foregroundColor(isSelected ? .white : .primary)
            .clipShape(Capsule())
        }
    }
}

// MARK: - Article Row

struct ArticleRow: View {
    let article: Article

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(article.title.isEmpty ? "publishing_untitled".localized : article.title)
                    .font(.headline)
                    .lineLimit(1)

                Spacer()

                StatusBadge(status: article.status)
            }

            if let subtitle = article.subtitle, !subtitle.isEmpty {
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }

            HStack {
                if !article.tags.isEmpty {
                    Label("\(article.tags.count)", systemImage: "tag")
                }

                Spacer()

                Label("\(article.readingTime) min", systemImage: "clock")

                Text(formatRelativeTime(article.updatedAt ?? article.createdAt))
            }
            .font(.caption)
            .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }

    private func formatRelativeTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

// MARK: - Status Badge

struct StatusBadge: View {
    let status: ArticleStatus

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: status.icon)
                .font(.caption2)
            Text(status.displayName)
                .font(.caption2)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(backgroundColor)
        .foregroundColor(foregroundColor)
        .clipShape(Capsule())
    }

    private var backgroundColor: Color {
        switch status {
        case .draft: return Color.gray.opacity(0.2)
        case .published: return Color.green.opacity(0.2)
        case .scheduled: return Color.orange.opacity(0.2)
        case .archived: return Color.secondary.opacity(0.2)
        }
    }

    private var foregroundColor: Color {
        switch status {
        case .draft: return .gray
        case .published: return .green
        case .scheduled: return .orange
        case .archived: return .secondary
        }
    }
}

// MARK: - Search Results View

struct SearchResultsView: View {
    let results: [Article]
    let service: PublishingService

    var body: some View {
        List {
            if results.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 40))
                        .foregroundColor(.secondary)
                    Text("common_noResults".localized)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 40)
            } else {
                ForEach(results) { article in
                    NavigationLink {
                        ArticleEditorView(service: service, article: article)
                    } label: {
                        ArticleRow(article: article)
                    }
                }
            }
        }
        .listStyle(.plain)
    }
}
