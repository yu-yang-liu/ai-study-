import XCTest
@testable import ApiContracts

final class P2CompatibilityTests: XCTestCase {
    func testOldWrongQuestionPayloadUsesSafeDefaults() throws {
        let data = """
        {
          "id": "wrong-1",
          "questionContent": "2 + 2 = ?",
          "studentAnswer": "5",
          "correctAnswer": "4",
          "subject": "数学",
          "knowledgePoint": "基础运算",
          "createdAt": "2026-08-11T00:00:00Z",
          "nextReviewAt": "2026-08-12T00:00:00Z",
          "sm2_interval": 1,
          "sm2_ease": 2.5
        }
        """.data(using: .utf8)!

        let item = try JSONDecoder().decode(WrongQuestionItem.self, from: data)
        XCTAssertEqual(item.questionId, "wrong-1")
        XCTAssertEqual(item.knowledgePoints, [])
        XCTAssertNil(item.errorType)
        XCTAssertEqual(item.analysis, "")
        XCTAssertFalse(item.isFavorite)
    }

    func testDecodeGeometryExtensionElements() throws {
        let data = """
        {
          "type": "scene",
          "elements": [
            {"type":"conic","kind":"ellipse","center":[0,0],"a":4,"b":2},
            {"type":"box","vertices":[[0,0],[1,0],[1,1],[0,1],[0.2,0.2],[1.2,0.2],[1.2,1.2],[0.2,1.2]],"faces":[[0,1,2,3],[4,5,6,7]]},
            {"type":"cylinder","base":[3,0],"radius":1,"height":2,"direction":[0,1]},
            {"type":"cone","base":[6,0],"radius":1,"height":2,"direction":[0,1]},
            {"type":"relation","from":[0,0],"to":[1,1],"relation":"parallel"}
          ]
        }
        """.data(using: .utf8)!

        guard case .scene(let elements, _) = try JSONDecoder().decode(GeometryAST.self, from: data) else {
            return XCTFail("expected scene")
        }
        XCTAssertEqual(elements.map(\.type), ["conic", "box", "cylinder", "cone", "relation"])
        XCTAssertEqual(elements.first?.a, 4)
        XCTAssertEqual(elements.last?.relation, "parallel")
    }

    func testMolecularBlockRoundTrip() throws {
        let block: ContentBlock = .molecular(
            block: MolecularBlock(
                title: "水分子",
                atoms: [
                    MolecularAtom(id: "o1", symbol: "O", x: 0, y: 0),
                    MolecularAtom(id: "h1", symbol: "H", x: -2, y: 1),
                ],
                bonds: [MolecularBond(from: "o1", to: "h1")]
            )
        )

        let decoded = try JSONDecoder().decode(ContentBlock.self, from: JSONEncoder().encode(block))
        XCTAssertEqual(decoded, block)
    }
}
