// PostComposerView.swift
// BuildIt - Decentralized Mesh Communication
//
// View for composing new posts and replies.
// Epic 78: Media & File Upload System - PHPicker integration

import SwiftUI
import PhotosUI

/// View for composing a new post or reply
struct PostComposerView: View {
    @ObservedObject var viewModel: SocialViewModel
    var replyToPost: SocialPost? = nil

    @Environment(\.dismiss) private var dismiss
    @State private var content = ""
    @FocusState private var isFocused: Bool
    @StateObject private var linkDetector = LinkPreviewDetector()

    // Media state
    @State private var selectedPhotosPickerItems: [PhotosPickerItem] = []
    @State private var selectedImages: [SelectedImage] = []
    @State private var isLoadingMedia = false

    private let maxLength = 1000
    private let maxMediaCount = 4

    /// Whether the post button should be enabled
    private var canPost: Bool {
        let hasContent = !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let hasMedia = !selectedImages.isEmpty
        let withinLimit = content.count <= maxLength
        let notPosting = !viewModel.isPosting
        let notLoadingMedia = !isLoadingMedia
        return (hasContent || hasMedia) && withinLimit && notPosting && notLoadingMedia
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Reply context
                if let replyTo = replyToPost {
                    replyContext(replyTo)
                }

                // Text editor
                TextEditor(text: $content)
                    .focused($isFocused)
                    .font(.body)
                    .padding()
                    .overlay(alignment: .topLeading) {
                        if content.isEmpty {
                            Text(replyToPost != nil ? "Write your reply..." : "What's happening?")
                                .foregroundColor(.secondary)
                                .padding(.horizontal, 20)
                                .padding(.vertical, 24)
                                .allowsHitTesting(false)
                        }
                    }

                // Image previews
                if !selectedImages.isEmpty {
                    imagePreviewStrip
                        .padding(.horizontal)
                        .padding(.bottom, 8)
                }

                // Media loading indicator
                if isLoadingMedia {
                    HStack(spacing: 8) {
                        ProgressView()
                            .controlSize(.small)
                        Text("Processing media...")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 8)
                }

                // Link previews
                if !linkDetector.previews.isEmpty || linkDetector.isLoading {
                    LinkPreviewStrip(
                        previews: linkDetector.previews,
                        isLoading: linkDetector.isLoading,
                        onRemove: { url in linkDetector.removePreview(url: url) }
                    )
                    .padding(.vertical, 8)
                }

                Divider()

                // Bottom toolbar
                HStack {
                    // Photo picker button
                    PhotosPicker(
                        selection: $selectedPhotosPickerItems,
                        maxSelectionCount: maxMediaCount,
                        matching: .any(of: [.images, .videos]),
                        photoLibrary: .shared()
                    ) {
                        Image(systemName: selectedImages.isEmpty ? "photo" : "photo.fill")
                            .foregroundColor(selectedImages.isEmpty ? .primary : .accentColor)
                    }

                    if !selectedImages.isEmpty {
                        Text("\(selectedImages.count)/\(maxMediaCount)")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    // Character count
                    Text("\(content.count)/\(maxLength)")
                        .font(.caption)
                        .foregroundColor(content.count > Int(Double(maxLength) * 0.9) ? .red : .secondary)
                }
                .padding()
            }
            .navigationTitle(replyToPost != nil ? "Reply" : "New Post")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .disabled(viewModel.isPosting)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        post()
                    } label: {
                        if viewModel.isPosting {
                            ProgressView()
                        } else {
                            Text(replyToPost != nil ? "Reply" : "Post")
                        }
                    }
                    .disabled(!canPost)
                }
            }
            .onAppear {
                isFocused = true
            }
            .onChange(of: content) { _, newValue in
                linkDetector.textDidChange(newValue)
            }
            .onChange(of: selectedPhotosPickerItems) { _, newItems in
                Task {
                    await loadSelectedMedia(from: newItems)
                }
            }
        }
    }

    // MARK: - Image Preview Strip

    private var imagePreviewStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(selectedImages) { image in
                    ZStack(alignment: .topTrailing) {
                        if let uiImage = image.image {
                            Image(uiImage: uiImage)
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: 80, height: 80)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        } else {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color(.systemGray5))
                                .frame(width: 80, height: 80)
                                .overlay {
                                    Image(systemName: "photo")
                                        .foregroundColor(.secondary)
                                }
                        }

                        // Remove button
                        Button {
                            removeImage(image)
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 20))
                                .foregroundStyle(.white, .black.opacity(0.6))
                        }
                        .offset(x: 4, y: -4)
                    }
                }
            }
        }
    }

    // MARK: - Media Loading

    /// Load images from PHPicker selection.
    /// PRIVACY: Images are loaded via transferable which strips EXIF by default
    /// in the Photos framework (location data is not included in transferable data).
    private func loadSelectedMedia(from items: [PhotosPickerItem]) async {
        isLoadingMedia = true
        var newImages: [SelectedImage] = []

        for item in items {
            do {
                if let data = try await item.loadTransferable(type: Data.self),
                   let uiImage = UIImage(data: data) {
                    // Re-draw on canvas to ensure no metadata leaks
                    // (Photos framework strips most EXIF, but we re-render to be safe)
                    let strippedImage = stripImageMetadata(uiImage)
                    let selected = SelectedImage(
                        id: UUID().uuidString,
                        image: strippedImage,
                        data: strippedImage.jpegData(compressionQuality: 0.85),
                        mimeType: "image/jpeg"
                    )
                    newImages.append(selected)
                }
            } catch {
                // Skip failed items silently - user can retry
                print("Failed to load media item: \(error.localizedDescription)")
            }
        }

        selectedImages = newImages
        isLoadingMedia = false
    }

    /// Re-render a UIImage to strip any remaining metadata.
    /// This creates a new image from the pixel data only.
    private func stripImageMetadata(_ image: UIImage) -> UIImage {
        let maxDimension: CGFloat = 2048
        var size = image.size

        // Resize if necessary
        if size.width > maxDimension || size.height > maxDimension {
            let ratio = min(maxDimension / size.width, maxDimension / size.height)
            size = CGSize(width: size.width * ratio, height: size.height * ratio)
        }

        let renderer = UIGraphicsImageRenderer(size: size)
        let strippedImage = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
        return strippedImage
    }

    // MARK: - Actions

    private func removeImage(_ image: SelectedImage) {
        selectedImages.removeAll { $0.id == image.id }
        // Also remove from picker selection to stay in sync
        if let index = selectedPhotosPickerItems.firstIndex(where: { _ in true }) {
            // PhotosPickerItem doesn't have stable identity matching,
            // so we clear and let the user re-select if needed
            if selectedImages.isEmpty {
                selectedPhotosPickerItems.removeAll()
            }
        }
    }

    private func replyContext(_ post: SocialPost) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Replying to")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Text("@\(post.authorName ?? String(post.authorPubkey.prefix(8)))")
                    .font(.caption)
                    .foregroundColor(.blue)
            }

            Text(post.content)
                .font(.caption)
                .foregroundColor(.secondary)
                .lineLimit(2)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemGray6))
    }

    private func post() {
        let previews = linkDetector.previews
        if let replyTo = replyToPost {
            viewModel.replyToPost(parentId: replyTo.id, content: content, linkPreviews: previews)
        } else {
            viewModel.createPost(content: content, linkPreviews: previews)
        }
        dismiss()
    }
}

// MARK: - Selected Image Model

/// Represents a selected image with its processed data.
struct SelectedImage: Identifiable {
    let id: String
    let image: UIImage?
    let data: Data?
    let mimeType: String
}

#Preview {
    PostComposerView(viewModel: SocialViewModel())
}
