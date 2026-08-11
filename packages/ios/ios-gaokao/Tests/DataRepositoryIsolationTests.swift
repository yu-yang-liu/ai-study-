import XCTest
import SwiftData
@testable import ios_gaokao

final class DataRepositoryIsolationTests: XCTestCase {
    private func makeRepository() throws -> DataRepository {
        let schema = Schema([
            ChatHistoryRecord.self,
            GradeRecord.self,
            PlanCache.self,
            UserSettings.self,
        ])
        let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
        let container = try ModelContainer(for: schema, configurations: [configuration])
        return DataRepository(modelContainer: container, phase: "test")
    }

    func testUserDataDoesNotLeakAcrossAccounts() async throws {
        let repository = try makeRepository()

        await repository.setCurrentUserID("user-a")
        await repository.saveChatHistory(
            title: "A chat",
            subject: "数学",
            messages: [CodableChatMessage(role: "user", content: "A", timestamp: Date())]
        )
        await repository.saveGradeRecord(
            subject: "数学",
            questionType: "math",
            questionContent: "A question",
            studentAnswer: "A answer",
            resultJSON: "{}",
            score: 8,
            maxScore: 10
        )
        await repository.savePlanCache(
            subject: "数学",
            focus: nil,
            planJSON: #"{"title":"A plan","description":"","tasks":[]}"#
        )
        await repository.updateSettings(nickname: "User A", targetScore: 650)

        await repository.setCurrentUserID("user-b")
        let userBChats = await repository.fetchChatHistories()
        let userBGrades = await repository.fetchGradeRecords()
        let userBPlan = await repository.fetchLatestPlan(subject: "数学")
        XCTAssertTrue(userBChats.isEmpty)
        XCTAssertTrue(userBGrades.isEmpty)
        XCTAssertNil(userBPlan)

        let userBSettings = await repository.fetchOrCreateSettings()
        XCTAssertNotEqual(userBSettings.nickname, "User A")
        XCTAssertNotEqual(userBSettings.targetScore, 650)

        await repository.setCurrentUserID("user-a")
        let userAChats = await repository.fetchChatHistories()
        let userAGrades = await repository.fetchGradeRecords()
        let userAPlan = await repository.fetchLatestPlan(subject: "数学")
        XCTAssertEqual(userAChats.count, 1)
        XCTAssertEqual(userAGrades.count, 1)
        XCTAssertNotNil(userAPlan)

        let userASettings = await repository.fetchOrCreateSettings()
        XCTAssertEqual(userASettings.nickname, "User A")
        XCTAssertEqual(userASettings.targetScore, 650)
    }

    func testLogoutClearsActiveRepositoryScope() async throws {
        let repository = try makeRepository()

        await repository.setCurrentUserID("user-a")
        await repository.saveGradeRecord(
            subject: "物理",
            questionType: "math",
            questionContent: "A question",
            studentAnswer: "A answer",
            resultJSON: "{}",
            score: 9,
            maxScore: 10
        )

        await repository.clearCurrentUser()

        let chatsAfterLogout = await repository.fetchChatHistories()
        let gradesAfterLogout = await repository.fetchGradeRecords()
        let planAfterLogout = await repository.fetchLatestPlan()
        XCTAssertTrue(chatsAfterLogout.isEmpty)
        XCTAssertTrue(gradesAfterLogout.isEmpty)
        XCTAssertNil(planAfterLogout)
    }

    func testLegacyRecordsAreAdoptedByFirstAuthenticatedUser() async throws {
        let schema = Schema([
            ChatHistoryRecord.self,
            GradeRecord.self,
            PlanCache.self,
            UserSettings.self,
        ])
        let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
        let container = try ModelContainer(for: schema, configurations: [configuration])
        let context = ModelContext(container)

        context.insert(
            ChatHistoryRecord(
                phase: "test",
                title: "Legacy chat",
                subject: "数学",
                messagesJSON: "[]"
            )
        )
        context.insert(
            UserSettings(
                id: UserSettings.singletonID,
                nickname: "Legacy user"
            )
        )
        try context.save()

        let repository = DataRepository(modelContainer: container, phase: "test")
        await repository.setCurrentUserID("user-a")

        let adoptedChats = await repository.fetchChatHistories()
        let adoptedSettings = await repository.fetchOrCreateSettings()
        XCTAssertEqual(adoptedChats.first?.title, "Legacy chat")
        XCTAssertEqual(adoptedSettings.nickname, "Legacy user")
    }
}
