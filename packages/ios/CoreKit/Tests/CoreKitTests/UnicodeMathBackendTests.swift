import XCTest
@testable import CoreKit

final class UnicodeMathBackendTests: XCTestCase {

    // MARK: 基础命令

    func testSqrtCommand() {
        XCTAssertEqual(UnicodeMathBackend.convert(#"\sqrt{2}"#), "√2")
    }

    func testGreekLetters() {
        XCTAssertEqual(UnicodeMathBackend.convert(#"\alpha + \beta"#), "α + β")
        XCTAssertEqual(UnicodeMathBackend.convert(#"\pi"#), "π")
    }

    func testOperators() {
        XCTAssertEqual(UnicodeMathBackend.convert(#"\sum \int \infty"#), "∑ ∫ ∞")
        XCTAssertEqual(UnicodeMathBackend.convert(#"\times \div \pm"#), "× ÷ ±")
        XCTAssertEqual(UnicodeMathBackend.convert(#"\neq \leq \geq"#), "≠ ≤ ≥")
    }

    // MARK: 分数

    func testFraction() {
        XCTAssertEqual(UnicodeMathBackend.convert(#"\frac{a}{b}"#), "a/b")
    }

    func testFractionWithNestedContent() {
        XCTAssertEqual(UnicodeMathBackend.convert(#"\frac{1}{2}"#), "1/2")
    }

    // MARK: 上下标

    func testSuperscriptBraced() {
        XCTAssertEqual(UnicodeMathBackend.convert(#"x^{2}"#), "x²")
    }

    func testSuperscriptSingleChar() {
        XCTAssertEqual(UnicodeMathBackend.convert(#"x^2"#), "x²")
    }

    func testSubscriptBraced() {
        XCTAssertEqual(UnicodeMathBackend.convert(#"x_{n}"#), "xₙ")
    }

    func testSubscriptSingleChar() {
        XCTAssertEqual(UnicodeMathBackend.convert(#"x_n"#), "xₙ")
    }

    func testSubscriptNumber() {
        XCTAssertEqual(UnicodeMathBackend.convert(#"a_1 + a_2"#), "a₁ + a₂")
    }

    // MARK: 综合

    func testComplexFormula() {
        // \sum_{i=1}^{n} i = \frac{n(n+1)}{2}
        let result = UnicodeMathBackend.convert(#"\sum_{i=1}^{n} i = \frac{n(n+1)}{2}"#)
        XCTAssertTrue(result.contains("∑"), "expected ∑ in: \(result)")
        XCTAssertTrue(result.contains("ₙ"), "expected subscript n in: \(result)")
        XCTAssertTrue(result.contains("²"), "expected superscript 2 in: \(result)")
        XCTAssertTrue(result.contains("/"), "expected fraction slash in: \(result)")
    }

    func testPythagoreanTheorem() {
        XCTAssertEqual(UnicodeMathBackend.convert(#"a^2 + b^2 = c^2"#), "a² + b² = c²")
    }

    // MARK: 未知命令

    func testUnknownCommandStrippedOfBackslash() {
        // 未知命令保留字母名，去掉反斜杠前缀，不丢信息。
        let result = UnicodeMathBackend.convert(#"\foobar{x}"#)
        XCTAssertTrue(result.contains("foobar"), "expected unknown command name retained: \(result)")
        XCTAssertFalse(result.contains("\\"), "no stray backslash: \(result)")
    }

    // MARK: FormulaView 默认后端

    @MainActor
    func testDefaultBackendIsAvailable() {
        // defaultBackend：iOS 且 iosMath 可导入时为 IosMathBackend，否则回退 UnicodeMathBackend
        // （macOS CI 无 UIKit，走 Unicode 降级）。
        let backend = FormulaView.defaultBackend
        #if canImport(UIKit) && canImport(iosMath)
        XCTAssertTrue(backend is IosMathBackend, "expected IosMathBackend when iosMath available, got \(type(of: backend))")
        #else
        XCTAssertTrue(backend is UnicodeMathBackend, "expected UnicodeMathBackend fallback, got \(type(of: backend))")
        #endif
    }
}
