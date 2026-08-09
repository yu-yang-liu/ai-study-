import ApiContracts
@testable import CoreKit
import XCTest

final class GeometryTests: XCTestCase {

    // MARK: ExpressionEvaluator

    private func expect(_ expr: String, _ x: Double, _ expected: Double) throws {
        let value = try XCTUnwrap(ExpressionEvaluator.evaluate(expr, x: x), "\(expr) should evaluate")
        XCTAssertEqual(value, expected, accuracy: 1e-9, "\(expr) at x=\(x)")
    }

    func testEvaluatorArithmetic() throws {
        try expect("1 + 2 * 3", 0, 7)
        try expect("(1 + 2) * 3", 0, 9)
        try expect("10 - 4 / 2", 0, 8)
    }

    func testEvaluatorPowerRightAssociative() throws {
        try expect("2^3", 0, 8)
        try expect("2^3^2", 0, 512)
    }

    func testEvaluatorUnaryMinusPrecedence() throws {
        // -2^2 = -(2^2)
        try expect("-2^2", 0, -4)
        try expect("(-2)^2", 0, 4)
        try expect("2^-2", 0, 0.25)
    }

    func testEvaluatorVariableAndConstants() throws {
        try expect("x + 1", 3, 4)
        try expect("2*x^2 - 3*x + 1", 2, 3)
        try expect("pi", 0, Double.pi)
        try expect("e", 0, M_E)
    }

    func testEvaluatorFunctions() throws {
        try expect("sqrt(9)", 0, 3)
        try expect("sin(pi/2)", 0, 1)
        try expect("cos(0)", 0, 1)
        try expect("abs(-5)", 0, 5)
        try expect("log(100)", 0, 2)
        try expect("ln(e)", 0, 1)
        try expect("min(2, 5)", 0, 2)
        try expect("max(2, 5)", 0, 5)
    }

    func testEvaluatorInvalidReturnsNil() {
        for bad in ["", "2+", "2**3", "2x", "foo(1)", "sqrt(-1)", "1/0", "(", "2 +"] {
            XCTAssertNil(ExpressionEvaluator.evaluate(bad, x: 0), "\(bad) should be nil")
        }
    }

    // MARK: GeometryBounds

    func testBoundsSceneAutoFit() {
        let ast = GeometryAST.scene(
            elements: [
                .triangle(vertices: [[0, 0], [5, 0], [2, 3.5]], labels: ["A", "B", "C"]),
            ],
            bounds: nil
        )
        let bounds = GeometryBounds.compute(ast)
        XCTAssertEqual(bounds.xMin, 0)
        XCTAssertEqual(bounds.yMin, 0)
        XCTAssertEqual(bounds.xMax, 5)
        XCTAssertEqual(bounds.yMax, 3.5, accuracy: 1e-9)
    }

    func testBoundsCoordinateSystemUsesRanges() {
        let ast = GeometryAST.coordinateSystem(
            xRange: [-3, 3],
            yRange: [-1, 6],
            xStep: nil,
            yStep: nil,
            showGrid: true,
            children: [.functionCurve(expr: "x^2")]
        )
        let bounds = GeometryBounds.compute(ast)
        XCTAssertEqual(bounds.xMin, -3)
        XCTAssertEqual(bounds.xMax, 3)
        XCTAssertEqual(bounds.yMin, -1)
        XCTAssertEqual(bounds.yMax, 6)
    }

    func testBoundsEmptySceneFallsBack() {
        let bounds = GeometryBounds.compute(.scene(elements: [], bounds: nil))
        XCTAssertEqual(bounds.xMin, -5)
        XCTAssertEqual(bounds.xMax, 5)
    }

    // MARK: CoordinateTransformer

    func testTransformerMapsBoundsWithYFlip() {
        let bounds = SceneBounds(xMin: 0, yMin: 0, xMax: 10, yMax: 10)
        let transformer = CoordinateTransformer(bounds: bounds, width: 200, height: 200, padding: 0)
        XCTAssertEqual(transformer.x(0), 0, accuracy: 0.001)
        XCTAssertEqual(transformer.x(10), 200, accuracy: 0.001)
        // y 向上翻转：数学 y=0 → 屏幕底部，y=10 → 屏幕顶部。
        XCTAssertEqual(transformer.y(0), 200, accuracy: 0.001)
        XCTAssertEqual(transformer.y(10), 0, accuracy: 0.001)
    }

    func testTransformerRespectsPadding() {
        let bounds = SceneBounds(xMin: 0, yMin: 0, xMax: 10, yMax: 10)
        let transformer = CoordinateTransformer(bounds: bounds, width: 200, height: 200, padding: 20)
        XCTAssertEqual(transformer.x(0), 20, accuracy: 0.001)
        XCTAssertEqual(transformer.x(10), 180, accuracy: 0.001)
    }
}
