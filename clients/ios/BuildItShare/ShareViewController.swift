// ShareViewController.swift
// BuildIt - Decentralized Mesh Communication
//
// Main Share Extension view controller.
// Loads shared items from extensionContext and presents the share composer.

import UIKit
import SwiftUI
import Social
import MobileCoreServices

/// Share Extension view controller
/// Handles the share extension lifecycle and content extraction
class ShareViewController: UIViewController {
    // MARK: - Properties

    private var viewModel = ShareComposerViewModel()
    private var hostingController: UIHostingController<ShareComposerView>?

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()

        // Setup SwiftUI hosting
        setupHostingController()

        // Extract shared content
        Task {
            await extractSharedContent()
        }
    }

    // MARK: - Setup

    private func setupHostingController() {
        let composerView = ShareComposerView(
            viewModel: viewModel,
            onCancel: { [weak self] in
                self?.cancel()
            },
            onComplete: { [weak self] in
                self?.complete()
            }
        )

        let hostingController = UIHostingController(rootView: composerView)
        self.hostingController = hostingController

        addChild(hostingController)
        view.addSubview(hostingController.view)

        hostingController.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            hostingController.view.topAnchor.constraint(equalTo: view.topAnchor),
            hostingController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            hostingController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        hostingController.didMove(toParent: self)
    }

    // MARK: - Content Extraction

    @MainActor
    private func extractSharedContent() async {
        guard let extensionContext = extensionContext else {
            viewModel.error = "No extension context available"
            viewModel.isLoading = false
            return
        }

        do {
            let contents = try await ContentExtractor.extractContent(from: extensionContext)
            viewModel.sharedContent = contents
            viewModel.loadDestinations()
        } catch {
            viewModel.error = "Failed to extract content: \(error.localizedDescription)"
            viewModel.isLoading = false
        }
    }

    // MARK: - Actions

    private func cancel() {
        extensionContext?.cancelRequest(withError: NSError(
            domain: "com.buildit.share",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "User cancelled"]
        ))
    }

    private func complete() {
        // Return success
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}

// MARK: - Alternative: SLComposeServiceViewController Implementation

/// Alternative implementation using SLComposeServiceViewController
/// Provides a more native share sheet appearance
/// Uncomment this and comment out ShareViewController above if preferred
/*
class ShareViewController: SLComposeServiceViewController {
    private var selectedDestination: ShareDestination?
    private var destinations: [ShareDestination] = []

    override func isContentValid() -> Bool {
        // Validate that we have content and a destination
        return contentText.count > 0 || !placeholder.isEmpty
    }

    override func didSelectPost() {
        // User tapped Post
        Task { @MainActor in
            await postContent()
        }
    }

    private func postContent() async {
        guard let destination = selectedDestination else {
            // Post to first available destination or show error
            extensionContext?.cancelRequest(withError: NSError(
                domain: "com.buildit.share",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "No destination selected"]
            ))
            return
        }

        do {
            let contents = try await ContentExtractor.extractContent(from: extensionContext!)

            for content in contents {
                let share = PendingShare(
                    destination: destination,
                    content: content,
                    additionalText: contentText
                )

                if let imageData = content.imageData {
                    try PendingShareQueue.shared.storeImage(for: share.id, imageData: imageData)
                }

                try PendingShareQueue.shared.enqueue(share)
            }

            RecentDestinations.add(destination)

            extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)

        } catch {
            extensionContext?.cancelRequest(withError: error)
        }
    }

    override func configurationItems() -> [Any]! {
        // Load destinations
        loadDestinations()

        // Create configuration item for destination selection
        let destinationItem = SLComposeSheetConfigurationItem()!
        destinationItem.title = "Send To"
        destinationItem.value = selectedDestination?.displayName ?? "Select..."
        destinationItem.tapHandler = { [weak self] in
            self?.showDestinationPicker()
        }

        return [destinationItem]
    }

    private func loadDestinations() {
        // Load recent destinations
        let recents = RecentDestinations.load()
        if !recents.isEmpty {
            selectedDestination = recents.first
        }

        // Load all contacts and groups
        guard let containerURL = ShareConfig.sharedContainerURL else { return }

        let contactsURL = containerURL.appendingPathComponent("contacts.json")
        let groupsURL = containerURL.appendingPathComponent("groups.json")

        // Load contacts
        if let contactsData = try? Data(contentsOf: contactsURL),
           let contactsDict = try? JSONDecoder().decode([String: ShareableContact].self, from: contactsData) {
            for (publicKey, contact) in contactsDict {
                destinations.append(.contact(publicKey: publicKey, name: contact.name))
            }
        }

        // Load groups
        if let groupsData = try? Data(contentsOf: groupsURL),
           let groupsDict = try? JSONDecoder().decode([String: ShareableGroup].self, from: groupsData) {
            for (groupId, group) in groupsDict {
                destinations.append(.group(id: groupId, name: group.name))
            }
        }

        destinations.sort { $0.displayName < $1.displayName }
    }

    private func showDestinationPicker() {
        let picker = DestinationPickerViewController(
            destinations: destinations,
            selected: selectedDestination
        ) { [weak self] destination in
            self?.selectedDestination = destination
            self?.reloadConfigurationItems()
            self?.validateContent()
        }

        pushConfigurationViewController(picker)
    }
}

// MARK: - Destination Picker for SLComposeServiceViewController

class DestinationPickerViewController: UITableViewController {
    private let destinations: [ShareDestination]
    private var selected: ShareDestination?
    private let onSelect: (ShareDestination) -> Void

    init(destinations: [ShareDestination], selected: ShareDestination?, onSelect: @escaping (ShareDestination) -> Void) {
        self.destinations = destinations
        self.selected = selected
        self.onSelect = onSelect
        super.init(style: .plain)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Send To"
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "Cell")
    }

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        destinations.count
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "Cell", for: indexPath)
        let destination = destinations[indexPath.row]

        var config = cell.defaultContentConfiguration()
        config.text = destination.displayName
        config.secondaryText = destination.type == .contact ? "Contact" : "Group"
        config.image = UIImage(systemName: destination.type == .contact ? "person.fill" : "person.3.fill")

        cell.contentConfiguration = config
        cell.accessoryType = destination.id == selected?.id ? .checkmark : .none

        return cell
    }

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        let destination = destinations[indexPath.row]
        selected = destination
        onSelect(destination)
        tableView.reloadData()
        navigationController?.popViewController(animated: true)
    }
}
*/
