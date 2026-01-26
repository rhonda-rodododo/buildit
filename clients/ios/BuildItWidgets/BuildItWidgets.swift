// BuildItWidgets.swift
// BuildIt - Decentralized Mesh Communication
//
// Widget bundle entry point for BuildIt iOS widgets.
// Exposes multiple widgets from a single widget extension.

import WidgetKit
import SwiftUI

/// Main entry point for the BuildIt widget extension.
/// Contains all available widgets for the home screen.
@main
struct BuildItWidgets: WidgetBundle {
    var body: some Widget {
        UnreadMessagesWidget()
        UpcomingEventsWidget()
        QuickActionsWidget()
    }
}
