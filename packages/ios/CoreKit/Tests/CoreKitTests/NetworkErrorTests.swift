import XCTest
@testable import CoreKit

final class NetworkErrorTests: XCTestCase {
    func testLocalizedDescriptions() {
        XCTAssertFalse(NetworkError.unauthorized.errorDescription?.isEmpty ?? true)
        XCTAssertFalse(NetworkError.timeout.errorDescription?.isEmpty ?? true)
        XCTAssertFalse(NetworkError.networkUnavailable.errorDescription?.isEmpty ?? true)
    }
}
