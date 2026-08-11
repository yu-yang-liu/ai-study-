import XCTest
@testable import ApiContracts

final class P1SyncModelsTests: XCTestCase {
    func testProfileResponseDecoding() throws {
        let data = #"{"nickname":"小明","examDate":"2026-06-07T09:00:00.000Z","targetScore":650,"notificationsEnabled":false,"gradeLevel":"高三","track":"理科","themeMode":"dark"}"#.data(using: .utf8)!
        let response = try JSONDecoder().decode(ProfileResponse.self, from: data)

        XCTAssertEqual(response.nickname, "小明")
        XCTAssertEqual(response.targetScore, 650)
        XCTAssertEqual(response.notificationsEnabled, false)
        XCTAssertEqual(response.themeMode, "dark")
    }

    func testActivePlanAndGradeHistoryDecoding() throws {
        let data = #"""
        {
          "plan": {
            "title": "今日计划",
            "description": "复习重点",
            "tasks": [],
            "createdAt": "2026-08-11T08:00:00.000Z"
          }
        }
        """#.data(using: .utf8)!
        let activePlan = try JSONDecoder().decode(ActivePlanResponse.self, from: data)
        XCTAssertEqual(activePlan.plan?.title, "今日计划")

        let historyData = #"{"records":[{"id":"q1","subject":"数学","questionType":"计算题","questionContent":"2+2=?","studentAnswer":"4","score":100,"maxScore":100,"resultJSON":null,"createdAt":"2026-08-11T08:00:00.000Z"}]}"#.data(using: .utf8)!
        let history = try JSONDecoder().decode(GradeHistoryResponse.self, from: historyData)
        XCTAssertEqual(history.records.first?.id, "q1")
        XCTAssertEqual(history.records.first?.score, 100)
    }

    func testManualWrongQuestionRequestEncoding() throws {
        let request = AddWrongQuestionRequest(
            subject: "数学",
            questionContent: "函数题",
            studentAnswer: "不会",
            correctAnswer: "见解析",
            knowledgePoints: ["导数"],
            errorType: "概念混淆"
        )
        let object = try JSONSerialization.jsonObject(with: JSONEncoder().encode(request)) as? [String: Any]

        XCTAssertEqual(object?["subject"] as? String, "数学")
        XCTAssertEqual(object?["knowledgePoints"] as? [String], ["导数"])
        XCTAssertEqual(object?["errorType"] as? String, "概念混淆")
    }
}
