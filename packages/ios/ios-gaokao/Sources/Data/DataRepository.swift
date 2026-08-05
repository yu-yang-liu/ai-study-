import Foundation
import SwiftData
import CoreKit

/// 数据仓库：封装 SwiftData 读写操作
/// 使用 @ModelActor 保证线程安全
@ModelActor
public actor DataRepository {
    /// 当前学段（从 AppEnvironment 读取）
    private let phase: String

    public init(modelContainer: ModelContainer, phase: String = AppEnvironment.phase) {
        let modelContext = ModelContext(modelContainer)
        modelContext.autosaveEnabled = true
        self.modelExecutor = DefaultSerialModelExecutor(modelContext: modelContext)
        self.modelContainer = modelContainer
        self.phase = phase
    }

    // MARK: - 对话历史

    public func saveChatHistory(title: String, subject: String, messages: [CodableChatMessage]) async {
        let json = (try? JSONEncoder().encode(messages).base64EncodedString()) ?? "[]"
        await deleteChatHistory(byTitle: title)

        let record = ChatHistoryRecord(
            phase: phase,
            title: title,
            subject: subject,
            messagesJSON: json
        )
        modelContext.insert(record)
        try? modelContext.save()
    }

    public func fetchChatHistories(limit: Int = 20) async -> [ChatHistoryRecord] {
        let phase = self.phase
        var descriptor = FetchDescriptor<ChatHistoryRecord>(
            predicate: #Predicate { $0.phase == phase },
            sortBy: [SortDescriptor(\.updatedAt, order: .reverse)]
        )
        descriptor.fetchLimit = limit
        return (try? modelContext.fetch(descriptor)) ?? []
    }

    public func fetchChatMessages(title: String) async -> [CodableChatMessage] {
        var descriptor = FetchDescriptor<ChatHistoryRecord>(
            predicate: #Predicate { $0.title == title }
        )
        descriptor.fetchLimit = 1
        guard let record = try? modelContext.fetch(descriptor).first,
              let data = Data(base64Encoded: record.messagesJSON) else {
            return []
        }
        return (try? JSONDecoder().decode([CodableChatMessage].self, from: data)) ?? []
    }

    public func deleteChatHistory(byTitle title: String) async {
        var descriptor = FetchDescriptor<ChatHistoryRecord>(
            predicate: #Predicate { $0.title == title }
        )
        if let records = try? modelContext.fetch(descriptor) {
            for record in records {
                modelContext.delete(record)
            }
            try? modelContext.save()
        }
    }

    // MARK: - 批改记录

    public func saveGradeRecord(
        subject: String,
        questionType: String,
        questionContent: String,
        studentAnswer: String,
        resultJSON: String,
        score: Double,
        maxScore: Double
    ) async {
        let record = GradeRecord(
            phase: phase,
            subject: subject,
            questionType: questionType,
            questionContent: questionContent,
            studentAnswer: studentAnswer,
            resultJSON: resultJSON,
            score: score,
            maxScore: maxScore
        )
        modelContext.insert(record)
        try? modelContext.save()
    }

    public func fetchGradeRecords(subject: String? = nil, limit: Int = 30) async -> [GradeRecord] {
        let phase = self.phase
        var descriptor: FetchDescriptor<GradeRecord>
        if let subject = subject {
            descriptor = FetchDescriptor<GradeRecord>(
                predicate: #Predicate { $0.phase == phase && $0.subject == subject },
                sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
            )
        } else {
            descriptor = FetchDescriptor<GradeRecord>(
                predicate: #Predicate { $0.phase == phase },
                sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
            )
        }
        descriptor.fetchLimit = limit
        return (try? modelContext.fetch(descriptor)) ?? []
    }

    // MARK: - 学习计划

    public func savePlanCache(subject: String, focus: String?, planJSON: String) async {
        await deletePlanCache(subject: subject, focus: focus)
        let cache = PlanCache(
            phase: phase,
            subject: subject,
            focus: focus,
            planJSON: planJSON
        )
        modelContext.insert(cache)
        try? modelContext.save()
    }

    public func fetchLatestPlan(subject: String? = nil) async -> PlanCache? {
        let phase = self.phase
        var descriptor: FetchDescriptor<PlanCache>
        if let subject = subject {
            descriptor = FetchDescriptor<PlanCache>(
                predicate: #Predicate { $0.phase == phase && $0.subject == subject },
                sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
            )
        } else {
            descriptor = FetchDescriptor<PlanCache>(
                predicate: #Predicate { $0.phase == phase },
                sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
            )
        }
        descriptor.fetchLimit = 1
        return try? modelContext.fetch(descriptor).first
    }

    public func deletePlanCache(subject: String, focus: String?) async {
        var descriptor = FetchDescriptor<PlanCache>(
            predicate: #Predicate { $0.subject == subject }
        )
        if let records = try? modelContext.fetch(descriptor) {
            for record in records {
                if record.focus == focus {
                    modelContext.delete(record)
                }
            }
            try? modelContext.save()
        }
    }

    // MARK: - 用户设置

    /// 获取或创建用户设置（单例）
    public func fetchOrCreateSettings() async -> UserSettings {
        let id = UserSettings.singletonID
        var descriptor = FetchDescriptor<UserSettings>(
            predicate: #Predicate { $0.id == id }
        )
        descriptor.fetchLimit = 1
        if let existing = try? modelContext.fetch(descriptor).first {
            return existing
        }
        let settings = UserSettings()
        modelContext.insert(settings)
        try? modelContext.save()
        return settings
    }

    /// 更新用户设置
    public func updateSettings(
        nickname: String? = nil,
        examDate: Date? = nil,
        targetScore: Double? = nil,
        notificationsEnabled: Bool? = nil,
        gradeLevel: String? = nil,
        track: String? = nil,
        themeMode: String? = nil,
        lastAcademicYearChecked: String? = nil
    ) async {
        let settings = await fetchOrCreateSettings()
        if let v = nickname { settings.nickname = v }
        if let v = examDate { settings.examDate = v }
        if let v = targetScore { settings.targetScore = v }
        if let v = notificationsEnabled { settings.notificationsEnabled = v }
        if let v = gradeLevel { settings.gradeLevel = v }
        if let v = track { settings.track = v }
        if let v = themeMode { settings.themeMode = v }
        if let v = lastAcademicYearChecked { settings.lastAcademicYearChecked = v }
        settings.updatedAt = Date()
        try? modelContext.save()
    }

    /// 智能推进考试年份
    public func autoAdvanceExamYearIfNeeded() async -> Bool {
        let settings = await fetchOrCreateSettings()
        if settings.needsExamYearUpdate() {
            settings.autoAdvanceExamYear()
            try? modelContext.save()
            return true
        }
        return false
    }
}
