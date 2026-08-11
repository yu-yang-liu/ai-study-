import XCTest
import UIKit
@testable import ios_gaokao

@MainActor
final class ImageUploadPreparerTests: XCTestCase {
    func testPrepareResizesAndCompressesLargeImage() throws {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 3000, height: 1500))
        let image = renderer.image { context in
            UIColor.systemBlue.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 3000, height: 1500))
        }
        let sourceData = try XCTUnwrap(image.jpegData(compressionQuality: 1))

        let prepared = try ImageUploadPreparer.prepare(data: sourceData)
        let preparedImage = try XCTUnwrap(UIImage(data: prepared.data))

        XCTAssertLessThanOrEqual(max(preparedImage.size.width, preparedImage.size.height), ImageUploadPreparer.maxDimension)
        XCTAssertLessThanOrEqual(prepared.data.count, ImageUploadPreparer.maxBytes)
        XCTAssertNotNil(prepared.preview)
    }

    func testPrepareRejectsInvalidData() {
        XCTAssertThrowsError(try ImageUploadPreparer.prepare(data: Data("not-an-image".utf8))) { error in
            guard case ImagePreparationError.invalidImage = error else {
                return XCTFail("expected invalidImage, got \(error)")
            }
        }
    }
}
