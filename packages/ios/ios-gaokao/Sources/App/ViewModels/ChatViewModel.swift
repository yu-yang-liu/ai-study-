import SwiftUI
import CoreKit
import ApiContracts

struct ChatMessage: Identifiable, Sendable {
    let id = UUID()
    let role: Role
    let content: String
    let timestamp: Date
    let action: ChatActionPayload?
    enum Role: String, Sendable { case user, assistant }

    init(role: Role, content: String, timestamp: Date = Date(), action: ChatActionPayload? = nil) {
        self.role = role
        self.content = content
        self.timestamp = timestamp
        self.action = action
    }
}

@MainActor
final class ChatViewModel: ObservableObject {
    @Published var messages: LoadingState<[ChatMessage]> = .loaded([])
    @Published var inputText = ""
    @Published var selectedSubject: String = "\u6570\u5b66"
    @Published var isSending = false
    @Published var isOffline = false

    private let apiClient: APIClient
    private let dataRepository: DataRepository
    private var conversationId: String?
    private var currentTitle: String?

    let subjects: [String] = Subject.allCases.map(\.rawValue)
    let quickChips: [String] = [
        "\u5e2e\u6211\u5236\u5b9a\u4eca\u65e5\u5b66\u4e60\u8ba1\u5212",
        "\u6211\u7684\u8584\u5f31\u70b9\u5728\u54ea\u91cc",
        "\u6211\u6709\u54ea\u4e9b\u5f85\u590d\u4e60\u9519\u9898",
    ]

    init(apiClient: APIClient, dataRepository: DataRepository) {
        self.apiClient = apiClient
        self.dataRepository = dataRepository
        Task { await loadHistory() }
    }

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

    func sendMessage(_ textOverride: String? = nil) async {
        let text = (textOverride ?? inputText).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isSending else { return }
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
}
