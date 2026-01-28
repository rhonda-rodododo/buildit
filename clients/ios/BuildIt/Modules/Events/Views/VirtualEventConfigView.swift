// VirtualEventConfigView.swift
// BuildIt - Decentralized Mesh Communication
//
// SwiftUI form for configuring virtual event settings.
// Part of the Events-Calling integration.

import SwiftUI

/// SwiftUI view for configuring virtual event settings
public struct VirtualEventConfigView: View {
    @Binding var config: EventVirtualConfig
    @Binding var attendanceType: EventAttendanceType

    @State private var showBreakoutConfig: Bool = false

    public init(
        config: Binding<EventVirtualConfig>,
        attendanceType: Binding<EventAttendanceType>
    ) {
        self._config = config
        self._attendanceType = attendanceType
    }

    public var body: some View {
        Form {
            attendanceTypeSection

            if config.enabled {
                conferenceSettingsSection
                recordingSection
                securitySection
                breakoutRoomsSection
            }
        }
    }

    // MARK: - Sections

    private var attendanceTypeSection: some View {
        Section {
            Picker("Attendance Type", selection: $attendanceType) {
                ForEach(EventAttendanceType.allCases, id: \.self) { type in
                    Label(type.displayName, systemImage: type.icon)
                        .tag(type)
                }
            }
            .pickerStyle(.segmented)
            .onChange(of: attendanceType) { _, newValue in
                config.enabled = newValue != .inPerson
            }
        } header: {
            Text("Event Type")
        } footer: {
            Text(attendanceTypeFooter)
        }
    }

    private var conferenceSettingsSection: some View {
        Section {
            HStack {
                Text("Auto-start conference")
                Spacer()
                Picker("", selection: $config.autoStartMinutes) {
                    Text("5 min before").tag(5)
                    Text("10 min before").tag(10)
                    Text("15 min before").tag(15)
                    Text("30 min before").tag(30)
                }
                .pickerStyle(.menu)
            }

            Toggle("Enable Waiting Room", isOn: $config.waitingRoomEnabled)

            if let maxAttendees = config.maxVirtualAttendees {
                Stepper(
                    "Max Attendees: \(maxAttendees)",
                    value: Binding(
                        get: { config.maxVirtualAttendees ?? 100 },
                        set: { config.maxVirtualAttendees = $0 }
                    ),
                    in: 2...1000,
                    step: 10
                )
            } else {
                Button {
                    config.maxVirtualAttendees = 100
                } label: {
                    Label("Set Maximum Attendees", systemImage: "person.3")
                }
            }
        } header: {
            Text("Conference Settings")
        } footer: {
            Text("The conference room will automatically be created before the event starts.")
        }
    }

    private var recordingSection: some View {
        Section {
            Toggle("Enable Recording", isOn: $config.recordingEnabled)

            if config.recordingEnabled {
                Toggle("Require Recording Consent", isOn: $config.recordingConsentRequired)
                    .padding(.leading)
            }
        } header: {
            Text("Recording")
        } footer: {
            if config.recordingEnabled {
                Text("Participants will be notified that the session is being recorded.")
            } else {
                Text("Recording can be enabled to make sessions available for later viewing.")
            }
        }
    }

    private var securitySection: some View {
        Section {
            Toggle("Require End-to-End Encryption", isOn: $config.e2eeRequired)
        } header: {
            Text("Security")
        } footer: {
            if config.e2eeRequired {
                Text("All communications will be encrypted end-to-end. This provides the highest level of security but may limit some features.")
            } else {
                Text("Transport encryption will still be used, but E2EE provides additional protection against server-side access.")
            }
        }
    }

    private var breakoutRoomsSection: some View {
        Section {
            Toggle("Enable Breakout Rooms", isOn: $config.breakoutRoomsEnabled)

            if config.breakoutRoomsEnabled {
                Button {
                    showBreakoutConfig = true
                } label: {
                    HStack {
                        Text("Configure Breakout Rooms")
                        Spacer()
                        if let count = config.breakoutConfig?.roomCount {
                            Text("\(count) rooms")
                                .foregroundColor(.secondary)
                        }
                        Image(systemName: "chevron.right")
                            .foregroundColor(.secondary)
                    }
                }
            }
        } header: {
            Text("Breakout Rooms")
        } footer: {
            Text("Breakout rooms allow splitting participants into smaller groups for discussions.")
        }
        .sheet(isPresented: $showBreakoutConfig) {
            BreakoutRoomConfigView(config: Binding(
                get: { config.breakoutConfig ?? BreakoutRoomConfig() },
                set: { config.breakoutConfig = $0 }
            ))
        }
    }

    // MARK: - Helpers

    private var attendanceTypeFooter: String {
        switch attendanceType {
        case .inPerson:
            return "This event will be in-person only. No virtual attendance option will be provided."
        case .virtual:
            return "This event will be virtual only. A conference room will be automatically created."
        case .hybrid:
            return "This event supports both in-person and virtual attendance."
        }
    }
}

// MARK: - Breakout Room Config View

/// View for configuring breakout room settings
public struct BreakoutRoomConfigView: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var config: BreakoutRoomConfig
    @State private var customRoomNames: Bool = false

    public var body: some View {
        NavigationStack {
            Form {
                Section {
                    Stepper(
                        "Number of Rooms: \(config.roomCount ?? 2)",
                        value: Binding(
                            get: { config.roomCount ?? 2 },
                            set: { config.roomCount = $0 }
                        ),
                        in: 2...50
                    )

                    Toggle("Auto-Assign Participants", isOn: $config.autoAssign)

                    Toggle("Allow Self-Selection", isOn: $config.allowSelfSelect)
                } header: {
                    Text("Room Settings")
                }

                Section {
                    Toggle("Set Duration", isOn: Binding(
                        get: { config.duration != nil },
                        set: { config.duration = $0 ? 15 : nil }
                    ))

                    if let duration = config.duration {
                        Stepper(
                            "Duration: \(duration) minutes",
                            value: Binding(
                                get: { config.duration ?? 15 },
                                set: { config.duration = $0 }
                            ),
                            in: 5...120,
                            step: 5
                        )
                    }
                } header: {
                    Text("Timing")
                } footer: {
                    Text("Set a duration to automatically close breakout rooms and return participants to the main room.")
                }

                Section {
                    Toggle("Custom Room Names", isOn: $customRoomNames)

                    if customRoomNames, let roomCount = config.roomCount {
                        ForEach(0..<roomCount, id: \.self) { index in
                            TextField(
                                "Room \(index + 1)",
                                text: Binding(
                                    get: {
                                        config.roomNames?[safe: index] ?? "Breakout Room \(index + 1)"
                                    },
                                    set: { newValue in
                                        var names = config.roomNames ?? Array(repeating: "", count: roomCount)
                                        if names.count != roomCount {
                                            names = Array(repeating: "", count: roomCount)
                                        }
                                        names[index] = newValue
                                        config.roomNames = names
                                    }
                                )
                            )
                        }
                    }
                } header: {
                    Text("Room Names")
                }
            }
            .navigationTitle("Breakout Rooms")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Array Extension

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

// MARK: - Preview

#Preview("Virtual Event Config") {
    struct PreviewWrapper: View {
        @State private var config = EventVirtualConfig.virtualDefault
        @State private var attendanceType = EventAttendanceType.virtual

        var body: some View {
            NavigationStack {
                VirtualEventConfigView(
                    config: $config,
                    attendanceType: $attendanceType
                )
                .navigationTitle("Virtual Settings")
            }
        }
    }

    return PreviewWrapper()
}

#Preview("Breakout Config") {
    struct PreviewWrapper: View {
        @State private var config = BreakoutRoomConfig.defaultConfig(roomCount: 4)

        var body: some View {
            BreakoutRoomConfigView(config: $config)
        }
    }

    return PreviewWrapper()
}
