import SwiftUI
import PhotosUI
import CoreKit
import ApiContracts
import UIKit

struct ChatView: View {
    @StateObject var viewModel: ChatViewModel
    @State private var pickerItem: PhotosPickerItem?
    @State private var isShowingCamera = false
    @State private var detailResult: AnalyzeResponse?

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.isOffline {
                HStack(spacing: 6) {
                    Image(systemName: "wifi.slash").font(.caption)
                    Text("网络连接不可用，正在显示本地数据").font(.caption)
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
                .background(Color.semanticWarning)
            }
            if let notice = viewModel.wrongQuestionActionMessage {
                HStack(spacing: 6) {
                    Image(systemName: notice == "已加入错题复习" ? "checkmark.circle.fill" : "info.circle.fill")
                    Text(notice).font(.caption)
                    Spacer()
                    Button {
                        viewModel.wrongQuestionActionMessage = nil
                    } label: {
                        Image(systemName: "xmark")
                    }
                    .buttonStyle(.borderless)
                }
                .foregroundStyle(notice == "已加入错题复习" ? .green : .secondary)
                .padding(.horizontal)
                .padding(.vertical, 6)
                .background(Color(.systemGray6))
            }
            subjectPicker
            messageList
            inputBar
        }
        .navigationTitle("AI 学习助手")
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: viewModel.selectedSubject) { _, _ in
            Task { await viewModel.loadHistory() }
        }
        .onChange(of: pickerItem) { _, newItem in
            Task { await loadPickerItem(newItem) }
        }
        .sheet(isPresented: $isShowingCamera) {
            CameraPicker { data in
                viewModel.setPendingImage(data)
            }
            .ignoresSafeArea()
        }
        .sheet(
            isPresented: Binding(
                get: { detailResult != nil },
                set: { if !$0 { detailResult = nil } }
            )
        ) {
            if let result = detailResult {
                NavigationStack {
                    ScrollView {
                        AnalysisResultView(
                            result: result,
                            apiClient: viewModel.apiClient,
                            onFollowUp: {
                                viewModel.prepareFollowUp(for: result)
                                detailResult = nil
                            },
                            onAddToWrongQuestions: {
                                Task { _ = await viewModel.addToWrongQuestions(result) }
                            }
                        )
                        .padding()
                    }
                    .background(Color(.systemGroupedBackground))
                    .navigationTitle("题目分析详情")
                    .navigationBarTitleDisplayMode(.inline)
                }
            }
        }
    }

    private var subjectPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(viewModel.subjects, id: \.self) { subject in
                    Button { viewModel.selectedSubject = subject } label: {
                        Text(subject).font(.subheadline).padding(.horizontal, 12).padding(.vertical, 6)
                            .background(viewModel.selectedSubject == subject ? Color.brandPrimary : Color(.systemGray6))
                            .foregroundStyle(viewModel.selectedSubject == subject ? .white : .primary)
                            .clipShape(Capsule())
                    }
                }
            }.padding(.horizontal).padding(.vertical, 8)
        }.background(.thinMaterial)
    }

    private var messageList: some View {
        LoadingStateView(state: viewModel.messages, emptyMessage: "开始和 AI 学习助手聊聊吧！") { messages in
            ScrollViewReader { proxy in
                List {
                    if messages.isEmpty {
                        Section {
                            ForEach(viewModel.quickChips, id: \.self) { chip in
                                Button {
                                    Task { await viewModel.sendMessage(chip) }
                                } label: {
                                    SuggestionCard(text: chip, icon: viewModel.icon(for: chip))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    ForEach(messages) { message in
                        VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 4) {
                            MessageBubble(message: message)
                            if let action = message.action, message.role == .assistant {
                                ChatActionCard(action: action)
                            }
                            // 助手消息附带的图片分析结果，复用既有 AnalysisResultView
                            if let result = message.analyzeResult, message.role == .assistant {
                                ChatAnalysisCard(
                                    result: result,
                                    onViewDetails: { detailResult = result },
                                    onFollowUp: { viewModel.prepareFollowUp(for: result) },
                                    onPracticeAgain: {
                                        Task { await viewModel.practiceSimilarQuestion(for: result) }
                                    },
                                    onAddToWrongQuestions: {
                                        Task { _ = await viewModel.addToWrongQuestions(result) }
                                    }
                                )
                                    .padding(8)
                                    .background(Color(.systemGray6))
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                            }
                        }
                        .listRowSeparator(.hidden)
                        .id(message.id)
                    }
                    if viewModel.isSending,
                       let last = messages.last,
                       last.role == .user {
                        HStack(alignment: .top, spacing: 8) {
                            aiAvatar
                            TypingIndicator()
                            Spacer(minLength: 60)
                        }
                        .listRowSeparator(.hidden)
                        .id("typing-indicator")
                    }
                }
                .listStyle(.plain)
                .onChange(of: messages.count) { _, _ in
                    if let lastId = messages.last?.id {
                        withAnimation { proxy.scrollTo(lastId, anchor: .bottom) }
                    }
                }
                .onChange(of: viewModel.isSending) { _, isSending in
                    if isSending {
                        withAnimation { proxy.scrollTo("typing-indicator", anchor: .bottom) }
                    }
                }
            }
        }
    }

    private var inputBar: some View {
        let pendingImageTint: Color = viewModel.pendingImageData == nil ? Color.brandPrimary : .secondary
        return VStack(spacing: 0) {
            if viewModel.followUpContext != nil {
                followUpContextBar
            }
            // 待发送图片预览
            if let image = viewModel.pendingImagePreview {
                pendingImagePreviewBar(image: image)
            }
            if let error = viewModel.imagePreparationError {
                imageErrorRow(message: error.localizedDescription, retry: nil)
            } else if let error = viewModel.imageSendError {
                imageErrorRow(message: error.localizedDescription, retry: {
                    Task { await viewModel.retryPendingImage() }
                })
            }
            if let historySyncError = viewModel.historySyncError {
                historySyncErrorRow(message: historySyncError)
            }
            HStack(spacing: 10) {
                Menu {
                    PhotosPicker(selection: $pickerItem, matching: .images) {
                        Label("\u{4ece}\u{76f8}\u{518c}\u{9009}\u{62e9}", systemImage: "photo.fill")
                    }
                    Button {
                        isShowingCamera = true
                    } label: {
                        Label("\u{62cd}\u{7167}", systemImage: "camera.fill")
                    }
                } label: {
                    Image(systemName: "paperclip")
                        .font(.title3)
                        .foregroundStyle(pendingImageTint)
                }
                .disabled(viewModel.isSending)

                TextField("输入你的问题...", text: $viewModel.inputText, axis: .vertical)
                    .lineLimit(1...4).textFieldStyle(.roundedBorder)

                Button {
                    Task { await viewModel.sendMessage() }
                } label: {
                    if viewModel.isSending {
                        ProgressView().tint(.white).frame(width: 24, height: 24)
                    } else {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                            .foregroundStyle(Color.brandPrimary)
                    }
                }
                .disabled(!viewModel.canSend)
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .background(.thinMaterial)
    }

    private var followUpContextBar: some View {
        HStack(spacing: 6) {
            Image(systemName: "text.bubble.fill")
            Text("将基于这道题继续回答")
                .lineLimit(1)
            Spacer()
            Button {
                viewModel.clearFollowUpContext()
            } label: {
                Image(systemName: "xmark")
            }
            .buttonStyle(.borderless)
            .accessibilityLabel("取消关联题目")
        }
        .font(.caption)
        .foregroundStyle(Color.brandPrimary)
        .padding(.horizontal)
        .padding(.vertical, 6)
        .background(Color.brandPrimary.opacity(0.08))
    }

    /// 待发送图片的预览条：缩略图 + 说明输入框（可选）+ 移除按钮
    private func pendingImagePreviewBar(image: UIImage) -> some View {
        HStack(spacing: 10) {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
                .frame(width: 48, height: 48)
                .clipShape(RoundedRectangle(cornerRadius: 8))

            TextField("为图片添加说明（可选）", text: $viewModel.inputText, axis: .vertical)
                .font(.caption)
                .lineLimit(1...2)

            Spacer()

            Button {
                viewModel.clearPendingImage()
                pickerItem = nil
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(.secondary)
                    .font(.title3)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 6)
        .background(Color(.systemGray6).opacity(0.5))
    }

    private func imageErrorRow(message: String, retry: (() -> Void)?) -> some View {
        HStack(spacing: 6) {
            Image(systemName: "exclamationmark.triangle.fill")
            Text(message)
                .lineLimit(2)
            Spacer()
            if let retry {
                Button("重试", action: retry)
                    .buttonStyle(.borderless)
            }
        }
        .font(.caption2)
        .foregroundStyle(.red)
        .padding(.horizontal)
        .padding(.vertical, 4)
    }

    private func historySyncErrorRow(message: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: "arrow.triangle.2.circlepath")
            Text(message)
                .lineLimit(2)
            Spacer()
            Button("重试") {
                Task { await viewModel.retryHistorySync() }
            }
            .buttonStyle(.borderless)
        }
        .font(.caption2)
        .foregroundStyle(.orange)
        .padding(.horizontal)
        .padding(.vertical, 4)
    }

    private func loadPickerItem(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        if let data = try? await item.loadTransferable(type: Data.self) {
            viewModel.setPendingImage(data)
        }
    }

    // MARK: - AI 头像（助手消息复用）

    private var aiAvatar: some View {
        ZStack {
            Circle()
                .fill(LinearGradient.brandGradient)
            Image(systemName: "sparkles")
                .font(.caption)
                .foregroundStyle(.white)
        }
        .frame(width: 28, height: 28)
    }
}

// MARK: - 建议卡片（空态快捷入口）

struct SuggestionCard: View {
    let text: String
    let icon: String

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color.brandPrimary.opacity(0.12))
                Image(systemName: icon)
                    .font(.subheadline)
                    .foregroundStyle(Color.brandPrimary)
            }
            .frame(width: 36, height: 36)

            Text(text)
                .font(.subheadline)
                .foregroundStyle(.primary)
                .multilineTextAlignment(.leading)

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .background(Color.brandPrimary.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

struct MessageBubble: View {
    let message: ChatMessage
    var isUser: Bool { message.role == .user }
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            if isUser { Spacer(minLength: 40) }
            if !isUser {
                ZStack {
                    Circle()
                        .fill(LinearGradient.brandGradient)
                    Image(systemName: "sparkles")
                        .font(.caption)
                        .foregroundStyle(.white)
                }
                .frame(width: 28, height: 28)
            }
            VStack(alignment: isUser ? .trailing : .leading, spacing: 4) {
                Text(isUser ? "你" : "AI老师").font(.caption2).foregroundStyle(.secondary)
                // 用户消息附带图片：先展示图片，再展示文字（若有）
                if let data = message.imagePreview, let uiImage = UIImage(data: data) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: 220, maxHeight: 220)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                } else if let imageURL = message.imageURL, let url = URL(string: imageURL) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .scaledToFit()
                                .frame(maxWidth: 220, maxHeight: 220)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                        case .failure:
                            Label("图片加载失败", systemImage: "photo.badge.exclamationmark")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        default:
                            ProgressView()
                                .frame(width: 48, height: 48)
                        }
                    }
                }
                if !message.content.isEmpty {
                    if isUser {
                        Text(message.content).font(.body).padding(10)
                            .background(Color.brandPrimary.opacity(0.12))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    } else {
                        MarkdownRenderer(blocks: message.replyBlocks ?? [.text(content: message.content)])
                            .padding(10)
                            .background(Color(.systemGray6))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }
            }
            if !isUser { Spacer(minLength: 60) }
        }.padding(.horizontal, 4)
    }
}

/// Compact result card used inside Chat. Full analysis stays behind a detail
/// sheet so the conversation remains easy to scan.
struct ChatAnalysisCard: View {
    let result: AnalyzeResponse
    let onViewDetails: () -> Void
    let onFollowUp: () -> Void
    let onPracticeAgain: () -> Void
    let onAddToWrongQuestions: () -> Void

    private var summary: String {
        let text = result.analysis.trimmingCharacters(in: .whitespacesAndNewlines)
        return text.isEmpty ? "已识别题型、知识点和参考思路。" : text
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "checkmark.seal.fill")
                    .foregroundStyle(Color.brandPrimary)
                Text("题目分析完成")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                Spacer()
                Text("\(result.difficulty)/10")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if result.questionContent?.isEmpty == false {
                Button(action: onAddToWrongQuestions) {
                    Label("加入错题", systemImage: "plus.circle")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }

            HStack(spacing: 6) {
                Text(result.subject)
                Text("·")
                Text(result.questionType)
                if let point = result.knowledgePoints.first, !point.isEmpty {
                    Text("·")
                    Text(point)
                        .lineLimit(1)
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)

            Text(summary)
                .font(.caption)
                .foregroundStyle(.primary)
                .lineLimit(3)

            HStack(spacing: 8) {
                Button(action: onViewDetails) {
                    Label("查看详情", systemImage: "doc.text.magnifyingglass")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)

                Button(action: onPracticeAgain) {
                    Label("再练一次", systemImage: "arrow.triangle.2.circlepath")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
            }

            Button(action: onFollowUp) {
                Label("继续追问这道题", systemImage: "text.bubble")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderless)
            .font(.caption)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct ChatActionCard: View {
    let action: ChatActionPayload

    /// 按 action 类型取左侧色条颜色（plan=靛 / grade=绿 / wrong_questions=琥珀）。
    private var accentColor: Color {
        switch action.type {
        case "plan": return Color.brandPrimary
        case "grade": return Color.semanticSuccess
        case "wrong_questions": return Color.semanticWarning
        default: return Color.brandPrimary
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            // 左侧色条：按 action 类型着色
            RoundedRectangle(cornerRadius: 2)
                .fill(accentColor)
                .frame(width: 3)

            VStack(alignment: .leading, spacing: 6) {
                switch action.type {
                case "plan":
                    if let title = action.payload["title"]?.stringValue {
                        Text("学习计划：\(title)").font(.caption).fontWeight(.semibold)
                    }
                    if let tasks = action.payload["tasks"]?.arrayValue {
                        ForEach(Array(tasks.prefix(3).enumerated()), id: \.offset) { _, task in
                            if let obj = task.objectValue,
                               let t = obj["title"]?.stringValue,
                               let s = obj["subject"]?.stringValue {
                                Text("• \(t) (\(s))").font(.caption2)
                            }
                        }
                    }
                case "grade":
                    if let score = action.payload["score"]?.doubleValue,
                       let maxScore = action.payload["maxScore"]?.doubleValue {
                        Text("批改结果：\(Int(score))/\(Int(maxScore))").font(.caption).fontWeight(.semibold)
                    }
                    if let summary = action.payload["summary"]?.stringValue {
                        Text(summary).font(.caption2)
                    }
                case "wrong_questions":
                    if let total = action.payload["total"]?.doubleValue {
                        Text("错题摘要：共 \(Int(total)) 题").font(.caption).fontWeight(.semibold)
                    }
                default:
                    EmptyView()
                }
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.brandPrimary.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}
