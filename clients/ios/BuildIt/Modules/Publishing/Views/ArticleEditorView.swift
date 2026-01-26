// ArticleEditorView.swift
// BuildIt - Decentralized Mesh Communication
//
// Rich text editor for articles with markdown support.

import SwiftUI

private typealias Strings = L10n.Publishing

struct ArticleEditorView: View {
    @ObservedObject var service: PublishingService
    let article: Article?

    @Environment(\.dismiss) private var dismiss

    // Editor state
    @State private var title: String = ""
    @State private var subtitle: String = ""
    @State private var content: String = ""
    @State private var excerpt: String = ""
    @State private var coverImage: String = ""
    @State private var tags: [String] = []
    @State private var categories: [String] = []
    @State private var visibility: ArticleVisibility = .public
    @State private var canonicalUrl: String = ""
    @State private var seo: SEOMetadata = SEOMetadata()

    // UI state
    @State private var showingPreview = false
    @State private var showingSEOEditor = false
    @State private var showingScheduler = false
    @State private var showingTagEditor = false
    @State private var showingMetadata = false
    @State private var newTag = ""
    @State private var isSaving = false
    @State private var hasUnsavedChanges = false
    @State private var showingDiscardAlert = false
    @State private var editorMode: EditorMode = .edit
    @State private var scheduledDate = Date().addingTimeInterval(3600) // 1 hour from now

    @FocusState private var focusedField: EditorField?

    enum EditorField {
        case title, subtitle, content
    }

    enum EditorMode {
        case edit, preview, split
    }

    var isNewArticle: Bool {
        article == nil
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Editor mode toggle
                Picker("Mode", selection: $editorMode) {
                    Text("publishing_edit".localized).tag(EditorMode.edit)
                    Text("publishing_preview".localized).tag(EditorMode.preview)
                    Text("publishing_split".localized).tag(EditorMode.split)
                }
                .pickerStyle(.segmented)
                .padding()

                // Editor content
                switch editorMode {
                case .edit:
                    editorView
                case .preview:
                    previewView
                case .split:
                    splitView
                }
            }
            .navigationTitle(isNewArticle ? "publishing_newArticle".localized : "publishing_editArticle".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("publishing_cancel".localized) {
                        if hasUnsavedChanges {
                            showingDiscardAlert = true
                        } else {
                            dismiss()
                        }
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button {
                            saveAsDraft()
                        } label: {
                            Label("publishing_saveDraft".localized, systemImage: "doc")
                        }

                        Button {
                            showingPreview = true
                        } label: {
                            Label("publishing_preview".localized, systemImage: "eye")
                        }

                        Divider()

                        Button {
                            showingScheduler = true
                        } label: {
                            Label("publishing_schedule".localized, systemImage: "clock")
                        }

                        Button {
                            publishNow()
                        } label: {
                            Label("publishing_publishNow".localized, systemImage: "arrow.up.circle")
                        }
                    } label: {
                        if isSaving {
                            ProgressView()
                        } else {
                            Text("publishing_save".localized)
                                .fontWeight(.semibold)
                        }
                    }
                    .disabled(title.isEmpty)
                }
            }
            .alert("publishing_discardChanges".localized, isPresented: $showingDiscardAlert) {
                Button("publishing_discard".localized, role: .destructive) {
                    dismiss()
                }
                Button("publishing_keepEditing".localized, role: .cancel) { }
            } message: {
                Text("publishing_unsavedChangesMessage".localized)
            }
            .sheet(isPresented: $showingPreview) {
                ArticlePreviewView(
                    title: title,
                    subtitle: subtitle,
                    content: content,
                    coverImage: coverImage,
                    tags: tags,
                    authorName: article?.authorName
                )
            }
            .sheet(isPresented: $showingSEOEditor) {
                SEOEditorView(seo: $seo, title: title, excerpt: excerpt)
            }
            .sheet(isPresented: $showingScheduler) {
                ScheduleView(date: $scheduledDate) {
                    scheduleArticle()
                }
            }
            .onAppear {
                loadArticle()
            }
            .onChange(of: title) { _, _ in hasUnsavedChanges = true }
            .onChange(of: content) { _, _ in hasUnsavedChanges = true }
        }
    }

    // MARK: - Editor Views

    private var editorView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Title
                TextField("publishing_articleTitle".localized, text: $title, axis: .vertical)
                    .font(.title.bold())
                    .focused($focusedField, equals: .title)

                // Subtitle
                TextField("publishing_subtitleOptional".localized, text: $subtitle, axis: .vertical)
                    .font(.title3)
                    .foregroundColor(.secondary)
                    .focused($focusedField, equals: .subtitle)

                Divider()

                // Formatting toolbar
                formattingToolbar

                // Content editor
                TextEditor(text: $content)
                    .font(.body)
                    .frame(minHeight: 400)
                    .focused($focusedField, equals: .content)

                Divider()

                // Metadata section
                metadataSection
            }
            .padding()
        }
    }

    private var previewView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Cover image
                if !coverImage.isEmpty {
                    AsyncImage(url: URL(string: coverImage)) { image in
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    } placeholder: {
                        Rectangle()
                            .fill(Color.gray.opacity(0.3))
                    }
                    .frame(height: 200)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                // Title
                Text(title.isEmpty ? "publishing_untitled".localized : title)
                    .font(.largeTitle.bold())

                // Subtitle
                if !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.title3)
                        .foregroundColor(.secondary)
                }

                // Tags
                if !tags.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(tags, id: \.self) { tag in
                                Text(tag)
                                    .font(.caption)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.accentColor.opacity(0.2))
                                    .clipShape(Capsule())
                            }
                        }
                    }
                }

                Divider()

                // Rendered markdown content
                MarkdownRenderer(content: content)
            }
            .padding()
        }
    }

    private var splitView: some View {
        GeometryReader { geometry in
            HStack(spacing: 0) {
                // Editor
                ScrollView {
                    TextEditor(text: $content)
                        .font(.system(.body, design: .monospaced))
                        .frame(minHeight: geometry.size.height - 40)
                }
                .frame(width: geometry.size.width / 2)

                Divider()

                // Preview
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        if !title.isEmpty {
                            Text(title)
                                .font(.title2.bold())
                        }
                        MarkdownRenderer(content: content)
                    }
                    .padding()
                }
                .frame(width: geometry.size.width / 2)
            }
        }
    }

    // MARK: - Formatting Toolbar

    private var formattingToolbar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                FormatButton(icon: "bold", label: "Bold") {
                    insertMarkdown("**", "**")
                }

                FormatButton(icon: "italic", label: "Italic") {
                    insertMarkdown("*", "*")
                }

                FormatButton(icon: "strikethrough", label: "Strike") {
                    insertMarkdown("~~", "~~")
                }

                Divider()
                    .frame(height: 20)

                FormatButton(icon: "text.quote", label: "Quote") {
                    insertMarkdown("> ", "")
                }

                FormatButton(icon: "chevron.left.forwardslash.chevron.right", label: "Code") {
                    insertMarkdown("`", "`")
                }

                FormatButton(icon: "list.bullet", label: "List") {
                    insertMarkdown("- ", "")
                }

                FormatButton(icon: "list.number", label: "Numbered") {
                    insertMarkdown("1. ", "")
                }

                Divider()
                    .frame(height: 20)

                Menu {
                    Button("publishing_heading1".localized) { insertMarkdown("# ", "") }
                    Button("publishing_heading2".localized) { insertMarkdown("## ", "") }
                    Button("publishing_heading3".localized) { insertMarkdown("### ", "") }
                } label: {
                    Label("publishing_heading".localized, systemImage: "textformat.size")
                        .font(.caption)
                }

                FormatButton(icon: "link", label: "Link") {
                    insertMarkdown("[", "](url)")
                }

                FormatButton(icon: "photo", label: "Image") {
                    insertMarkdown("![alt](", ")")
                }
            }
            .padding(.vertical, 8)
        }
    }

    // MARK: - Metadata Section

    private var metadataSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Cover image
            VStack(alignment: .leading, spacing: 8) {
                Text("publishing_coverImage".localized)
                    .font(.headline)

                HStack {
                    TextField("publishing_imageUrl".localized, text: $coverImage)
                        .textFieldStyle(.roundedBorder)

                    if !coverImage.isEmpty {
                        Button {
                            coverImage = ""
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }

            // Tags
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("publishing_tags".localized)
                        .font(.headline)

                    Spacer()

                    Button("publishing_add".localized) {
                        showingTagEditor = true
                    }
                    .font(.caption)
                }

                if tags.isEmpty {
                    Text("publishing_noTagsAdded".localized)
                        .font(.caption)
                        .foregroundColor(.secondary)
                } else {
                    FlowLayout(spacing: 6) {
                        ForEach(tags, id: \.self) { tag in
                            HStack(spacing: 4) {
                                Text(tag)
                                Button {
                                    tags.removeAll { $0 == tag }
                                } label: {
                                    Image(systemName: "xmark")
                                        .font(.caption2)
                                }
                            }
                            .font(.caption)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.accentColor.opacity(0.2))
                            .clipShape(Capsule())
                        }
                    }
                }
            }
            .alert("publishing_addTag".localized, isPresented: $showingTagEditor) {
                TextField("publishing_tagName".localized, text: $newTag)
                Button("publishing_add".localized) {
                    if !newTag.isEmpty && !tags.contains(newTag) {
                        tags.append(newTag)
                        newTag = ""
                    }
                }
                Button(L10n.Common.cancel, role: .cancel) {
                    newTag = ""
                }
            }

            // Excerpt
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("publishing_excerpt".localized)
                        .font(.headline)

                    Spacer()

                    Text("\(excerpt.count)/1024")
                        .font(.caption)
                        .foregroundColor(excerpt.count > 1024 ? .red : .secondary)
                }

                TextField("publishing_briefDescription".localized, text: $excerpt, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(3...6)
            }

            // Visibility
            VStack(alignment: .leading, spacing: 8) {
                Text("publishing_visibility".localized)
                    .font(.headline)

                Picker("publishing_visibility".localized, selection: $visibility) {
                    ForEach([ArticleVisibility.public, .group, .private], id: \.self) { vis in
                        Label(vis.displayName, systemImage: vis.icon)
                            .tag(vis)
                    }
                }
                .pickerStyle(.segmented)
            }

            // SEO
            Button {
                showingSEOEditor = true
            } label: {
                HStack {
                    VStack(alignment: .leading) {
                        Text("publishing_seoSettings".localized)
                            .font(.headline)
                        Text(seo.isConfigured ? "publishing_configured".localized : "publishing_notConfigured".localized)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .foregroundColor(.secondary)
                }
            }
            .foregroundColor(.primary)

            // Canonical URL
            VStack(alignment: .leading, spacing: 8) {
                Text("publishing_canonicalUrl".localized)
                    .font(.headline)
                Text("publishing_canonicalUrlHint".localized)
                    .font(.caption)
                    .foregroundColor(.secondary)

                TextField("https://...", text: $canonicalUrl)
                    .textFieldStyle(.roundedBorder)
                    .keyboardType(.URL)
                    .autocapitalization(.none)
            }
        }
    }

    // MARK: - Actions

    private func loadArticle() {
        guard let article = article else { return }

        title = article.title
        subtitle = article.subtitle ?? ""
        content = article.content
        excerpt = article.excerpt ?? ""
        coverImage = article.coverImage ?? ""
        tags = article.tags
        categories = article.categories
        visibility = article.visibility
        canonicalUrl = article.canonicalUrl ?? ""
        seo = article.seo

        hasUnsavedChanges = false
    }

    private func saveAsDraft() {
        Task {
            isSaving = true
            defer { isSaving = false }

            do {
                let authorPubkey = await CryptoManager.shared.getPublicKeyHex() ?? ""

                if var existingArticle = article {
                    existingArticle.title = title
                    existingArticle.subtitle = subtitle.isEmpty ? nil : subtitle
                    existingArticle.content = content
                    existingArticle.excerpt = excerpt.isEmpty ? nil : excerpt
                    existingArticle.coverImage = coverImage.isEmpty ? nil : coverImage
                    existingArticle.tags = tags
                    existingArticle.categories = categories
                    existingArticle.visibility = visibility
                    existingArticle.canonicalUrl = canonicalUrl.isEmpty ? nil : canonicalUrl
                    existingArticle.seo = seo

                    _ = try await service.updateArticle(existingArticle)
                } else {
                    var newArticle = Article(
                        title: title,
                        content: content,
                        authorPubkey: authorPubkey
                    )
                    newArticle.subtitle = subtitle.isEmpty ? nil : subtitle
                    newArticle.excerpt = excerpt.isEmpty ? nil : excerpt
                    newArticle.coverImage = coverImage.isEmpty ? nil : coverImage
                    newArticle.tags = tags
                    newArticle.categories = categories
                    newArticle.visibility = visibility
                    newArticle.canonicalUrl = canonicalUrl.isEmpty ? nil : canonicalUrl
                    newArticle.seo = seo

                    _ = try await service.createArticle(
                        title: title,
                        content: content,
                        authorPubkey: authorPubkey
                    )
                }

                hasUnsavedChanges = false
                dismiss()
            } catch {
                // Handle error
            }
        }
    }

    private func publishNow() {
        Task {
            isSaving = true
            defer { isSaving = false }

            do {
                let authorPubkey = await CryptoManager.shared.getPublicKeyHex() ?? ""

                var articleToPublish: Article

                if var existingArticle = article {
                    existingArticle.title = title
                    existingArticle.subtitle = subtitle.isEmpty ? nil : subtitle
                    existingArticle.content = content
                    existingArticle.excerpt = excerpt.isEmpty ? nil : excerpt
                    existingArticle.coverImage = coverImage.isEmpty ? nil : coverImage
                    existingArticle.tags = tags
                    existingArticle.categories = categories
                    existingArticle.visibility = visibility
                    existingArticle.canonicalUrl = canonicalUrl.isEmpty ? nil : canonicalUrl
                    existingArticle.seo = seo

                    articleToPublish = try await service.updateArticle(existingArticle)
                } else {
                    articleToPublish = try await service.createArticle(
                        title: title,
                        content: content,
                        authorPubkey: authorPubkey
                    )
                }

                _ = try await service.publishArticle(articleToPublish)
                hasUnsavedChanges = false
                dismiss()
            } catch {
                // Handle error
            }
        }
    }

    private func scheduleArticle() {
        Task {
            isSaving = true
            defer { isSaving = false }

            do {
                let authorPubkey = await CryptoManager.shared.getPublicKeyHex() ?? ""

                var articleToSchedule: Article

                if var existingArticle = article {
                    existingArticle.title = title
                    existingArticle.subtitle = subtitle.isEmpty ? nil : subtitle
                    existingArticle.content = content
                    articleToSchedule = try await service.updateArticle(existingArticle)
                } else {
                    articleToSchedule = try await service.createArticle(
                        title: title,
                        content: content,
                        authorPubkey: authorPubkey
                    )
                }

                _ = try await service.scheduleArticle(articleToSchedule, publishAt: scheduledDate)
                hasUnsavedChanges = false
                dismiss()
            } catch {
                // Handle error
            }
        }
    }

    private func insertMarkdown(_ prefix: String, _ suffix: String) {
        content += prefix + suffix
    }
}

// MARK: - Format Button

struct FormatButton: View {
    let icon: String
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.callout)
                .frame(width: 32, height: 32)
                .background(Color.secondary.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 6))
        }
        .accessibilityLabel(label)
    }
}

// MARK: - Schedule View

struct ScheduleView: View {
    @Binding var date: Date
    let onSchedule: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                DatePicker(
                    "publishing_publishDate".localized,
                    selection: $date,
                    in: Date()...,
                    displayedComponents: [.date, .hourAndMinute]
                )
                .datePickerStyle(.graphical)

                Section {
                    Text("publishing_articleAutoPublished".localized)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle("publishing_schedulePublication".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(L10n.Common.cancel) {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("publishing_schedule".localized) {
                        onSchedule()
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
    }
}

// MARK: - SEO Editor View

struct SEOEditorView: View {
    @Binding var seo: SEOMetadata
    let title: String
    let excerpt: String
    @Environment(\.dismiss) private var dismiss

    @State private var newKeyword = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("publishing_metaTitle".localized) {
                    TextField("publishing_customTitleSeo".localized, text: Binding(
                        get: { seo.metaTitle ?? "" },
                        set: { seo.metaTitle = $0.isEmpty ? nil : $0 }
                    ))

                    HStack {
                        Text("\(seo.metaTitleCharCount)/60")
                            .font(.caption)
                            .foregroundColor(seo.metaTitleCharCount > 60 ? .red : .secondary)

                        Spacer()

                        if seo.metaTitle == nil {
                            Button("publishing_useTitle".localized) {
                                seo.metaTitle = title
                            }
                            .font(.caption)
                        }
                    }
                }

                Section("publishing_metaDescription".localized) {
                    TextField("publishing_descriptionSearchResults".localized, text: Binding(
                        get: { seo.metaDescription ?? "" },
                        set: { seo.metaDescription = $0.isEmpty ? nil : $0 }
                    ), axis: .vertical)
                    .lineLimit(3...5)

                    HStack {
                        Text("\(seo.metaDescriptionCharCount)/160")
                            .font(.caption)
                            .foregroundColor(seo.metaDescriptionCharCount > 160 ? .red : .secondary)

                        Spacer()

                        if seo.metaDescription == nil && !excerpt.isEmpty {
                            Button("publishing_useExcerpt".localized) {
                                seo.metaDescription = String(excerpt.prefix(160))
                            }
                            .font(.caption)
                        }
                    }
                }

                Section("publishing_openGraphImage".localized) {
                    TextField("publishing_imageSocialSharing".localized, text: Binding(
                        get: { seo.ogImage ?? "" },
                        set: { seo.ogImage = $0.isEmpty ? nil : $0 }
                    ))
                    .keyboardType(.URL)
                    .autocapitalization(.none)
                }

                Section("publishing_keywords".localized) {
                    ForEach(seo.keywords, id: \.self) { keyword in
                        HStack {
                            Text(keyword)
                            Spacer()
                            Button {
                                seo.keywords.removeAll { $0 == keyword }
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundColor(.secondary)
                            }
                        }
                    }

                    HStack {
                        TextField("publishing_addKeyword".localized, text: $newKeyword)

                        Button("publishing_add".localized) {
                            if !newKeyword.isEmpty && !seo.keywords.contains(newKeyword) {
                                seo.keywords.append(newKeyword)
                                newKeyword = ""
                            }
                        }
                        .disabled(newKeyword.isEmpty || seo.keywords.count >= 10)
                    }

                    Text("\(seo.keywords.count)/10 \("publishing_keywords".localized)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle("publishing_seoSettings".localized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("publishing_done".localized) {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Markdown Renderer

struct MarkdownRenderer: View {
    let content: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(Array(parseMarkdown().enumerated()), id: \.offset) { _, element in
                element
            }
        }
    }

    private func parseMarkdown() -> [AnyView] {
        var views: [AnyView] = []
        let lines = content.components(separatedBy: .newlines)

        var currentParagraph = ""
        var inCodeBlock = false
        var codeBlockContent = ""

        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            // Code block handling
            if trimmed.hasPrefix("```") {
                if inCodeBlock {
                    views.append(AnyView(codeBlock(codeBlockContent)))
                    codeBlockContent = ""
                }
                inCodeBlock.toggle()
                continue
            }

            if inCodeBlock {
                codeBlockContent += (codeBlockContent.isEmpty ? "" : "\n") + line
                continue
            }

            // Headers
            if trimmed.hasPrefix("#") {
                if !currentParagraph.isEmpty {
                    views.append(AnyView(paragraph(currentParagraph)))
                    currentParagraph = ""
                }

                var level = 0
                var title = trimmed
                while title.hasPrefix("#") {
                    level += 1
                    title = String(title.dropFirst())
                }
                title = title.trimmingCharacters(in: .whitespaces)

                views.append(AnyView(header(title, level: level)))
                continue
            }

            // Bullet points
            if trimmed.hasPrefix("- ") || trimmed.hasPrefix("* ") {
                if !currentParagraph.isEmpty {
                    views.append(AnyView(paragraph(currentParagraph)))
                    currentParagraph = ""
                }

                let bullet = String(trimmed.dropFirst(2))
                views.append(AnyView(bulletPoint(bullet)))
                continue
            }

            // Empty line = paragraph break
            if trimmed.isEmpty {
                if !currentParagraph.isEmpty {
                    views.append(AnyView(paragraph(currentParagraph)))
                    currentParagraph = ""
                }
                continue
            }

            // Regular text
            currentParagraph += (currentParagraph.isEmpty ? "" : " ") + trimmed
        }

        // Remaining paragraph
        if !currentParagraph.isEmpty {
            views.append(AnyView(paragraph(currentParagraph)))
        }

        return views
    }

    private func header(_ text: String, level: Int) -> some View {
        Text(text)
            .font(level == 1 ? .title2 : level == 2 ? .title3 : .headline)
            .fontWeight(.bold)
            .padding(.top, level == 1 ? 16 : 8)
    }

    private func paragraph(_ text: String) -> some View {
        Text(text)
            .font(.body)
    }

    private func bulletPoint(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text("-")
                .foregroundColor(.secondary)
            Text(text)
        }
        .font(.body)
    }

    private func codeBlock(_ code: String) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            Text(code)
                .font(.system(.body, design: .monospaced))
                .padding()
        }
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

// MARK: - Flow Layout

struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(
            in: proposal.replacingUnspecifiedDimensions().width,
            subviews: subviews,
            spacing: spacing
        )
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(
            in: bounds.width,
            subviews: subviews,
            spacing: spacing
        )

        for (index, subview) in subviews.enumerated() {
            let point = result.positions[index]
            subview.place(at: CGPoint(x: bounds.minX + point.x, y: bounds.minY + point.y), proposal: .unspecified)
        }
    }

    struct FlowResult {
        var size: CGSize = .zero
        var positions: [CGPoint] = []

        init(in maxWidth: CGFloat, subviews: Subviews, spacing: CGFloat) {
            var x: CGFloat = 0
            var y: CGFloat = 0
            var lineHeight: CGFloat = 0

            for subview in subviews {
                let size = subview.sizeThatFits(.unspecified)

                if x + size.width > maxWidth && x > 0 {
                    x = 0
                    y += lineHeight + spacing
                    lineHeight = 0
                }

                positions.append(CGPoint(x: x, y: y))
                lineHeight = max(lineHeight, size.height)
                x += size.width + spacing
            }

            self.size = CGSize(width: maxWidth, height: y + lineHeight)
        }
    }
}
