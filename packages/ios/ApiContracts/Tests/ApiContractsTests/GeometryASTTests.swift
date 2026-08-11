import XCTest
@testable import ApiContracts

final class GeometryASTTests: XCTestCase {

    // MARK: 解码

    func testDecodeScene() throws {
        let json = """
        {
          "type": "scene",
          "elements": [
            {"type": "triangle", "vertices": [[0,0],[5,0],[2,3.5]], "labels": ["A","B","C"]},
            {"type": "angle", "vertex": [0,0], "from": [5,0], "to": [2,3.5], "degrees": 60}
          ]
        }
        """.data(using: .utf8)!
        let ast = try JSONDecoder().decode(GeometryAST.self, from: json)
        guard case .scene(let elements, let bounds) = ast else {
            return XCTFail("expected scene")
        }
        XCTAssertEqual(elements.count, 2)
        XCTAssertEqual(elements[0].type, "triangle")
        XCTAssertEqual(elements[0].labels, ["A", "B", "C"])
        XCTAssertEqual(elements[1].degrees, 60)
        XCTAssertNil(bounds)
    }

    func testDecodeSceneWithBounds() throws {
        let json = #"{"type":"scene","elements":[],"bounds":{"xMin":-1,"yMin":-1,"xMax":11,"yMax":11}}"#
            .data(using: .utf8)!
        let ast = try JSONDecoder().decode(GeometryAST.self, from: json)
        guard case .scene(_, let bounds) = ast else {
            return XCTFail("expected scene")
        }
        XCTAssertEqual(bounds?.xMin, -1)
        XCTAssertEqual(bounds?.xMax, 11)
        XCTAssertEqual(bounds?.yMax, 11)
    }

    func testDecodeFieldAndRayElements() throws {
        let json = """
        {
          "type": "scene",
          "elements": [
            {"type": "field", "kind": "electric", "from": [0,0], "to": [6,0], "width": 4, "density": 5, "label": "E"},
            {"type": "ray", "points": [[-4,3],[0,0],[4,3]], "arrow": "end", "style": "dashed"}
          ]
        }
        """.data(using: .utf8)!
        let ast = try JSONDecoder().decode(GeometryAST.self, from: json)
        guard case .scene(let elements, _) = ast else {
            return XCTFail("expected scene")
        }
        XCTAssertEqual(elements.count, 2)
        let field = elements[0]
        XCTAssertEqual(field.type, "field")
        XCTAssertEqual(field.kind, "electric")
        XCTAssertEqual(field.width, 4)
        XCTAssertEqual(field.density, 5)
        XCTAssertEqual(field.from, [0, 0])
        XCTAssertEqual(field.to, [6, 0])
        let ray = elements[1]
        XCTAssertEqual(ray.type, "ray")
        XCTAssertEqual(ray.points, [[-4, 3], [0, 0], [4, 3]])
        XCTAssertEqual(ray.arrow, "end")
        XCTAssertEqual(ray.style, "dashed")
    }


    func testDecodeCoordinateSystem() throws {
        let json = """
        {
          "type": "coordinateSystem",
          "xRange": [-3, 3],
          "yRange": [-1, 6],
          "showGrid": true,
          "children": [
            {"type": "functionCurve", "expr": "x^2", "label": "y=x²"}
          ]
        }
        """.data(using: .utf8)!
        let ast = try JSONDecoder().decode(GeometryAST.self, from: json)
        guard case .coordinateSystem(let xRange, let yRange, _, _, let showGrid, let children) = ast else {
            return XCTFail("expected coordinateSystem")
        }
        XCTAssertEqual(xRange, [-3, 3])
        XCTAssertEqual(yRange, [-1, 6])
        XCTAssertEqual(showGrid, true)
        XCTAssertEqual(children.count, 1)
        XCTAssertEqual(children[0].type, "functionCurve")
        XCTAssertEqual(children[0].expr, "x^2")
    }

    func testDecodeUnknownRootTypeFallsBackToEmptyScene() throws {
        let json = #"{"type":"picture"}"#.data(using: .utf8)!
        let ast = try JSONDecoder().decode(GeometryAST.self, from: json)
        guard case .scene(let elements, _) = ast else {
            return XCTFail("expected empty scene fallback")
        }
        XCTAssertTrue(elements.isEmpty)
    }

    // MARK: 往返编码

    func testEncodeRoundTripScene() throws {
        let ast = GeometryAST.scene(
            elements: [
                .triangle(vertices: [[0, 0], [5, 0], [2, 3.5]], labels: ["A", "B", "C"]),
                .angle(vertex: [0, 0], from: [5, 0], to: [2, 3.5], degrees: 60),
            ],
            bounds: nil
        )
        let data = try JSONEncoder().encode(ast)
        let decoded = try JSONDecoder().decode(GeometryAST.self, from: data)
        XCTAssertEqual(ast, decoded)
    }

    func testEncodeRoundTripCoordinateSystem() throws {
        let ast = GeometryAST.coordinateSystem(
            xRange: [-3, 3],
            yRange: [-1, 6],
            xStep: 1,
            yStep: nil,
            showGrid: true,
            children: [.functionCurve(expr: "x^2")]
        )
        let data = try JSONEncoder().encode(ast)
        let decoded = try JSONDecoder().decode(GeometryAST.self, from: data)
        XCTAssertEqual(ast, decoded)
    }
}
