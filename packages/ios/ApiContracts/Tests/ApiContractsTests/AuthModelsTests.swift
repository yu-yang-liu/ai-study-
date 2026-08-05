import XCTest
@testable import ApiContracts

final class AuthModelsTests: XCTestCase {
    func testLoginRequestEncoding() throws {
        let req = LoginRequest(email: "test@example.com", password: "password123")
        let data = try JSONEncoder().encode(req)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: String]
        XCTAssertEqual(json?["email"], "test@example.com")
        XCTAssertEqual(json?["password"], "password123")
    }

    func testLoginResponseDecoding() throws {
        let json = """
        {
            "user": {"id": "uuid-1", "email": "test@example.com"},
            "session": {"access_token": "jwt-token", "expires_at": 1717200000}
        }
        """.data(using: .utf8)!
        let resp = try JSONDecoder().decode(LoginResponse.self, from: json)
        XCTAssertEqual(resp.user?.id, "uuid-1")
        XCTAssertEqual(resp.session?.accessToken, "jwt-token")
    }

    func testChatResponseDecoding() throws {
        let json = #"{"reply": "你好，有什么可以帮助你的？"}"#.data(using: .utf8)!
        let resp = try JSONDecoder().decode(ChatResponse.self, from: json)
        XCTAssertEqual(resp.reply, "你好，有什么可以帮助你的？")
    }
}
