// CourseDetailView.swift
// BuildIt - Decentralized Mesh Communication
//
// Detailed view for a training course with modules and lessons.

import SwiftUI

/// Course detail view with modules and progress
public struct CourseDetailView: View {
    let course: CourseEntity
    @ObservedObject var store: TrainingStore
    let manager: TrainingManager

    @Environment(\.dismiss) private var dismiss
    @State private var modules: [ModuleEntity] = []
    @State private var lessonsPerModule: [String: [LessonEntity]] = [:]
    @State private var courseProgress: CourseProgress?
    @State private var selectedLesson: LessonEntity?
    @State private var isLoading = true
    @State private var errorMessage: String?

    public init(course: CourseEntity, store: TrainingStore, manager: TrainingManager) {
        self.course = course
        self.store = store
        self.manager = manager
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Course header
                    courseHeader

                    Divider()

                    // Progress section
                    if let progress = courseProgress {
                        progressSection(progress)
                        Divider()
                    }

                    // Modules section
                    if isLoading {
                        ProgressView()
                            .frame(maxWidth: .infinity, minHeight: 100)
                    } else {
                        modulesSection
                    }
                }
                .padding()
            }
            .navigationTitle("Course Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .sheet(item: $selectedLesson) { lesson in
                LessonPlayerView(lesson: lesson, store: store, manager: manager)
            }
            .task {
                await loadData()
            }
            .alert("Error", isPresented: .constant(errorMessage != nil)) {
                Button("OK") { errorMessage = nil }
            } message: {
                if let error = errorMessage {
                    Text(error)
                }
            }
        }
    }

    private var courseHeader: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Course image
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
            .frame(height: 180)
            .cornerRadius(12)
            .clipped()

            // Category and difficulty
            HStack {
                if let category = CourseCategory(rawValue: course.category) {
                    Label(category.displayName, systemImage: category.iconName)
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.accentColor.opacity(0.2))
                        .foregroundColor(.accentColor)
                        .cornerRadius(6)
                }

                Spacer()

                if let difficulty = CourseDifficulty(rawValue: course.difficulty) {
                    Text(difficulty.displayName)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            // Title
            Text(course.title)
                .font(.title2)
                .fontWeight(.bold)

            // Description
            Text(course.courseDescription)
                .font(.body)
                .foregroundColor(.secondary)

            // Course metadata
            HStack(spacing: 20) {
                Label("\(Int(course.estimatedHours)) hours", systemImage: "clock")
                Label("\(modules.count) modules", systemImage: "folder")

                if course.certificationEnabled {
                    Label("Certificate", systemImage: "checkmark.seal")
                        .foregroundColor(.green)
                }
            }
            .font(.caption)
            .foregroundColor(.secondary)

            // Start/Continue button
            Button {
                if let firstModule = modules.first,
                   let firstLesson = lessonsPerModule[firstModule.id]?.first {
                    selectedLesson = firstLesson
                }
            } label: {
                HStack {
                    Image(systemName: courseProgress == nil ? "play.fill" : "arrow.right")
                    Text(courseProgress == nil ? "Start Course" : "Continue")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .padding(.top, 8)
        }
    }

    private func progressSection(_ progress: CourseProgress) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Your Progress")
                .font(.headline)

            // Progress bar
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("\(progress.percentComplete)% Complete")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    Spacer()
                    Text("\(progress.lessonsCompleted)/\(progress.totalLessons) lessons")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color(.systemGray5))
                            .frame(height: 8)

                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.accentColor)
                            .frame(width: geometry.size.width * CGFloat(progress.percentComplete) / 100, height: 8)
                    }
                }
                .frame(height: 8)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }

    private var modulesSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Course Content")
                .font(.headline)

            ForEach(modules, id: \.id) { module in
                ModuleRow(
                    module: module,
                    lessons: lessonsPerModule[module.id] ?? [],
                    store: store,
                    onLessonTap: { lesson in
                        selectedLesson = lesson
                    }
                )
            }
        }
    }

    private var coursePlaceholder: some View {
        ZStack {
            LinearGradient(
                colors: [.accentColor.opacity(0.3), .accentColor.opacity(0.1)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            if let category = CourseCategory(rawValue: course.category) {
                Image(systemName: category.iconName)
                    .font(.system(size: 50))
                    .foregroundColor(.accentColor)
            }
        }
    }

    private func loadData() async {
        isLoading = true
        defer { isLoading = false }

        do {
            // Load modules
            modules = try store.getModules(courseId: course.id)

            // Load lessons for each module
            for module in modules {
                lessonsPerModule[module.id] = try store.getLessons(moduleId: module.id)
            }

            // Load progress
            courseProgress = try await manager.getCourseProgress(course.id)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Module Row

struct ModuleRow: View {
    let module: ModuleEntity
    let lessons: [LessonEntity]
    @ObservedObject var store: TrainingStore
    let onLessonTap: (LessonEntity) -> Void

    @State private var isExpanded = true

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Module header
            Button {
                withAnimation {
                    isExpanded.toggle()
                }
            } label: {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(module.title)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(.primary)

                        HStack(spacing: 8) {
                            Text("\(lessons.count) lessons")
                            Text("~\(module.estimatedMinutes) min")
                        }
                        .font(.caption)
                        .foregroundColor(.secondary)
                    }

                    Spacer()

                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding()
                .background(Color(.systemGray6))
            }

            // Lessons list
            if isExpanded {
                VStack(spacing: 0) {
                    ForEach(lessons, id: \.id) { lesson in
                        LessonRow(lesson: lesson, store: store)
                            .onTapGesture {
                                onLessonTap(lesson)
                            }

                        if lesson.id != lessons.last?.id {
                            Divider()
                                .padding(.leading, 48)
                        }
                    }
                }
                .background(Color(.systemBackground))
            }
        }
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color(.systemGray5), lineWidth: 1)
        )
    }
}

// MARK: - Lesson Row

struct LessonRow: View {
    let lesson: LessonEntity
    @ObservedObject var store: TrainingStore

    var body: some View {
        HStack(spacing: 12) {
            // Completion status
            completionIndicator

            // Lesson info
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    if let type = LessonType(rawValue: lesson.type) {
                        Image(systemName: type.iconName)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Text(lesson.title)
                        .font(.subheadline)
                        .lineLimit(1)
                }

                HStack {
                    Text("\(lesson.estimatedMinutes) min")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    if lesson.requiredForCertification {
                        Text("Required")
                            .font(.caption2)
                            .foregroundColor(.orange)
                    }
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .contentShape(Rectangle())
    }

    private var completionIndicator: some View {
        Group {
            if let progress = store.lessonProgress[lesson.id],
               progress.status == ProgressStatus.completed.rawValue {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green)
            } else if let progress = store.lessonProgress[lesson.id],
                      progress.status == ProgressStatus.inProgress.rawValue {
                Image(systemName: "circle.lefthalf.filled")
                    .foregroundColor(.accentColor)
            } else {
                Image(systemName: "circle")
                    .foregroundColor(.secondary)
            }
        }
        .font(.title3)
    }
}

// MARK: - Preview

#Preview {
    let store = try! TrainingStore()
    let manager = TrainingManager(store: store)

    let course = CourseEntity(
        id: "test",
        title: "Digital Security Basics",
        courseDescription: "Learn the fundamentals of digital security and privacy.",
        category: "digital-security",
        difficulty: "beginner",
        estimatedHours: 2.5,
        createdBy: "test"
    )

    return CourseDetailView(course: course, store: store, manager: manager)
}
