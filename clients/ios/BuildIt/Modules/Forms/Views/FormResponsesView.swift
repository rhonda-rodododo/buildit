// FormResponsesView.swift
// BuildIt - Decentralized Mesh Communication
//
// View collected form responses.

import SwiftUI

private typealias Strings = L10n.Forms

// MARK: - Form Responses View

struct FormResponsesView: View {
    let form: FormDefinition
    @ObservedObject var service: FormsService
    @Environment(\.dismiss) private var dismiss

    @State private var responses: [FormResponse] = []
    @State private var statistics: FormStatistics?
    @State private var isLoading = true
    @State private var selectedTab = 0
    @State private var selectedResponse: FormResponse?
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Tab selector
                Picker("forms_view".localized, selection: $selectedTab) {
                    Text("\("forms_responses".localized) (\(responses.count))").tag(0)
                    Text("forms_summary".localized).tag(1)
                }
                .pickerStyle(.segmented)
                .padding()

                if isLoading {
                    Spacer()
                    ProgressView("forms_loadingResponses".localized)
                    Spacer()
                } else if selectedTab == 0 {
                    responsesListView
                } else {
                    summaryView
                }
            }
            .navigationTitle("forms_responses".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("forms_done".localized) {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button(action: exportResponses) {
                            Label("forms_exportCsv".localized, systemImage: "square.and.arrow.up")
                        }

                        Button(action: refreshData) {
                            Label("forms_refresh".localized, systemImage: "arrow.clockwise")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            .sheet(item: $selectedResponse) { response in
                ResponseDetailView(form: form, response: response)
            }
            .task {
                await loadData()
            }
            .alert("forms_error".localized, isPresented: .init(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("forms_ok".localized) { errorMessage = nil }
            } message: {
                Text(errorMessage ?? L10n.Common.error)
            }
        }
    }

    // MARK: - Responses List

    private var responsesListView: some View {
        Group {
            if responses.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "tray")
                        .font(.system(size: 64))
                        .foregroundColor(.secondary)

                    Text("forms_noResponsesYet".localized)
                        .font(.title2)
                        .fontWeight(.semibold)

                    Text("forms_responsesWillAppear".localized)
                        .font(.body)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
                .padding()
            } else {
                List(responses) { response in
                    Button(action: { selectedResponse = response }) {
                        ResponseRow(form: form, response: response)
                    }
                    .buttonStyle(.plain)
                }
                .listStyle(.plain)
            }
        }
    }

    // MARK: - Summary View

    private var summaryView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Overview stats
                overviewSection

                Divider()

                // Field-by-field breakdown
                if let stats = statistics {
                    ForEach(form.fields) { field in
                        if let fieldStats = stats.fieldStatistics[field.id] {
                            FieldStatsView(field: field, stats: fieldStats)
                        }
                    }
                }
            }
            .padding()
        }
    }

    private var overviewSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("forms_overview".localized)
                .font(.headline)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 16) {
                StatCard(
                    title: "forms_totalResponses".localized,
                    value: "\(responses.count)",
                    icon: "person.3"
                )

                StatCard(
                    title: "forms_completionRate".localized,
                    value: "\(Int((statistics?.completionRate ?? 1.0) * 100))%",
                    icon: "checkmark.circle"
                )

                if let avgTime = statistics?.averageCompletionTime {
                    StatCard(
                        title: "forms_avgTime".localized,
                        value: formatDuration(avgTime),
                        icon: "clock"
                    )
                }

                StatCard(
                    title: "forms_fieldsSection".localized,
                    value: "\(form.fields.count)",
                    icon: "list.bullet"
                )
            }
        }
    }

    // MARK: - Actions

    private func loadData() async {
        isLoading = true
        defer { isLoading = false }

        do {
            responses = try await service.getResponses(formId: form.id)
            statistics = try await service.getStatistics(formId: form.id)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func refreshData() {
        Task {
            await loadData()
        }
    }

    private func exportResponses() {
        // In production: generate and share CSV
    }

    private func formatDuration(_ duration: TimeInterval) -> String {
        let minutes = Int(duration / 60)
        if minutes < 1 {
            return "forms_lessThanOneMin".localized
        } else if minutes == 1 {
            return "forms_oneMin".localized
        } else {
            return "forms_minutes".localized(minutes)
        }
    }
}

// MARK: - Response Row

struct ResponseRow: View {
    let form: FormDefinition
    let response: FormResponse

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                // Respondent info
                if response.respondent.anonymous {
                    Label("forms_anonymous".localized, systemImage: "person.fill.questionmark")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                } else if let name = response.respondent.displayName {
                    Label(name, systemImage: "person")
                        .font(.subheadline)
                } else if let pubkey = response.respondent.pubkey {
                    Label(String(pubkey.prefix(8)) + "...", systemImage: "key")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                Spacer()

                Text(formatDate(response.submittedAt))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            // Preview of answers
            let previewAnswers = response.answers.prefix(2)
            ForEach(Array(previewAnswers.enumerated()), id: \.offset) { _, answer in
                if let field = form.fields.first(where: { $0.id == answer.fieldId }) {
                    HStack {
                        Text(field.label + ":")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        Text(answer.value)
                            .font(.caption)
                            .lineLimit(1)
                    }
                }
            }

            if response.answers.count > 2 {
                Text("forms_moreFields".localized(response.answers.count - 2))
                    .font(.caption)
                    .foregroundColor(.accentColor)
            }
        }
        .padding(.vertical, 4)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

// MARK: - Stat Card

struct StatCard: View {
    let title: String
    let value: String
    let icon: String

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(.accentColor)

            Text(value)
                .font(.title2)
                .fontWeight(.bold)

            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.secondary.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Field Stats View

struct FieldStatsView: View {
    let field: FormField
    let stats: FieldStatistics

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: field.type.icon)
                    .foregroundColor(.accentColor)

                Text(field.label)
                    .font(.headline)

                Spacer()

                Text("forms_responsesCount".localized(stats.responseCount))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            // Type-specific visualization
            switch field.type {
            case .select, .radio, .multiselect, .checkbox:
                if let counts = stats.optionCounts {
                    optionCountsView(counts)
                }

            case .number, .rating, .scale:
                numericStatsView

            default:
                // For text fields, just show response count
                Text("forms_textResponsesCollected".localized)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color.secondary.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func optionCountsView(_ counts: [String: Int]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            let total = counts.values.reduce(0, +)
            let sortedOptions = counts.sorted { $0.value > $1.value }

            ForEach(sortedOptions, id: \.key) { option, count in
                HStack {
                    Text(getOptionLabel(for: option))
                        .font(.subheadline)

                    Spacer()

                    Text("\(count)")
                        .font(.subheadline)
                        .fontWeight(.medium)

                    if total > 0 {
                        Text("(\(Int(Double(count) / Double(total) * 100))%)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                // Progress bar
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        Rectangle()
                            .fill(Color.secondary.opacity(0.2))
                            .frame(height: 8)

                        Rectangle()
                            .fill(Color.accentColor)
                            .frame(width: total > 0 ? geometry.size.width * CGFloat(count) / CGFloat(total) : 0, height: 8)
                    }
                    .clipShape(Capsule())
                }
                .frame(height: 8)
            }
        }
    }

    private var numericStatsView: some View {
        HStack(spacing: 24) {
            if let avg = stats.averageValue {
                VStack {
                    Text(String(format: "%.1f", avg))
                        .font(.title3)
                        .fontWeight(.bold)
                    Text("forms_average".localized)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            if let min = stats.minValue {
                VStack {
                    Text(String(format: "%.0f", min))
                        .font(.title3)
                        .fontWeight(.bold)
                    Text("forms_min".localized)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            if let max = stats.maxValue {
                VStack {
                    Text(String(format: "%.0f", max))
                        .font(.title3)
                        .fontWeight(.bold)
                    Text("forms_max".localized)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
    }

    private func getOptionLabel(for value: String) -> String {
        field.options?.first { $0.value == value }?.label ?? value
    }
}

// MARK: - Response Detail View

struct ResponseDetailView: View {
    let form: FormDefinition
    let response: FormResponse
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Respondent info
                    respondentSection

                    Divider()

                    // Answers
                    ForEach(form.fields) { field in
                        if let answer = response.answer(for: field.id) {
                            answerSection(field: field, answer: answer)
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("forms_responseDetails".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("forms_done".localized) {
                        dismiss()
                    }
                }
            }
        }
    }

    private var respondentSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("forms_submittedBy".localized)
                .font(.caption)
                .foregroundColor(.secondary)

            HStack {
                if response.respondent.anonymous {
                    Label("forms_anonymous".localized, systemImage: "person.fill.questionmark")
                } else if let name = response.respondent.displayName {
                    Label(name, systemImage: "person")
                } else if let pubkey = response.respondent.pubkey {
                    Label(pubkey, systemImage: "key")
                        .font(.system(.body, design: .monospaced))
                }

                Spacer()

                Text(formatDate(response.submittedAt))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }

    private func answerSection(field: FormField, answer: FieldAnswer) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: field.type.icon)
                    .foregroundColor(.accentColor)
                    .frame(width: 20)

                Text(field.label)
                    .font(.headline)
            }

            // Display value based on field type
            switch field.type {
            case .multiselect, .checkbox:
                if let values = answer.values {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(values, id: \.self) { value in
                            HStack {
                                Image(systemName: "checkmark")
                                    .foregroundColor(.green)
                                    .font(.caption)

                                Text(getOptionLabel(field: field, value: value))
                            }
                        }
                    }
                } else {
                    Text(answer.value)
                }

            case .rating:
                HStack {
                    let rating = Int(answer.value) ?? 0
                    let maxRating = field.scaleConfig?.max ?? 5
                    ForEach(1...maxRating, id: \.self) { star in
                        Image(systemName: star <= rating ? "star.fill" : "star")
                            .foregroundColor(star <= rating ? .yellow : .secondary)
                    }
                    Text("(\(rating)/\(maxRating))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

            case .select, .radio:
                Text(getOptionLabel(field: field, value: answer.value))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.accentColor.opacity(0.1))
                    .clipShape(Capsule())

            case .date, .datetime:
                if let date = ISO8601DateFormatter().date(from: answer.value) {
                    Text(formatDate(date))
                } else {
                    Text(answer.value)
                }

            case .url:
                if let url = URL(string: answer.value) {
                    Link(answer.value, destination: url)
                        .font(.body)
                } else {
                    Text(answer.value)
                }

            default:
                Text(answer.value)
                    .font(.body)
            }

            Divider()
        }
    }

    private func getOptionLabel(field: FormField, value: String) -> String {
        field.options?.first { $0.value == value }?.label ?? value
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Preview

#Preview {
    FormResponsesView(
        form: FormDefinition(
            title: "Event Feedback",
            fields: [
                .text(label: "Name", required: true),
                .rating(label: "Overall Rating")
            ],
            createdBy: "user-1"
        ),
        service: FormsService(store: try! FormsStore())
    )
}
