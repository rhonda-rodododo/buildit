// SearchView.swift
// BuildIt - Decentralized Mesh Communication
//
// Main search UI with query input, results, and facet filtering.

import SwiftUI

// MARK: - SearchView

/// Main search view
public struct SearchView: View {
    @State private var viewModel = SearchViewModel()
    @State private var showSaveDialog = false
    @State private var saveSearchName = ""
    @FocusState private var isSearchFocused: Bool

    public init() {}

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Search bar
                searchBar

                // Content
                Group {
                    switch viewModel.state {
                    case .idle:
                        idleView
                    case .searching:
                        loadingView
                    case .results:
                        resultsView
                    case .empty:
                        emptyResultsView
                    case .error(let message):
                        errorView(message: message)
                    }
                }
                .animation(.default, value: viewModel.state)
            }
            .navigationTitle(L10n.Search.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    filterButton
                }
            }
            .sheet(isPresented: $viewModel.showFilters) {
                FacetFilterView(viewModel: viewModel)
            }
            .alert(L10n.Search.saveSearch, isPresented: $showSaveDialog) {
                TextField(L10n.Search.searchName, text: $saveSearchName)
                Button(L10n.Common.cancel, role: .cancel) {
                    saveSearchName = ""
                }
                Button(L10n.Common.save) {
                    Task {
                        try? await viewModel.saveCurrentSearch(name: saveSearchName)
                        saveSearchName = ""
                    }
                }
            }
        }
    }

    // MARK: - Search Bar

    private var searchBar: some View {
        VStack(spacing: 8) {
            HStack(spacing: 12) {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)

                TextField(L10n.Search.placeholder, text: $viewModel.query)
                    .textFieldStyle(.plain)
                    .autocapitalization(.none)
                    .autocorrectionDisabled()
                    .focused($isSearchFocused)
                    .submitLabel(.search)
                    .onSubmit {
                        viewModel.search()
                    }

                if !viewModel.query.isEmpty {
                    Button {
                        viewModel.clear()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.secondary)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color(.systemGray6))
            .cornerRadius(10)
            .padding(.horizontal)
            .padding(.top, 8)

            // Active filters summary
            if viewModel.hasActiveFilters {
                activeFiltersBar
            }

            // Suggestions
            if isSearchFocused && !viewModel.suggestions.isEmpty {
                suggestionsView
            }
        }
    }

    private var activeFiltersBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(activeFilterChips, id: \.self) { chip in
                    filterChip(chip)
                }

                Button(L10n.Search.clearFilters) {
                    viewModel.clearFilters()
                }
                .font(.caption)
                .foregroundColor(.accentColor)
            }
            .padding(.horizontal)
        }
        .frame(height: 32)
    }

    private var activeFilterChips: [String] {
        var chips: [String] = []
        if let types = viewModel.filters.moduleTypes {
            chips.append(contentsOf: types.map { "Type: \($0)" })
        }
        if let tags = viewModel.filters.tags {
            chips.append(contentsOf: tags.map { "Tag: \($0)" })
        }
        if viewModel.filters.dateRange != nil {
            chips.append("Date range")
        }
        return chips
    }

    private func filterChip(_ text: String) -> some View {
        HStack(spacing: 4) {
            Text(text)
                .font(.caption)

            Image(systemName: "xmark")
                .font(.caption2)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color.accentColor.opacity(0.1))
        .foregroundColor(.accentColor)
        .cornerRadius(12)
    }

    private var suggestionsView: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(viewModel.suggestions.prefix(5), id: \.self) { suggestion in
                Button {
                    viewModel.query = suggestion
                    viewModel.search()
                    isSearchFocused = false
                } label: {
                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(.secondary)
                            .frame(width: 24)

                        Text(suggestion)
                            .foregroundColor(.primary)

                        Spacer()
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 10)
                }
            }
        }
        .background(Color(.systemBackground))
        .cornerRadius(10)
        .shadow(color: .black.opacity(0.1), radius: 5, y: 2)
        .padding(.horizontal)
    }

    // MARK: - Filter Button

    private var filterButton: some View {
        Button {
            viewModel.showFilters = true
        } label: {
            ZStack(alignment: .topTrailing) {
                Image(systemName: "line.3.horizontal.decrease.circle")
                    .font(.title3)

                if viewModel.activeFilterCount > 0 {
                    Text("\(viewModel.activeFilterCount)")
                        .font(.caption2)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                        .frame(width: 16, height: 16)
                        .background(Color.accentColor)
                        .clipShape(Circle())
                        .offset(x: 6, y: -6)
                }
            }
        }
    }

    // MARK: - Content Views

    private var idleView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Recent searches
                if !viewModel.recentSearches.isEmpty {
                    recentSearchesSection
                }

                // Saved searches
                if !viewModel.savedSearches.isEmpty {
                    savedSearchesSection
                }

                // Search tips
                searchTipsSection
            }
            .padding()
        }
    }

    private var recentSearchesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(L10n.Search.recentSearches)
                .font(.headline)

            ForEach(viewModel.recentSearches.prefix(5)) { recent in
                Button {
                    viewModel.executeRecentSearch(recent)
                } label: {
                    HStack {
                        Image(systemName: "clock")
                            .foregroundColor(.secondary)

                        Text(recent.query)
                            .foregroundColor(.primary)

                        Spacer()

                        Text("\(recent.resultCount)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 8)
                }
            }
        }
    }

    private var savedSearchesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(L10n.Search.savedSearches)
                .font(.headline)

            ForEach(viewModel.savedSearches.prefix(5)) { saved in
                Button {
                    viewModel.executeSavedSearch(saved)
                } label: {
                    HStack {
                        Image(systemName: "bookmark.fill")
                            .foregroundColor(.accentColor)

                        Text(saved.name)
                            .foregroundColor(.primary)

                        Spacer()

                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 8)
                }
            }
        }
    }

    private var searchTipsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(L10n.Search.tips)
                .font(.headline)

            VStack(alignment: .leading, spacing: 8) {
                tipRow(icon: "quote.opening", text: L10n.Search.tipPhrase)
                tipRow(icon: "tag", text: L10n.Search.tipTag)
                tipRow(icon: "person", text: L10n.Search.tipAuthor)
                tipRow(icon: "calendar", text: L10n.Search.tipDate)
            }
            .font(.subheadline)
            .foregroundColor(.secondary)
        }
    }

    private func tipRow(icon: String, text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: icon)
                .frame(width: 20)
            Text(text)
        }
    }

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)
            Text(L10n.Search.searching)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var resultsView: some View {
        VStack(spacing: 0) {
            // Results header
            HStack {
                Text("\(viewModel.totalCount) \(L10n.Search.results)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                Spacer()

                if !viewModel.query.isEmpty {
                    Button {
                        showSaveDialog = true
                    } label: {
                        Image(systemName: "bookmark")
                            .font(.subheadline)
                    }
                }

                Text(String(format: "%.0fms", viewModel.searchTimeMs))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal)
            .padding(.vertical, 8)

            Divider()

            // Results list
            List {
                ForEach(viewModel.results) { result in
                    SearchResultRow(result: result)
                }

                // Load more
                if viewModel.results.count < viewModel.totalCount {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding()
                        .onAppear {
                            viewModel.loadMore()
                        }
                }
            }
            .listStyle(.plain)
        }
    }

    private var emptyResultsView: some View {
        ContentUnavailableView {
            Label(L10n.Search.noResults, systemImage: "magnifyingglass")
        } description: {
            Text(L10n.Search.noResultsDescription)
        } actions: {
            Button(L10n.Search.clearFilters) {
                viewModel.clearFilters()
            }
            .buttonStyle(.bordered)
        }
    }

    private func errorView(message: String) -> some View {
        ContentUnavailableView {
            Label(L10n.Search.error, systemImage: "exclamationmark.triangle")
        } description: {
            Text(message)
        } actions: {
            Button(L10n.Common.retry) {
                viewModel.search()
            }
            .buttonStyle(.borderedProminent)
        }
    }
}

// MARK: - L10n Search Extensions

extension L10n {
    enum Search {
        static let title = NSLocalizedString("search_title", comment: "")
        static let placeholder = NSLocalizedString("search_placeholder", comment: "")
        static let searching = NSLocalizedString("search_searching", comment: "")
        static let results = NSLocalizedString("search_results", comment: "")
        static let noResults = NSLocalizedString("search_noResults", comment: "")
        static let noResultsDescription = NSLocalizedString("search_noResultsDescription", comment: "")
        static let recentSearches = NSLocalizedString("search_recentSearches", comment: "")
        static let savedSearches = NSLocalizedString("search_savedSearches", comment: "")
        static let saveSearch = NSLocalizedString("search_saveSearch", comment: "")
        static let searchName = NSLocalizedString("search_searchName", comment: "")
        static let clearFilters = NSLocalizedString("search_clearFilters", comment: "")
        static let tips = NSLocalizedString("search_tips", comment: "")
        static let tipPhrase = NSLocalizedString("search_tipPhrase", comment: "")
        static let tipTag = NSLocalizedString("search_tipTag", comment: "")
        static let tipAuthor = NSLocalizedString("search_tipAuthor", comment: "")
        static let tipDate = NSLocalizedString("search_tipDate", comment: "")
        static let error = NSLocalizedString("search_error", comment: "")
        static let filters = NSLocalizedString("search_filters", comment: "")
        static let moduleTypes = NSLocalizedString("search_moduleTypes", comment: "")
        static let tags = NSLocalizedString("search_tags", comment: "")
        static let dateRange = NSLocalizedString("search_dateRange", comment: "")
        static let startDate = NSLocalizedString("search_startDate", comment: "")
        static let endDate = NSLocalizedString("search_endDate", comment: "")
        static let applyFilters = NSLocalizedString("search_applyFilters", comment: "")
    }

    enum Common {
        static let cancel = NSLocalizedString("common_cancel", comment: "")
        static let save = NSLocalizedString("common_save", comment: "")
        static let retry = NSLocalizedString("common_retry", comment: "")
        static let done = NSLocalizedString("common_done", comment: "")
    }
}

// MARK: - Preview

#Preview {
    SearchView()
}
