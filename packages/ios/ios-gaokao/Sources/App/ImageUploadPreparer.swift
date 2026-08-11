import Foundation
import UIKit

@MainActor
struct PreparedImage {
    let data: Data
    let preview: UIImage
}

@MainActor
enum ImageUploadPreparer {
    static let maxDimension: CGFloat = 2048
    static let maxBytes = 8 * 1024 * 1024

    static func prepare(data: Data) throws -> PreparedImage {
        guard let sourceImage = UIImage(data: data) else {
            throw ImagePreparationError.invalidImage
        }

        let image = resizedImage(sourceImage)
        var quality: CGFloat = 0.82
        var compressed = image.jpegData(compressionQuality: quality)

        while let current = compressed, current.count > maxBytes, quality > 0.42 {
            quality -= 0.08
            compressed = image.jpegData(compressionQuality: quality)
        }

        guard let compressed else {
            throw ImagePreparationError.compressionFailed
        }
        guard compressed.count <= maxBytes else {
            throw ImagePreparationError.tooLarge
        }
        guard let preview = UIImage(data: compressed) else {
            throw ImagePreparationError.compressionFailed
        }

        return PreparedImage(data: compressed, preview: preview)
    }

    static func cachePreviewData(for data: Data) -> Data? {
        guard let image = UIImage(data: data) else { return nil }
        let preview = resizedImage(image, maxDimension: 640)
        return preview.jpegData(compressionQuality: 0.62)
    }

    private static func resizedImage(_ image: UIImage) -> UIImage {
        resizedImage(image, maxDimension: maxDimension)
    }

    private static func resizedImage(_ image: UIImage, maxDimension: CGFloat) -> UIImage {
        let longestSide = max(image.size.width, image.size.height)
        guard longestSide > maxDimension else { return image }

        let scale = maxDimension / longestSide
        let targetSize = CGSize(
            width: max(image.size.width * scale, 1),
            height: max(image.size.height * scale, 1)
        )
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        return UIGraphicsImageRenderer(size: targetSize, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: targetSize))
        }
    }
}

enum ImagePreparationError: Error, LocalizedError {
    case invalidImage
    case compressionFailed
    case tooLarge

    var errorDescription: String? {
        switch self {
        case .invalidImage:
            return "无法读取这张图片，请重新选择"
        case .compressionFailed:
            return "图片处理失败，请重新选择"
        case .tooLarge:
            return "图片仍然过大，请选择更小的图片"
        }
    }
}
