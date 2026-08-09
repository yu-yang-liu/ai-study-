import XCTest
@testable import ApiContracts

final class ContentBlockTests: XCTestCase {

    // MARK: 单块解码

    func testDecodeTextBlock() throws {
        let json = #"{"type":"text","content":"设函数 f(x)"}"#.data(using: .utf8)!
        let block = try JSONDecoder().decode(ContentBlock.self, from: json)
        XCTAssertEqual(block, .text(content: "设函数 f(x)"))
    }

    func testDecodeFormulaBlockUsesLatex() throws {
        let json = #"{"type":"formula","latex":"\\frac{1}{2}"}"#.data(using: .utf8)!
        let block = try JSONDecoder().decode(ContentBlock.self, from: json)
        XCTAssertEqual(block, .formula(latex: "\\frac{1}{2}"))
    }

    func testDecodeFormulaFallsBackToContentForOcrCompat() throws {
        // OCR 旧格式把公式放在 content 字段，无 latex。
        let json = #"{"type":"formula","content":"x^2+1"}"#.data(using: .utf8)!
        let block = try JSONDecoder().decode(ContentBlock.self, from: json)
        XCTAssertEqual(block, .formula(latex: "x^2+1"))
    }

    func testDecodeFormulaMissingBothLatexAndContentYieldsEmptyLatex() throws {
        let json = #"{"type":"formula"}"#.data(using: .utf8)!
        let block = try JSONDecoder().decode(ContentBlock.self, from: json)
        XCTAssertEqual(block, .formula(latex: ""))
    }

    func testDecodeTextMissingContentYieldsEmptyString() throws {
        let json = #"{"type":"text"}"#.data(using: .utf8)!
        let block = try JSONDecoder().decode(ContentBlock.self, from: json)
        XCTAssertEqual(block, .text(content: ""))
    }

    func testDecodeImageBlockWithAlt() throws {
        let json = #"{"type":"image","url":"fig.png","alt":"直角三角形"}"#.data(using: .utf8)!
        let block = try JSONDecoder().decode(ContentBlock.self, from: json)
        XCTAssertEqual(block, .image(url: "fig.png", alt: "直角三角形"))
    }

    func testDecodeImageBlockWithoutAlt() throws {
        let json = #"{"type":"image","url":"fig.png"}"#.data(using: .utf8)!
        let block = try JSONDecoder().decode(ContentBlock.self, from: json)
        XCTAssertEqual(block, .image(url: "fig.png", alt: nil))
    }

    func testDecodeUnknownTypeDegradesToEmptyText() throws {
        let json = #"{"type":"geometry","content":"whatever"}"#.data(using: .utf8)!
        let block = try JSONDecoder().decode(ContentBlock.self, from: json)
        XCTAssertEqual(block, .text(content: ""))
    }

    // MARK: 往返编码

    func testEncodeRoundTripText() throws {
        let block: ContentBlock = .text(content: "解析步骤")
        let data = try JSONEncoder().encode(block)
        let decoded = try JSONDecoder().decode(ContentBlock.self, from: data)
        XCTAssertEqual(block, decoded)
    }

    func testEncodeRoundTripFormula() throws {
        let block: ContentBlock = .formula(latex: "a^2+b^2=c^2")
        let data = try JSONEncoder().encode(block)
        let decoded = try JSONDecoder().decode(ContentBlock.self, from: data)
        XCTAssertEqual(block, decoded)
    }

    func testEncodeRoundTripImage() throws {
        let block: ContentBlock = .image(url: "u", alt: "示意图")
        let data = try JSONEncoder().encode(block)
        let decoded = try JSONDecoder().decode(ContentBlock.self, from: data)
        XCTAssertEqual(block, decoded)
    }

    // MARK: 整响解码

    func testDecodeAnalyzeResponseWithBlocks() throws {
        let json = """
        {
            "subject": "数学",
            "questionType": "计算题",
            "knowledgePoints": ["二次函数"],
            "difficulty": 6,
            "answer": "x=2",
            "analysis": "解得 x=2",
            "examPoints": null,
            "answerBlocks": [
                {"type": "text", "content": "x="},
                {"type": "formula", "latex": "2"}
            ],
            "analysisBlocks": [{"type": "formula", "latex": "\\\\frac{1}{2}"}],
            "examPointsBlocks": null
        }
        """.data(using: .utf8)!
        let resp = try JSONDecoder().decode(AnalyzeResponse.self, from: json)
        XCTAssertEqual(resp.answerBlocks?.count, 2)
        XCTAssertEqual(resp.answerBlocks?.first, .text(content: "x="))
        XCTAssertEqual(resp.answerBlocks?.last, .formula(latex: "2"))
        XCTAssertEqual(resp.analysisBlocks, [.formula(latex: "\\frac{1}{2}")])
        XCTAssertNil(resp.examPointsBlocks)
        // string 字段仍可读（后端派生回填，旧响应兼容）。
        XCTAssertEqual(resp.answer, "x=2")
        XCTAssertEqual(resp.analysis, "解得 x=2")
    }

    func testDecodeAnalyzeResponseWithoutBlocksStillWorks() throws {
        // 旧后端响应无 *Blocks 字段，解码为 nil 不崩。
        let json = """
        {
            "subject": "数学",
            "questionType": "计算题",
            "knowledgePoints": ["二次函数"],
            "difficulty": 6,
            "answer": "x=2",
            "analysis": "解得 x=2"
        }
        """.data(using: .utf8)!
        let resp = try JSONDecoder().decode(AnalyzeResponse.self, from: json)
        XCTAssertNil(resp.answerBlocks)
        XCTAssertNil(resp.analysisBlocks)
        XCTAssertNil(resp.examPointsBlocks)
        XCTAssertEqual(resp.answer, "x=2")
    }

    func testDecodeGradeMathResponseWithBlocks() throws {
        let json = """
        {
            "score": 85,
            "maxScore": 100,
            "isCorrect": true,
            "steps": [
                {
                    "stepNumber": 1,
                    "isCorrect": true,
                    "feedback": "第一步正确",
                    "feedbackBlocks": [
                        {"type": "text", "content": "第一步"},
                        {"type": "formula", "latex": "x^2"}
                    ]
                }
            ],
            "summary": "总体良好",
            "summaryBlocks": [{"type": "text", "content": "总体评价"}]
        }
        """.data(using: .utf8)!
        let resp = try JSONDecoder().decode(GradeMathResponse.self, from: json)
        XCTAssertEqual(resp.summaryBlocks, [.text(content: "总体评价")])
        XCTAssertEqual(resp.steps.first?.feedbackBlocks?.count, 2)
        XCTAssertEqual(resp.steps.first?.feedbackBlocks?.last, .formula(latex: "x^2"))
    }

    func testDecodeGradeMathResponseWithoutBlocksStillWorks() throws {
        let json = """
        {
            "score": 85,
            "maxScore": 100,
            "isCorrect": true,
            "steps": [{"stepNumber": 1, "isCorrect": true, "feedback": "对"}],
            "summary": "总体良好"
        }
        """.data(using: .utf8)!
        let resp = try JSONDecoder().decode(GradeMathResponse.self, from: json)
        XCTAssertNil(resp.summaryBlocks)
        XCTAssertNil(resp.steps.first?.feedbackBlocks)
    }

    // MARK: Phase 1 新块类型（table / steps / visual）

    func testDecodeTableBlock() throws {
        let json = #"{"type":"table","headers":["公式","值"],"rows":[["x^2","4"],["\\sqrt{2}","1.41"]]}"#.data(using: .utf8)!
        let block = try JSONDecoder().decode(ContentBlock.self, from: json)
        XCTAssertEqual(block, .table(headers: ["公式", "值"], rows: [["x^2", "4"], ["\\sqrt{2}", "1.41"]]))
    }

    func testDecodeTableWithoutHeaders() throws {
        let json = #"{"type":"table","rows":[["1","2"]]}"#.data(using: .utf8)!
        let block = try JSONDecoder().decode(ContentBlock.self, from: json)
        XCTAssertEqual(block, .table(headers: nil, rows: [["1", "2"]]))
    }

    func testDecodeStepsBlock() throws {
        let json = """
        {
          "type": "steps",
          "title": "配方法",
          "interaction": {"collapsible": true},
          "steps": [
            {"title": "第一步", "isCorrect": true, "tag": "配方",
             "blocks": [{"type": "text", "content": "移项"}, {"type": "formula", "latex": "x^2=4"}]}
          ]
        }
        """.data(using: .utf8)!
        let block = try JSONDecoder().decode(ContentBlock.self, from: json)
        XCTAssertEqual(
            block,
            .steps(
                title: "配方法",
                steps: [
                    StepContent(
                        title: "第一步",
                        blocks: [.text(content: "移项"), .formula(latex: "x^2=4")],
                        isCorrect: true,
                        tag: "配方"
                    ),
                ],
                interaction: InteractionHint(collapsible: true, selectable: nil)
            )
        )
    }

    func testDecodeStepsMissingBlocksYieldsEmptyBlocks() throws {
        // 非法/残缺步骤不导致整块解码失败（客户端解析稳定）。
          let json = #"{"type":"steps","title":"第一步","steps":[{"title":"第一步"}]}"#.data(using: .utf8)!
        let block = try JSONDecoder().decode(ContentBlock.self, from: json)
        guard case .steps(let title, let steps, let interaction) = block else {
            return XCTFail("expected steps block")
        }
        XCTAssertEqual(title, "第一步")
        XCTAssertEqual(steps.first?.blocks, [])
        XCTAssertNil(interaction)
    }

    func testDecodeVisualBlockDefaultsToPlaceholder() throws {
        let json = #"{"type":"visual"}"#.data(using: .utf8)!
        let block = try JSONDecoder().decode(ContentBlock.self, from: json)
        XCTAssertEqual(block, .visual(kind: "placeholder", geometry: nil))
    }

    func testDecodeVisualGeometryKind() throws {
        let json = #"{"type":"visual","kind":"geometry"}"#.data(using: .utf8)!
        let block = try JSONDecoder().decode(ContentBlock.self, from: json)
        XCTAssertEqual(block, .visual(kind: "geometry", geometry: nil))
    }

    func testDecodeVisualWithGeometryAST() throws {
        let json = """
        {
          "type": "visual",
          "kind": "geometry",
          "geometry": {
            "type": "scene",
            "elements": [
              {"type": "triangle", "vertices": [[0,0],[5,0],[2,3.5]], "labels": ["A","B","C"]},
              {"type": "angle", "vertex": [0,0], "from": [5,0], "to": [2,3.5], "degrees": 60}
            ]
          }
        }
        """.data(using: .utf8)!
        let block = try JSONDecoder().decode(ContentBlock.self, from: json)
        guard case .visual(let kind, let geometry) = block else {
            return XCTFail("expected visual block")
        }
        XCTAssertEqual(kind, "geometry")
        guard case .scene(let elements, _) = geometry else {
            return XCTFail("expected scene geometry")
        }
        XCTAssertEqual(elements.count, 2)
        XCTAssertEqual(elements[0].type, "triangle")
        XCTAssertEqual(elements[1].type, "angle")
    }

    func testEncodeRoundTripTable() throws {
        let block: ContentBlock = .table(headers: ["a"], rows: [["1"], ["2"]])
        let data = try JSONEncoder().encode(block)
        let decoded = try JSONDecoder().decode(ContentBlock.self, from: data)
        XCTAssertEqual(block, decoded)
    }

    func testEncodeRoundTripSteps() throws {
        let block: ContentBlock = .steps(
            title: "解法",
            steps: [StepContent(blocks: [.formula(latex: "x=2")], isCorrect: true)],
            interaction: InteractionHint(collapsible: true)
        )
        let data = try JSONEncoder().encode(block)
        let decoded = try JSONDecoder().decode(ContentBlock.self, from: data)
        XCTAssertEqual(block, decoded)
    }

    func testEncodeRoundTripVisualWithGeometry() throws {
        let block: ContentBlock = .visual(
            kind: "geometry",
            geometry: .scene(
                elements: [.point(x: 1, y: 2, label: "P")],
                bounds: nil
            )
        )
        let data = try JSONEncoder().encode(block)
        let decoded = try JSONDecoder().decode(ContentBlock.self, from: data)
        XCTAssertEqual(block, decoded)
    }
}
