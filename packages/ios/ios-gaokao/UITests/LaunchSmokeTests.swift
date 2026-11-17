import XCTest

@MainActor
final class LaunchSmokeTests: XCTestCase {
    func testApplicationReachesForeground() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
    }
}
