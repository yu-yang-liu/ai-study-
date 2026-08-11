import XCTest
@testable import ios_gaokao

final class ChatHistoryCodableTests: XCTestCase {
    func testLegacyMessageJSONStillDecodes() throws {
        let data = Data(
            #"{"role":"user","content":"旧消息","timestamp":0}"#.utf8
        )

        let message = try JSONDecoder().decode(CodableChatMessage.self, from: data)

        XCTAssertEqual(message.role, "user")
        XCTAssertEqual(message.content, "旧消息")
        XCTAssertNil(message.imagePreviewBase64)
        XCTAssertNil(message.action)
        XCTAssertNil(message.analyzeResult)
        XCTAssertNil(message.replyBlocks)
    }

    func testRichMessageRoundTripsOptionalFields() throws {
        let message = CodableChatMessage(
            role: "assistant",
            content: "分析完成",
            timestamp: Date(timeIntervalSince1970: 1_754_880_000),
            imagePreviewBase64: Data("preview".utf8).base64EncodedString()
        )

        let encoded = try JSONEncoder().encode(message)
        let decoded = try JSONDecoder().decode(CodableChatMessage.self, from: encoded)

        XCTAssertEqual(decoded.imagePreviewBase64, message.imagePreviewBase64)
        XCTAssertEqual(decoded.content, message.content)
    }
}
