// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ApiContracts",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(
            name: "ApiContracts",
            targets: ["ApiContracts"]
        ),
    ],
    targets: [
        .target(
            name: "ApiContracts",
            path: "Sources/ApiContracts"
        ),
        .testTarget(
            name: "ApiContractsTests",
            dependencies: ["ApiContracts"],
            path: "Tests/ApiContractsTests"
        ),
    ]
)
