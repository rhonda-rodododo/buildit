// CourseListView.swift
// BuildIt - Decentralized Mesh Communication
//
// List view for displaying training courses.

import SwiftUI

/// Main course list view
public struct CourseListView: View {
    @ObservedObject var store: TrainingStore
    let manager: TrainingManager

    @State private var selectedCategory: CourseCategory?
    @State private var searchQuery = ""
    @State private var showCreateCourse = false
    @State private var selectedCourse: CourseEntity?

    public init(store: TrainingStore, manager: TrainingManager) {
        self.store = store
        self.manager = manager
    }

    public var body: some View {
        NavigationStack {
            Group {
                if store.courses.isEmpty && !store.isLoading {
                    emptyState
                } else {
                    courseContent
                }
            }
            .navigationTitle("Training")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            showCreateCourse = true
                        } label: {
                            Label("Create Course", systemImage: "plus")
                        }
                    } label: {
                        Image(systemName: "plus.circle.fill")
                    }
                }
            }
            .sheet(isPresented: $showCreateCourse) {
                Text("Create Course View")
                    .navigationTitle("Create Course")
            }
            .sheet(item: $selectedCourse) { course in
                CourseDetailView(course: course, store: store, manager: manager)
            }
            .refreshable {
                await store.loadCourses()
            }
            .task {
                await store.loadCourses()
            }
        }
        .searchable(text: $searchQuery, prompt: Text("Search courses"))
    }

    private var courseContent: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Category filter
                categoryFilter

                // Course grid
                if store.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 200)
                } else {
                    courseGrid
                }
            }
            .padding()
        }
    }

    private var categoryFilter: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                CategoryPill(
                    title: "All",
                    isSelected: selectedCategory == nil,
                    action: { selectedCategory = nil }
                )

                ForEach(CourseCategory.allCases, id: \.self) { category in
                    CategoryPill(
                        title: category.displayName,
                        icon: category.iconName,
                        isSelected: selectedCategory == category,
                        action: { selectedCategory = category }
                    )
                }
            }
        }
    }

    private var courseGrid: some View {
        LazyVGrid(columns: [
            GridItem(.flexible(), spacing: 16),
            GridItem(.flexible(), spacing: 16)
        ], spacing: 16) {
            ForEach(filteredCourses) { course in
                CourseCard(course: course)
                    .onTapGesture {
                        selectedCourse = course
                    }
            }
        }
    }

    private var filteredCourses: [CourseEntity] {
        var courses = store.getPublishedCourses()

        if let category = selectedCategory {
            courses = courses.filter { $0.category == category.rawValue }
        }

        if !searchQuery.isEmpty {
            courses = courses.filter { course in
                course.title.localizedCaseInsensitiveContains(searchQuery) ||
                course.courseDescription.localizedCaseInsensitiveContains(searchQuery)
            }
        }

        return courses
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("No Courses", systemImage: "book.closed")
        } description: {
            Text("No training courses are available yet.")
        } actions: {
            Button("Create Course") {
                showCreateCourse = true
            }
            .buttonStyle(.borderedProminent)
        }
    }
}

// MARK: - Category Pill

struct CategoryPill: View {
    let title: String
    var icon: String?
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.caption)
                }
                Text(title)
                    .font(.subheadline)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(isSelected ? Color.accentColor : Color(.systemGray5))
            .foregroundColor(isSelected ? .white : .primary)
            .cornerRadius(20)
        }
    }
}

// MARK: - Course Card

struct CourseCard: View {
    let course: CourseEntity

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Course image or placeholder
            ZStack {
                if let imageUrl = course.imageUrl, let url = URL(string: imageUrl) {
                    AsyncImage(url: url) { image in
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    } placeholder: {
                        coursePlaceholder
                    }
                } else {
                    coursePlaceholder
                }
            }
            .frame(height: 100)
            .cornerRadius(8)
            .clipped()

            // Course info
            VStack(alignment: .leading, spacing: 6) {
                // Category badge
                HStack {
                    if let category = CourseCategory(rawValue: course.category) {
                        Text(category.displayName)
                            .font(.caption2)
                            .fontWeight(.medium)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.accentColor.opacity(0.2))
                            .foregroundColor(.accentColor)
                            .cornerRadius(4)
                    }

                    Spacer()

                    // Difficulty indicator
                    if let difficulty = CourseDifficulty(rawValue: course.difficulty) {
                        Text(difficulty.displayName)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }

                // Title
                Text(course.title)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .lineLimit(2)

                // Duration
                HStack(spacing: 4) {
                    Image(systemName: "clock")
                        .font(.caption2)
                    Text("\(Int(course.estimatedHours))h")
                        .font(.caption2)

                    if course.certificationEnabled {
                        Spacer()
                        Image(systemName: "checkmark.seal.fill")
                            .font(.caption2)
                            .foregroundColor(.green)
                    }
                }
                .foregroundColor(.secondary)
            }
        }
        .padding(12)
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
    }

    private var coursePlaceholder: some View {
        ZStack {
            Color.accentColor.opacity(0.2)
            if let category = CourseCategory(rawValue: course.category) {
                Image(systemName: category.iconName)
                    .font(.system(size: 30))
                    .foregroundColor(.accentColor)
            } else {
                Image(systemName: "book.fill")
                    .font(.system(size: 30))
                    .foregroundColor(.accentColor)
            }
        }
    }
}

// MARK: - Preview

#Preview {
    CourseListView(
        store: try! TrainingStore(),
        manager: TrainingManager(store: try! TrainingStore())
    )
}
