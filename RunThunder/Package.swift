// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "RunThunder",
    platforms: [
        .macOS(.v13)
    ],
    targets: [
        .executableTarget(
            name: "RunThunder",
            path: "Sources/RunThunder"
        )
    ]
)
