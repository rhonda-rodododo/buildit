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
        // WebRTC for voice/video calling
        .package(url: "https://github.com/stasel/WebRTC.git", .upToNextMajor(from: "125.0.0")),
    ],
    targets: [
        .target(
            name: "BuildItCore",
            dependencies: [
                .product(name: "WebRTC", package: "WebRTC"),
            ],
            path: "BuildIt/Core"
        ),
        .testTarget(
            name: "BuildItTests",
            dependencies: ["BuildItCore"],
            path: "BuildItTests"
        ),
    ]
)
