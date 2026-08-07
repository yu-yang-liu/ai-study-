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
    /// 用户消息附带的本地图片（仅展示，不序列化进历史）
    let imagePreview: Data?
    /// 助手消息附带的图片分析结果（复用 /api/analyze(imageUrl:)）
    let analyzeResult: AnalyzeResponse?
    enum Role: String, Sendable { case user, assistant }

    init(
        role: Role,
        content: String,
        timestamp: Date = Date(),
        action: ChatActionPayload? = nil,
        imagePreview: Data? = nil,
        analyzeResult: AnalyzeResponse? = nil
    ) {
        self.role = role
        self.content = content
        self.timestamp = timestamp
        self.action = action
        self.imagePreview = imagePreview
        self.analyzeResult = analyzeResult
    }
}

@MainActor
final class ChatViewModel: ObservableObject {
    @Published var messages: LoadingState<[ChatMessage]> = .loaded([])
    @Published var inputText = ""
    @Published var selectedSubject: String = "数学"
    @Published var isSending = false
    @Published var isOffline = false

    /// 待发送的图片（在输入栏选择后、发送前）
    @Published var pendingImageData: Data?
    @Published var pendingImagePreview: UIImage?

    private let apiClient: APIClient
    private let dataRepository: DataRepository
    private var conversationId: String?
    private var currentTitle: String?

    let subjects: [String] = Subject.allCases.map(\.rawValue)
    let quickChips: [String] = [
        "帮我制定今日学习计划",
        "我的薄弱点在哪里",
        "我有哪些待复习错题",
    ]

    init(apiClient: APIClient, dataRepository: DataRepository) {
        self.apiClient = apiClient
        self.dataRepository = dataRepository
        Task { await loadHistory() }
    }

    // MARK: - 待发图片管理

    /// 从 PhotosPicker 设置待发图片
    func setPendingImage(_ data: Data?) {
        pendingImageData = data
        pendingImagePreview = data.flatMap { UIImage(data: $0) }
    }

    func clearPendingImage() {
        pendingImageData = nil
        pendingImagePreview = nil
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
                        content: msg.content
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
                        content: msg.content
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
            timestamp: $0.timestamp
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

        let userMsg = ChatMessage(role: .user, content: text, timestamp: Date())
        appendMessage(userMsg)

        if currentTitle == nil { currentTitle = String(text.prefix(20)) }

        do {
            let request = ChatRequest(
                subject: selectedSubject,
                message: text,
                conversationId: conversationId
            )
            let response = try await apiClient.chat(request)
            if let convId = response.conversationId {
                conversationId = convId
            }
            let assistantMsg = ChatMessage(
                role: .assistant,
                content: response.reply,
                timestamp: Date(),
                action: response.action
            )
            appendMessage(assistantMsg)

            await persistCurrentChat()
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
        clearPendingImage()

        // 用户消息：展示选中的图片 + 可选说明文字
        let userMsg = ChatMessage(
            role: .user,
            content: caption.isEmpty ? "【图片分析】" : caption,
            timestamp: Date(),
            imagePreview: data
        )
        appendMessage(userMsg)
        if currentTitle == nil { currentTitle = String((caption.isEmpty ? "图片分析" : caption).prefix(20)) }

        do {
            // 1. 上传到云端拿 imageUrl（presign → PUT）
            let mime = mimeType(for: data)
            let filename = "chat-photo.\(fileExtension(for: mime))"
            let upload = try await apiClient.uploadImage(data: data, mimeType: mime, filename: filename)

            // 2. 以 imageUrl 调用 analyze（复用既有 endpoint，不改 agent 协议）
            let request = AnalyzeRequest(imageUrl: upload.url, subject: selectedSubject)
            let result = try await apiClient.analyze(request)

            let assistantMsg = ChatMessage(
                role: .assistant,
                content: "已分析完成，结果如下：",
                timestamp: Date(),
                analyzeResult: result
            )
            appendMessage(assistantMsg)
            isOffline = false
        } catch {
            let assistantMsg = ChatMessage(
                role: .assistant,
                content: "图片分析失败：\(error.localizedDescription)。可试试重新选择图片或跳到「拍照分析」页。",
                timestamp: Date()
            )
            appendMessage(assistantMsg)
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
            timestamp: $0.timestamp
        )}
        await dataRepository.saveChatHistory(title: title, subject: selectedSubject, messages: codable)
    }

    // MARK: - MIME 辅助（与 UploadViewModel 一致）

    private func mimeType(for data: Data) -> String {
        if data.starts(with: [0xFF, 0xD8, 0xFF]) { return "image/jpeg" }
        if data.starts(with: [0x89, 0x50, 0x4E, 0x47]) { return "image/png" }
        if data.starts(with: [0x47, 0x49, 0x46]) { return "image/gif" }
        return "image/jpeg"
    }

    private func fileExtension(for mime: String) -> String {
        switch mime {
        case "image/png": return "png"
        case "image/gif": return "gif"
        case "image/webp": return "webp"
        default: return "jpg"
        }
    }
}
