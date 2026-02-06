// PublicationSettingsView.swift
// BuildIt - Decentralized Mesh Communication
//
// Settings view for managing publication configuration.

import SwiftUI

struct PublicationSettingsView: View {
    @ObservedObject var service: PublishingService
    @Environment(\.dismiss) private var dismiss

    @State private var selectedPublication: Publication?
    @State private var showingNewPublication = false
    @State private var showingEditPublication = false
    @State private var showingDeleteConfirmation = false
    @State private var publicationToDelete: Publication?

    var body: some View {
        NavigationStack {
            List {
                // Publications section
                Section {
                    if service.publications.isEmpty {
                        VStack(spacing: 12) {
                            Image(systemName: "newspaper")
                                .font(.system(size: 40))
                                .foregroundColor(.secondary)

                            Text("No Publications")
                                .font(.headline)

                            Text("Create a publication to organize your articles")
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 20)
                    } else {
                        ForEach(service.publications) { publication in
                            PublicationRow(
                                publication: publication,
                                isSelected: service.currentPublication?.id == publication.id
                            )
                            .contentShape(Rectangle())
                            .onTapGesture {
                                selectedPublication = publication
                                showingEditPublication = true
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) {
                                    publicationToDelete = publication
                                    showingDeleteConfirmation = true
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                        }
                    }

                    Button {
                        showingNewPublication = true
                    } label: {
                        Label("New Publication", systemImage: "plus")
                    }
                } header: {
                    Text("Publications")
                }

                // Current publication settings
                if let publication = service.currentPublication {
                    Section {
                        NavigationLink {
                            PublicationDetailView(
                                service: service,
                                publication: publication,
                                isNew: false
                            )
                        } label: {
                            Label("Publication Settings", systemImage: "gearshape")
                        }

                        NavigationLink {
                            SubscribersView(service: service, publicationId: publication.id)
                        } label: {
                            Label("Subscribers", systemImage: "person.2")
                        }

                        NavigationLink {
                            SubscriptionTiersView(service: service, publicationId: publication.id)
                        } label: {
                            Label("Subscription Tiers", systemImage: "creditcard")
                        }
                    } header: {
                        Text("Current: \(publication.name)")
                    }

                    Section {
                        Toggle("RSS Feed", isOn: Binding(
                            get: { publication.rssEnabled },
                            set: { newValue in
                                var updated = publication
                                updated.rssEnabled = newValue
                                Task {
                                    _ = try? await service.updatePublication(updated)
                                }
                            }
                        ))

                        Toggle("Comments", isOn: Binding(
                            get: { publication.commentsEnabled },
                            set: { newValue in
                                var updated = publication
                                updated.commentsEnabled = newValue
                                Task {
                                    _ = try? await service.updatePublication(updated)
                                }
                            }
                        ))

                        Toggle("Subscriptions", isOn: Binding(
                            get: { publication.subscriptionEnabled },
                            set: { newValue in
                                var updated = publication
                                updated.subscriptionEnabled = newValue
                                Task {
                                    _ = try? await service.updatePublication(updated)
                                }
                            }
                        ))
                    } header: {
                        Text("Features")
                    }
                }

                // Export section
                Section {
                    Button {
                        exportRSS()
                    } label: {
                        Label("Export RSS Feed", systemImage: "square.and.arrow.up")
                    }

                    Button {
                        exportArticles()
                    } label: {
                        Label("Export All Articles", systemImage: "doc.zipper")
                    }
                } header: {
                    Text("Export")
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .sheet(isPresented: $showingNewPublication) {
                PublicationDetailView(
                    service: service,
                    publication: nil,
                    isNew: true
                )
            }
            .sheet(isPresented: $showingEditPublication) {
                if let publication = selectedPublication {
                    PublicationDetailView(
                        service: service,
                        publication: publication,
                        isNew: false
                    )
                }
            }
            .alert("Delete Publication?", isPresented: $showingDeleteConfirmation) {
                Button("Delete", role: .destructive) {
                    if let publication = publicationToDelete {
                        Task {
                            try? await service.deletePublication(publication)
                        }
                    }
                }
                Button("Cancel", role: .cancel) { }
            } message: {
                Text("This will permanently delete the publication. Articles will not be affected.")
            }
            .task {
                await service.refreshPublications()
            }
        }
    }

    private func exportRSS() {
        guard let publication = service.currentPublication else { return }

        Task {
            let articles = try await service.getPublishedArticles()
            let rss = service.generateRSS(
                for: publication,
                articles: articles,
                baseUrl: "https://buildit.network/\(publication.id)"
            )

            // Copy to clipboard or share
            SecureClipboard.copy(rss)
        }
    }

    private func exportArticles() {
        // Would implement article export
    }
}

// MARK: - Publication Row

struct PublicationRow: View {
    let publication: Publication
    let isSelected: Bool

    var body: some View {
        HStack(spacing: 12) {
            // Logo
            if let logo = publication.logo, !logo.isEmpty {
                AsyncImage(url: URL(string: logo)) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } placeholder: {
                    publicationIcon
                }
                .frame(width: 44, height: 44)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            } else {
                publicationIcon
            }

            // Info
            VStack(alignment: .leading, spacing: 2) {
                Text(publication.name)
                    .font(.headline)

                if let description = publication.description {
                    Text(description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            if isSelected {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.accentColor)
            }

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }

    private var publicationIcon: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(Color.accentColor.opacity(0.2))
            .frame(width: 44, height: 44)
            .overlay {
                Text(String(publication.name.prefix(1)).uppercased())
                    .font(.headline)
                    .foregroundColor(.accentColor)
            }
    }
}

// MARK: - Publication Detail View

struct PublicationDetailView: View {
    @ObservedObject var service: PublishingService
    let publication: Publication?
    let isNew: Bool

    @Environment(\.dismiss) private var dismiss

    @State private var name: String = ""
    @State private var description: String = ""
    @State private var logo: String = ""
    @State private var coverImage: String = ""
    @State private var visibility: ArticleVisibility = .public
    @State private var customDomain: String = ""
    @State private var theme: PublicationTheme = PublicationTheme()

    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Publication Name", text: $name)

                    TextField("Description", text: $description, axis: .vertical)
                        .lineLimit(3...6)
                } header: {
                    Text("Basic Info")
                }

                Section {
                    TextField("Logo URL", text: $logo)
                        .keyboardType(.URL)
                        .autocapitalization(.none)

                    TextField("Cover Image URL", text: $coverImage)
                        .keyboardType(.URL)
                        .autocapitalization(.none)

                    if !logo.isEmpty {
                        AsyncImage(url: URL(string: logo)) { image in
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                        } placeholder: {
                            ProgressView()
                        }
                        .frame(height: 100)
                    }
                } header: {
                    Text("Branding")
                }

                Section {
                    Picker("Visibility", selection: $visibility) {
                        Text("Public").tag(ArticleVisibility.public)
                        Text("Group Only").tag(ArticleVisibility.group)
                        Text("Private").tag(ArticleVisibility.private)
                    }

                    TextField("Custom Domain", text: $customDomain)
                        .keyboardType(.URL)
                        .autocapitalization(.none)
                } header: {
                    Text("Access")
                } footer: {
                    Text("Custom domain requires DNS configuration")
                }

                Section {
                    Picker("Header Style", selection: $theme.headerStyle) {
                        ForEach(PublicationTheme.HeaderStyle.allCases, id: \.self) { style in
                            Text(style.displayName).tag(style)
                        }
                    }

                    Picker("Layout Style", selection: $theme.layoutStyle) {
                        ForEach(PublicationTheme.LayoutStyle.allCases, id: \.self) { style in
                            Text(style.displayName).tag(style)
                        }
                    }

                    ColorPicker("Primary Color", selection: Binding(
                        get: { Color(hex: theme.primaryColor) ?? .black },
                        set: { theme.primaryColor = $0.hexString }
                    ))

                    ColorPicker("Accent Color", selection: Binding(
                        get: { Color(hex: theme.accentColor) ?? .accentColor },
                        set: { theme.accentColor = $0.hexString }
                    ))
                } header: {
                    Text("Theme")
                }
            }
            .navigationTitle(isNew ? "New Publication" : "Edit Publication")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        save()
                    }
                    .disabled(name.isEmpty || isSaving)
                }
            }
            .onAppear {
                loadPublication()
            }
        }
    }

    private func loadPublication() {
        guard let publication = publication else { return }

        name = publication.name
        description = publication.description ?? ""
        logo = publication.logo ?? ""
        coverImage = publication.coverImage ?? ""
        visibility = publication.visibility
        customDomain = publication.customDomain ?? ""
        theme = publication.theme
    }

    private func save() {
        Task {
            isSaving = true
            defer { isSaving = false }

            do {
                let ownerPubkey = await CryptoManager.shared.getPublicKeyHex() ?? ""

                if var existingPublication = publication {
                    existingPublication.name = name
                    existingPublication.description = description.isEmpty ? nil : description
                    existingPublication.logo = logo.isEmpty ? nil : logo
                    existingPublication.coverImage = coverImage.isEmpty ? nil : coverImage
                    existingPublication.visibility = visibility
                    existingPublication.customDomain = customDomain.isEmpty ? nil : customDomain
                    existingPublication.theme = theme

                    _ = try await service.updatePublication(existingPublication)
                } else {
                    _ = try await service.createPublication(
                        name: name,
                        description: description.isEmpty ? nil : description,
                        ownerPubkey: ownerPubkey
                    )
                }

                dismiss()
            } catch {
                // Handle error
            }
        }
    }
}

// MARK: - Subscription Tiers View

struct SubscriptionTiersView: View {
    @ObservedObject var service: PublishingService
    let publicationId: String

    @State private var tiers: [SubscriptionTier] = []
    @State private var showingNewTier = false

    var body: some View {
        List {
            if tiers.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "creditcard")
                        .font(.system(size: 40))
                        .foregroundColor(.secondary)

                    Text("No Subscription Tiers")
                        .font(.headline)

                    Text("Create tiers to offer premium content")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
            } else {
                ForEach(tiers) { tier in
                    SubscriptionTierRow(tier: tier)
                }
            }

            Button {
                showingNewTier = true
            } label: {
                Label("Add Tier", systemImage: "plus")
            }
        }
        .navigationTitle("Subscription Tiers")
        .sheet(isPresented: $showingNewTier) {
            NewSubscriptionTierView(service: service, publicationId: publicationId) {
                loadTiers()
            }
        }
        .task {
            loadTiers()
        }
    }

    private func loadTiers() {
        Task {
            tiers = try await service.getSubscriptionTiers(publicationId: publicationId)
        }
    }
}

struct SubscriptionTierRow: View {
    let tier: SubscriptionTier

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(tier.name)
                    .font(.headline)

                Spacer()

                Text(tier.formattedMonthlyPrice)
                    .font(.subheadline)
                    .foregroundColor(.accentColor)
            }

            if let description = tier.description {
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            if !tier.benefits.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(tier.benefits.prefix(3), id: \.self) { benefit in
                        HStack(spacing: 6) {
                            Image(systemName: "checkmark")
                                .font(.caption2)
                                .foregroundColor(.green)
                            Text(benefit)
                                .font(.caption)
                        }
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }
}

struct NewSubscriptionTierView: View {
    @ObservedObject var service: PublishingService
    let publicationId: String
    let onSave: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var description = ""
    @State private var priceMonthly = ""
    @State private var priceYearly = ""
    @State private var benefits: [String] = []
    @State private var newBenefit = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Tier Name", text: $name)
                    TextField("Description", text: $description, axis: .vertical)
                } header: {
                    Text("Details")
                }

                Section {
                    HStack {
                        TextField("Monthly Price", text: $priceMonthly)
                            .keyboardType(.numberPad)
                        Text("sats")
                            .foregroundColor(.secondary)
                    }

                    HStack {
                        TextField("Yearly Price (optional)", text: $priceYearly)
                            .keyboardType(.numberPad)
                        Text("sats")
                            .foregroundColor(.secondary)
                    }
                } header: {
                    Text("Pricing")
                }

                Section {
                    ForEach(benefits, id: \.self) { benefit in
                        HStack {
                            Text(benefit)
                            Spacer()
                            Button {
                                benefits.removeAll { $0 == benefit }
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundColor(.secondary)
                            }
                        }
                    }

                    HStack {
                        TextField("Add benefit", text: $newBenefit)
                        Button("Add") {
                            if !newBenefit.isEmpty {
                                benefits.append(newBenefit)
                                newBenefit = ""
                            }
                        }
                        .disabled(newBenefit.isEmpty)
                    }
                } header: {
                    Text("Benefits")
                }
            }
            .navigationTitle("New Tier")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        save()
                    }
                    .disabled(name.isEmpty || priceMonthly.isEmpty)
                }
            }
        }
    }

    private func save() {
        guard let price = Int(priceMonthly) else { return }

        Task {
            _ = try await service.createSubscriptionTier(
                publicationId: publicationId,
                name: name,
                description: description.isEmpty ? nil : description,
                priceMonthly: price,
                priceYearly: Int(priceYearly),
                benefits: benefits
            )
            onSave()
            dismiss()
        }
    }
}

// MARK: - Color Extensions

extension Color {
    init?(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)

        let r, g, b: UInt64
        switch hex.count {
        case 6:
            (r, g, b) = ((int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        default:
            return nil
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255
        )
    }

    var hexString: String {
        let components = UIColor(self).cgColor.components ?? [0, 0, 0]
        let r = Int(components[0] * 255)
        let g = Int(components[1] * 255)
        let b = Int(components[2] * 255)
        return String(format: "#%02X%02X%02X", r, g, b)
    }
}
