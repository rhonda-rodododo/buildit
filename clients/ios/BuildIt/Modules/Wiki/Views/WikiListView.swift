// WikiListView.swift
// BuildIt - Decentralized Mesh Communication
//
// Main list view for wiki pages.

import SwiftUI

// Import localization
private typealias Strings = L10n.Wiki

// MARK: - Main List View

struct WikiListView: View {
    @ObservedObject var service: WikiService
    @State private var searchText = ""
    @State private var selectedCategory: WikiCategory?
    @State private var searchResults: [WikiSearchResult] = []
    @State private var isSearching = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Category filter
                if !service.categories.isEmpty {
                    CategoryRow(
                        categories: service.categories,
                        selectedCategory: $selectedCategory
                    )
                }

                // Content
                if service.isLoading {
                    Spacer()
                    ProgressView("wiki_loadingPages".localized)
                    Spacer()
                } else if !searchText.isEmpty && isSearching {
                    SearchResultsList(results: searchResults, service: service)
                } else if filteredPages.isEmpty {
                    emptyState
                } else {
                    pagesList
                }
            }
            .navigationTitle(Strings.title)
            .searchable(text: $searchText, prompt: Text(Strings.search))
            .onChange(of: searchText) { _, newValue in
                performSearch(query: newValue)
            }
            .task {
                await service.refreshPages()
                await service.refreshCategories(groupId: "default-group")
            }
            .refreshable {
                await service.refreshPages()
            }
        }
    }

    private var filteredPages: [WikiPage] {
        if let category = selectedCategory {
            return service.pages.filter { $0.categoryId == category.id }
        }
        return service.pages
    }

    private var pagesList: some View {
        List {
            // Recent section
            if selectedCategory == nil && !service.recentPages.isEmpty {
                Section("wiki_recentlyUpdated".localized) {
                    ForEach(service.recentPages.prefix(3)) { page in
                        NavigationLink(destination: WikiPageView(page: page, service: service)) {
                            PageRow(page: page, showCategory: true)
                        }
                    }
                }
            }

            // All pages section
            Section(selectedCategory?.name ?? "wiki_allPages".localized) {
                ForEach(filteredPages) { page in
                    NavigationLink(destination: WikiPageView(page: page, service: service)) {
                        PageRow(page: page, showCategory: selectedCategory == nil)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "books.vertical")
                .font(.system(size: 64))
                .foregroundColor(.secondary)

            Text(Strings.noPages)
                .font(.title2)
                .fontWeight(.semibold)

            Text("wiki_pagesWillAppear".localized)
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
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
                searchResults = try await service.searchPages(query: query)
            } catch {
                searchResults = []
            }
        }
    }
}

// MARK: - Category Row

struct CategoryRow: View {
    let categories: [WikiCategory]
    @Binding var selectedCategory: WikiCategory?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                CategoryChip(
                    name: "common_all".localized,
                    icon: "square.grid.2x2",
                    isSelected: selectedCategory == nil
                ) {
                    selectedCategory = nil
                }

                ForEach(categories) { category in
                    CategoryChip(
                        name: category.name,
                        icon: category.icon ?? "folder",
                        isSelected: selectedCategory?.id == category.id
                    ) {
                        selectedCategory = category
                    }
                }
            }
            .padding(.horizontal)
        }
        .padding(.vertical, 8)
        .background(Color(.systemGroupedBackground))
    }
}

struct CategoryChip: View {
    let name: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.caption)
                Text(name)
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

// MARK: - Page Row

struct PageRow: View {
    let page: WikiPage
    let showCategory: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(page.title)
                .font(.headline)
                .lineLimit(1)

            if let summary = page.summary {
                Text(summary)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }

            HStack {
                if !page.tags.isEmpty {
                    Label("\(page.tags.count) tags", systemImage: "tag")
                }

                Spacer()

                Label("\(page.readingTime) min read", systemImage: "clock")

                if let updated = page.updatedAt {
                    Text(formatRelativeTime(updated))
                }
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

// MARK: - Search Results List

struct SearchResultsList: View {
    let results: [WikiSearchResult]
    let service: WikiService
    @State private var expandedResults: [WikiPage] = []

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
                ForEach(results) { result in
                    NavigationLink {
                        WikiPageViewBySlug(slug: result.slug, service: service)
                    } label: {
                        SearchResultRow(result: result)
                    }
                }
            }
        }
        .listStyle(.plain)
    }
}

struct SearchResultRow: View {
    let result: WikiSearchResult

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(result.title)
                .font(.headline)
                .lineLimit(1)

            if let excerpt = result.excerpt {
                Text(excerpt)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(3)
            } else if let summary = result.summary {
                Text(summary)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }

            if !result.matchedTags.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 4) {
                        ForEach(result.matchedTags, id: \.self) { tag in
                            Text(tag)
                                .font(.caption2)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.accentColor.opacity(0.2))
                                .clipShape(Capsule())
                        }
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Wiki Page View by Slug

struct WikiPageViewBySlug: View {
    let slug: String
    let service: WikiService
    @State private var page: WikiPage?
    @State private var isLoading = true

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
            } else if let page = page {
                WikiPageView(page: page, service: service)
            } else {
                Text("wiki_pageNotFound".localized)
                    .foregroundColor(.secondary)
            }
        }
        .task {
            do {
                page = try await service.getPageBySlug(slug: slug, groupId: "default-group")
            } catch {
                // Handle error
            }
            isLoading = false
        }
    }
}
