// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "CoreKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(
            name: "CoreKit",
            targets: ["CoreKit"]
        ),
    ],
    dependencies: [
        .package(path: "../ApiContracts"),
    ],
    targets: [
        .target(
            name: "CoreKit",
            dependencies: ["ApiContracts"],
            path: "Sources/CoreKit"
        ),
        .testTarget(
            name: "CoreKitTests",
            dependencies: ["CoreKit"],
            path: "Tests/CoreKitTests"
        ),
    ]
)
