import SwiftUI
import CoreKit
import ApiContracts
import UIKit

struct ChatMessage: Identifiable, Sendable {
    let id = UUID()
    let role: Role
    let content: String
    let timestamp: Date
    let action: ChatActionPayload?
    /// 用户消息附带的本地图片（同时写入本地 Chat 历史）
    let imagePreview: Data?
    /// 云端历史恢复时使用的原图地址。
    let imageURL: String?
    /// 助手消息附带的图片分析结果（复用 /api/analyze(imageUrl:)）
    let analyzeResult: AnalyzeResponse?
    /// 助手消息的结构化回复块（双字段过渡：缺省回退 content 文本）。
    let replyBlocks: [ContentBlock]?
    enum Role: String, Sendable { case user, assistant }

    init(
        role: Role,
        content: String,
        timestamp: Date = Date(),
        action: ChatActionPayload? = nil,
        imagePreview: Data? = nil,
        imageURL: String? = nil,
        analyzeResult: AnalyzeResponse? = nil,
        replyBlocks: [ContentBlock]? = nil
    ) {
        self.role = role
        self.content = content
        self.timestamp = timestamp
        self.action = action
        self.imagePreview = imagePreview
        self.imageURL = imageURL
        self.analyzeResult = analyzeResult
        self.replyBlocks = replyBlocks
    }
}

@MainActor
final class ChatViewModel: ObservableObject {
    @Published var messages: LoadingState<[ChatMessage]> = .loaded([])
    @Published var inputText = ""
    @Published var selectedSubject: String = "数学"
    @Published var isSending = false
    @Published var isOffline = false
    @Published var followUpContext: AnalyzeResponse?

    /// 待发送的图片（在输入栏选择后、发送前）
    @Published var pendingImageData: Data?
    @Published var pendingImagePreview: UIImage?
    @Published var imagePreparationError: Error?
    @Published var imageSendError: Error?
    @Published var historySyncError: String?
    @Published var wrongQuestionActionMessage: String?

    let apiClient: APIClient
    private let dataRepository: DataRepository
    private var conversationId: String?
    private var currentTitle: String?
    private var pendingHistorySync: ChatHistoryAppendRequest?

    let subjects: [String] = Subject.allCases.map(\.rawValue)
    let quickChips: [String] = [
        "帮我制定今日学习计划",
        "我的薄弱点在哪里",
        "我有哪些待复习错题",
    ]

    /// 快捷入口 chip 对应的 SF Symbol 图标名。
    /// - Parameter chip: chip 文案（与 `quickChips` 元素一致）。
    /// - Returns: 图标名；未知 chip 兜底 `"sparkles"`。
    func icon(for chip: String) -> String {
        switch chip {
        case "帮我制定今日学习计划": return "calendar.badge.clock"
        case "我的薄弱点在哪里": return "chart.line.uptrend.xyaxis"
        case "我有哪些待复习错题": return "checklist"
        default: return "sparkles"
        }
    }

    init(apiClient: APIClient, dataRepository: DataRepository) {
        self.apiClient = apiClient
        self.dataRepository = dataRepository
        Task { await loadHistory() }
    }

    // MARK: - 待发图片管理

    /// 从 PhotosPicker 设置待发图片
    func setPendingImage(_ data: Data?) {
        guard let data else {
            clearPendingImage()
            return
        }

        do {
            let prepared = try ImageUploadPreparer.prepare(data: data)
            pendingImageData = prepared.data
            pendingImagePreview = prepared.preview
            imagePreparationError = nil
            imageSendError = nil
            followUpContext = nil
        } catch {
            pendingImageData = nil
            pendingImagePreview = nil
            imagePreparationError = error
            imageSendError = nil
            followUpContext = nil
        }
    }

    func clearPendingImage() {
        pendingImageData = nil
        pendingImagePreview = nil
        imagePreparationError = nil
        imageSendError = nil
    }

    func prepareFollowUp(for result: AnalyzeResponse) {
        followUpContext = result
        inputText = ""
    }

    /// Start a focused practice turn based on the analyzed question.
    /// The request is sent immediately while the original analysis remains in context.
    func practiceSimilarQuestion(for result: AnalyzeResponse) async {
        guard !isSending else { return }
        followUpContext = result
        await sendMessage(
            "请给我出一道与这道题考点相近、难度相近的\(result.subject)练习题。先只给题目，不要直接给答案，等我作答后再批改。"
        )
    }

    func clearFollowUpContext() {
        followUpContext = nil
    }

    @discardableResult
    func addToWrongQuestions(_ result: AnalyzeResponse) async -> Bool {
        guard let content = result.questionContent?.trimmingCharacters(in: .whitespacesAndNewlines),
              !content.isEmpty else {
            wrongQuestionActionMessage = "这条图片分析没有可靠题干，暂时不能自动加入错题。"
            return false
        }

        do {
            _ = try await apiClient.addWrongQuestion(
                AddWrongQuestionRequest(
                    subject: result.subject,
                    questionContent: content,
                    studentAnswer: "",
                    correctAnswer: result.answer ?? "",
                    knowledgePoints: result.knowledgePoints
                )
            )
            wrongQuestionActionMessage = "已加入错题复习"
            return true
        } catch {
            wrongQuestionActionMessage = error.localizedDescription
            return false
        }
    }

    func retryPendingImage() async {
        guard let data = pendingImageData else { return }
        await sendImage(data: data, caption: inputText)
    }

    /// 是否可发送（文本或图片至少一项非空，且未在发送中）
    var canSend: Bool {
        !isSending && (
            !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                || pendingImageData != nil
        )
    }

    // MARK: - 历史加载

    func loadHistory() async {
        conversationId = nil
        do {
            let response = try await apiClient.fetchChatHistory(subject: selectedSubject)
            if let convId = response.conversationId {
                conversationId = convId
                let chatMsgs = (response.messages ?? []).map { msg in
                    ChatMessage(
                        role: msg.role == "user" ? .user : .assistant,
                        content: msg.content,
                        imageURL: msg.imageUrl,
                        action: msg.action,
                        analyzeResult: msg.analyzeResult,
                        replyBlocks: msg.replyBlocks
                    )
                }
                messages = chatMsgs.isEmpty ? .loaded([]) : .loaded(chatMsgs)
                isOffline = false
                return
            }
            if let first = response.conversations?.first {
                conversationId = first.id
                let detail = try await apiClient.fetchChatHistory(conversationId: first.id)
                let chatMsgs = (detail.messages ?? []).map { msg in
                    ChatMessage(
                        role: msg.role == "user" ? .user : .assistant,
                        content: msg.content,
                        imageURL: msg.imageUrl,
                        action: msg.action,
                        analyzeResult: msg.analyzeResult,
                        replyBlocks: msg.replyBlocks
                    )
                }
                messages = chatMsgs.isEmpty ? .loaded([]) : .loaded(chatMsgs)
                isOffline = false
                return
            }
            messages = .loaded([])
        } catch {
            await loadLocalFallback()
        }
    }

    private func loadLocalFallback() async {
        let histories = await dataRepository.fetchChatHistories(limit: 1)
        guard let latest = histories.first else {
            messages = .loaded([])
            return
        }
        let cached = await dataRepository.fetchChatMessages(title: latest.title)
        let chatMsgs = cached.map { ChatMessage(
            role: $0.role == "user" ? .user : .assistant,
            content: $0.content,
            timestamp: $0.timestamp,
            action: $0.action,
            imagePreview: $0.imagePreviewBase64.flatMap { Data(base64Encoded: $0) },
            imageURL: $0.imageUrl,
            analyzeResult: $0.analyzeResult,
            replyBlocks: $0.replyBlocks
        )}
        currentTitle = latest.title
        messages = chatMsgs.isEmpty ? .loaded([]) : .loaded(chatMsgs)
        isOffline = true
    }

    // MARK: - 发送

    /// 发送：若有待发图片走图片分析流程，否则走文本 Chat。
    func sendMessage(_ textOverride: String? = nil) async {
        let text = (textOverride ?? inputText).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !isSending else { return }
        // 至少有文本或图片
        guard !text.isEmpty || pendingImageData != nil else { return }

        // 有图片 → 图片分析流程（复用 upload → analyze，不改 agent 协议）
        if let imageData = pendingImageData {
            await sendImage(data: imageData, caption: text)
            return
        }

        // 纯文本 → 原 Chat 流程
        inputText = ""
        isSending = true
        let context = followUpContext.map(Self.followUpContextText)

        let userMsg = ChatMessage(role: .user, content: text, timestamp: Date())
        appendMessage(userMsg)

        if currentTitle == nil { currentTitle = String(text.prefix(20)) }

        do {
            let request = ChatRequest(
                subject: selectedSubject,
                message: text,
                conversationId: conversationId,
                context: context
            )
            let response = try await apiClient.chat(request)
            if let convId = response.conversationId {
                conversationId = convId
            }
            let assistantMsg = ChatMessage(
                role: .assistant,
                content: response.reply,
                timestamp: Date(),
                action: response.action,
                replyBlocks: response.replyBlocks
            )
            appendMessage(assistantMsg)

            await persistCurrentChat()
            followUpContext = nil
            isOffline = false
        } catch {
            isOffline = (error as? NetworkError) == .networkUnavailable
        }
        isSending = false
    }

    /// Chat 内图片分析：上传 → analyze(imageUrl:) → 作为 assistant 消息插入。
    /// 不调用 `apiClient.chat`，因为后端 `runChatAgent` 不接收 imageUrl（见文档 §7 P1-3）。
    private func sendImage(data: Data, caption: String) async {
        isSending = true
        imageSendError = nil

        do {
            // 1. 上传到云端拿 imageUrl（presign → PUT）
            let upload = try await apiClient.uploadImage(
                data: data,
                mimeType: "image/jpeg",
                filename: "chat-photo.jpg"
            )

            // 2. 以 imageUrl 调用 analyze（复用既有 endpoint，不改 agent 协议）
            let request = AnalyzeRequest(imageUrl: upload.url, subject: selectedSubject)
            let result = try await apiClient.analyze(request)

            // 只有上传和分析都成功后才写入消息，失败时保留待发送图片供重试。
            let userMsg = ChatMessage(
                role: .user,
                content: caption.isEmpty ? "【图片分析】" : caption,
                timestamp: Date(),
                imagePreview: data,
                imageURL: upload.url
            )
            appendMessage(userMsg)
            if currentTitle == nil { currentTitle = String((caption.isEmpty ? "图片分析" : caption).prefix(20)) }

            let assistantMsg = ChatMessage(
                role: .assistant,
                content: "已分析完成，结果如下：",
                timestamp: Date(),
                analyzeResult: result
            )
            appendMessage(assistantMsg)

            let historyRequest = ChatHistoryAppendRequest(
                subject: selectedSubject,
                conversationId: conversationId,
                messages: [
                    ChatHistoryAppendMessage(
                        role: "user",
                        content: userMsg.content,
                        metadata: ChatHistoryMessageMetadata(imageUrl: upload.url)
                    ),
                    ChatHistoryAppendMessage(
                        role: "assistant",
                        content: assistantMsg.content,
                        metadata: ChatHistoryMessageMetadata(analyzeResult: result)
                    ),
                ]
            )
            await syncHistory(historyRequest)
            await persistCurrentChat()
            clearPendingImage()
            isOffline = false
        } catch {
            imageSendError = error
            isOffline = (error as? NetworkError) == .networkUnavailable
        }
        isSending = false
    }

    private func appendMessage(_ message: ChatMessage) {
        var current = messages.value ?? []
        current.append(message)
        messages = .loaded(current)
    }

    private func persistCurrentChat() async {
        guard let title = currentTitle else { return }
        let codable = (messages.value ?? []).map { CodableChatMessage(
            role: $0.role == .user ? "user" : "assistant",
            content: $0.content,
            timestamp: $0.timestamp,
            imagePreviewBase64: $0.imagePreview
                .flatMap { ImageUploadPreparer.cachePreviewData(for: $0) }
                .map { $0.base64EncodedString() },
            imageUrl: $0.imageURL,
            action: $0.action,
            analyzeResult: $0.analyzeResult,
            replyBlocks: $0.replyBlocks
        )}
        await dataRepository.saveChatHistory(title: title, subject: selectedSubject, messages: codable)
    }

    func retryHistorySync() async {
        guard let pendingHistorySync else { return }
        await syncHistory(pendingHistorySync)
    }

    private func syncHistory(_ request: ChatHistoryAppendRequest) async {
        pendingHistorySync = request
        do {
            let response = try await apiClient.appendChatHistory(request)
            conversationId = response.conversationId
            pendingHistorySync = nil
            historySyncError = nil
        } catch {
            historySyncError = "本次图片分析已保存在本机，但在线历史同步失败。"
        }
    }

    private static func followUpContextText(_ result: AnalyzeResponse) -> String {
        var lines = [
            "学科：\(result.subject)",
            "题型：\(result.questionType)",
            "难度：\(result.difficulty)/10",
        ]
        if !result.knowledgePoints.isEmpty {
            lines.append("知识点：\(result.knowledgePoints.joined(separator: "、"))")
        }
        if let answer = result.answer, !answer.isEmpty {
            lines.append("参考答案：\(answer)")
        }
        if !result.analysis.isEmpty {
            lines.append("解析：\(result.analysis)")
        }
        if let examPoints = result.examPoints, !examPoints.isEmpty {
            lines.append("考点说明：\(examPoints)")
        }
        return lines.joined(separator: "\n").prefix(6000).description
    }

}
