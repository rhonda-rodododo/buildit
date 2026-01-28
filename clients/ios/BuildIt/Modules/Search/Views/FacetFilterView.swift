// FacetFilterView.swift
// BuildIt - Decentralized Mesh Communication
//
// Filter sidebar for refining search results by facets.

import SwiftUI

// MARK: - FacetFilterView

/// Facet filter sidebar/sheet
public struct FacetFilterView: View {
    @Bindable var viewModel: SearchViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var selectedModuleTypes: Set<String> = []
    @State private var selectedTags: Set<String> = []
    @State private var startDate: Date?
    @State private var endDate: Date?
    @State private var showDatePicker = false

    public init(viewModel: SearchViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        NavigationStack {
            List {
                // Module type filters
                moduleTypeSection

                // Tag filters
                if let tagCounts = viewModel.facetCounts?.tags, !tagCounts.isEmpty {
                    tagSection(tagCounts)
                }

                // Date range filter
                dateRangeSection

                // Group filters
                if let groupCounts = viewModel.facetCounts?.groups, !groupCounts.isEmpty {
                    groupSection(groupCounts)
                }

                // Author filters
                if let authorCounts = viewModel.facetCounts?.authors, !authorCounts.isEmpty {
                    authorSection(authorCounts)
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle(L10n.Search.filters)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.Common.cancel) {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button(L10n.Search.applyFilters) {
                        applyFilters()
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
            .onAppear {
                loadCurrentFilters()
            }
        }
    }

    // MARK: - Module Type Section

    private var moduleTypeSection: some View {
        Section {
            ForEach(moduleTypes, id: \.self) { moduleType in
                moduleTypeRow(moduleType)
            }
        } header: {
            Text(L10n.Search.moduleTypes)
        }
    }

    private var moduleTypes: [String] {
        if let counts = viewModel.facetCounts?.moduleType {
            return Array(counts.keys).sorted()
        }
        return ["events", "documents", "messaging", "wiki", "governance", "mutual-aid"]
    }

    private func moduleTypeRow(_ moduleType: String) -> some View {
        Button {
            if selectedModuleTypes.contains(moduleType) {
                selectedModuleTypes.remove(moduleType)
            } else {
                selectedModuleTypes.insert(moduleType)
            }
        } label: {
            HStack {
                Image(systemName: iconForModuleType(moduleType))
                    .foregroundColor(colorForModuleType(moduleType))
                    .frame(width: 24)

                Text(moduleType.capitalized)
                    .foregroundColor(.primary)

                Spacer()

                if let count = viewModel.facetCounts?.moduleType?[moduleType] {
                    Text("\(count)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                if selectedModuleTypes.contains(moduleType) {
                    Image(systemName: "checkmark")
                        .foregroundColor(.accentColor)
                }
            }
        }
    }

    // MARK: - Tag Section

    private func tagSection(_ tagCounts: [String: Int]) -> some View {
        Section {
            ForEach(Array(tagCounts.keys.sorted().prefix(10)), id: \.self) { tag in
                tagRow(tag, count: tagCounts[tag] ?? 0)
            }
        } header: {
            Text(L10n.Search.tags)
        }
    }

    private func tagRow(_ tag: String, count: Int) -> some View {
        Button {
            if selectedTags.contains(tag) {
                selectedTags.remove(tag)
            } else {
                selectedTags.insert(tag)
            }
        } label: {
            HStack {
                Image(systemName: "tag")
                    .foregroundColor(.secondary)
                    .frame(width: 24)

                Text(tag)
                    .foregroundColor(.primary)

                Spacer()

                Text("\(count)")
                    .font(.caption)
                    .foregroundColor(.secondary)

                if selectedTags.contains(tag) {
                    Image(systemName: "checkmark")
                        .foregroundColor(.accentColor)
                }
            }
        }
    }

    // MARK: - Date Range Section

    private var dateRangeSection: some View {
        Section {
            // Start date
            HStack {
                Text(L10n.Search.startDate)

                Spacer()

                if let start = startDate {
                    Text(start.formatted(date: .abbreviated, time: .omitted))
                        .foregroundColor(.secondary)

                    Button {
                        startDate = nil
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.secondary)
                    }
                } else {
                    Button("Select") {
                        showDatePicker = true
                    }
                    .foregroundColor(.accentColor)
                }
            }

            // End date
            HStack {
                Text(L10n.Search.endDate)

                Spacer()

                if let end = endDate {
                    Text(end.formatted(date: .abbreviated, time: .omitted))
                        .foregroundColor(.secondary)

                    Button {
                        endDate = nil
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.secondary)
                    }
                } else {
                    Button("Select") {
                        showDatePicker = true
                    }
                    .foregroundColor(.accentColor)
                }
            }

            // Quick date presets
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    datePresetButton("Today", start: Calendar.current.startOfDay(for: Date()), end: Date())
                    datePresetButton("This Week", start: startOfWeek, end: Date())
                    datePresetButton("This Month", start: startOfMonth, end: Date())
                    datePresetButton("Last 30 Days", start: Date().addingTimeInterval(-30 * 86400), end: Date())
                }
                .padding(.vertical, 4)
            }
        } header: {
            Text(L10n.Search.dateRange)
        }
        .sheet(isPresented: $showDatePicker) {
            DateRangePickerSheet(startDate: $startDate, endDate: $endDate)
        }
    }

    private func datePresetButton(_ label: String, start: Date, end: Date) -> some View {
        Button {
            startDate = start
            endDate = end
        } label: {
            Text(label)
                .font(.caption)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color(.systemGray5))
                .cornerRadius(8)
        }
    }

    private var startOfWeek: Date {
        Calendar.current.date(from: Calendar.current.dateComponents([.yearForWeekOfYear, .weekOfYear], from: Date())) ?? Date()
    }

    private var startOfMonth: Date {
        Calendar.current.date(from: Calendar.current.dateComponents([.year, .month], from: Date())) ?? Date()
    }

    // MARK: - Group Section

    private func groupSection(_ groupCounts: [String: Int]) -> some View {
        Section {
            ForEach(Array(groupCounts.keys.sorted().prefix(10)), id: \.self) { groupId in
                HStack {
                    Image(systemName: "person.2")
                        .foregroundColor(.secondary)
                        .frame(width: 24)

                    Text(groupId)
                        .foregroundColor(.primary)

                    Spacer()

                    Text("\(groupCounts[groupId] ?? 0)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        } header: {
            Text("Groups")
        }
    }

    // MARK: - Author Section

    private func authorSection(_ authorCounts: [String: Int]) -> some View {
        Section {
            ForEach(Array(authorCounts.keys.sorted().prefix(10)), id: \.self) { author in
                HStack {
                    Image(systemName: "person.circle")
                        .foregroundColor(.secondary)
                        .frame(width: 24)

                    Text(author.prefix(8) + "...")
                        .foregroundColor(.primary)

                    Spacer()

                    Text("\(authorCounts[author] ?? 0)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        } header: {
            Text("Authors")
        }
    }

    // MARK: - Helpers

    private func iconForModuleType(_ type: String) -> String {
        switch type {
        case "events": return "calendar"
        case "messaging", "messages": return "message"
        case "documents": return "doc.text"
        case "wiki": return "book"
        case "governance": return "checkmark.seal"
        case "mutual-aid", "mutualaid": return "hands.sparkles"
        case "fundraising": return "dollarsign.circle"
        case "forms": return "list.bullet.clipboard"
        case "contacts", "crm": return "person.crop.circle"
        default: return "square.grid.2x2"
        }
    }

    private func colorForModuleType(_ type: String) -> Color {
        switch type {
        case "events": return .blue
        case "messaging", "messages": return .green
        case "documents": return .orange
        case "wiki": return .purple
        case "governance": return .indigo
        case "mutual-aid", "mutualaid": return .pink
        case "fundraising": return .yellow
        case "forms": return .teal
        case "contacts", "crm": return .cyan
        default: return .gray
        }
    }

    private func loadCurrentFilters() {
        selectedModuleTypes = Set(viewModel.filters.moduleTypes ?? [])
        selectedTags = Set(viewModel.filters.tags ?? [])
        if let dateRange = viewModel.filters.dateRange {
            startDate = Date(timeIntervalSince1970: Double(dateRange.start) / 1000)
            endDate = Date(timeIntervalSince1970: Double(dateRange.end) / 1000)
        }
    }

    private func applyFilters() {
        viewModel.filters.moduleTypes = selectedModuleTypes.isEmpty ? nil : Array(selectedModuleTypes)
        viewModel.filters.tags = selectedTags.isEmpty ? nil : Array(selectedTags)

        if let start = startDate, let end = endDate {
            viewModel.filters.dateRange = DateRangeFilter(start: start, end: end)
        } else {
            viewModel.filters.dateRange = nil
        }

        viewModel.search()
    }
}

// MARK: - Date Range Picker Sheet

struct DateRangePickerSheet: View {
    @Binding var startDate: Date?
    @Binding var endDate: Date?
    @Environment(\.dismiss) private var dismiss

    @State private var selectedStart = Date()
    @State private var selectedEnd = Date()
    @State private var selectingStart = true

    var body: some View {
        NavigationStack {
            VStack {
                Picker("Select", selection: $selectingStart) {
                    Text("Start Date").tag(true)
                    Text("End Date").tag(false)
                }
                .pickerStyle(.segmented)
                .padding()

                DatePicker(
                    selectingStart ? "Start Date" : "End Date",
                    selection: selectingStart ? $selectedStart : $selectedEnd,
                    displayedComponents: .date
                )
                .datePickerStyle(.graphical)
                .padding()

                Spacer()
            }
            .navigationTitle("Select Date Range")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Apply") {
                        startDate = selectedStart
                        endDate = selectedEnd
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
            .onAppear {
                if let start = startDate {
                    selectedStart = start
                }
                if let end = endDate {
                    selectedEnd = end
                }
            }
        }
    }
}

// MARK: - Preview

#Preview {
    FacetFilterView(viewModel: SearchViewModel())
}
