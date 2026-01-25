// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "BuildIt",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "BuildItCore",
            targets: ["BuildItCore"]
        ),
    ],
    dependencies: [
        // No external dependencies - using only Apple frameworks
    ],
    targets: [
        .target(
            name: "BuildItCore",
            dependencies: [],
            path: "BuildIt/Core"
        ),
        .testTarget(
            name: "BuildItTests",
            dependencies: ["BuildItCore"],
            path: "BuildItTests"
        ),
    ]
)
