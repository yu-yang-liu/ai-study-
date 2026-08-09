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
        // iosMath：原生 LaTeX 公式排版（MTMathUILabel）。自 2.0.0 起原生 SPM，
        // swift-tools 6.0 / .iOS(.v13)，与 CoreKit .iOS(.v17) 兼容。
        // Pin from: "2.5.0"（≥2.3.1，含 #215/#217 修复 MTMathList.h not found）。
        // 注意：iosMath .macOS(.v10_15) 低于 CoreKit .macOS(.v14)，SPM 取并集，无冲突。
        .package(url: "https://github.com/kostub/iosMath.git", from: "2.5.0"),
    ],
    targets: [
        .target(
            name: "CoreKit",
            dependencies: ["ApiContracts", "iosMath"],
            path: "Sources/CoreKit"
        ),
        .testTarget(
            name: "CoreKitTests",
            dependencies: ["CoreKit"],
            path: "Tests/CoreKitTests"
        ),
    ]
)
