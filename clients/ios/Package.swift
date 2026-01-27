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
        .package(url: "https://github.com/nicolo-brandini/AmaranJoshuaKarlWebRTC.git", from: "124.0.0"),
    ],
    targets: [
        .target(
            name: "BuildItCore",
            dependencies: [
                .product(name: "WebRTC", package: "AmaranJoshuaKarlWebRTC"),
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
