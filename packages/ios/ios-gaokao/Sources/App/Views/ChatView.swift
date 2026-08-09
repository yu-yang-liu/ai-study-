import SwiftUI
import PhotosUI
import CoreKit
import ApiContracts
import UIKit

struct ChatView: View {
    @StateObject var viewModel: ChatViewModel
    @State private var pickerItem: PhotosPickerItem?

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
                                AnalysisResultView(result: result)
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
        VStack(spacing: 0) {
            // 待发送图片预览
            if let image = viewModel.pendingImagePreview {
                pendingImagePreviewBar(image: image)
            }
            HStack(spacing: 10) {
                PhotosPicker(selection: $pickerItem, matching: .images) {
                    Image(systemName: "photo.fill")
                        .font(.title3)
                        .foregroundStyle(viewModel.pendingImageData == nil ? Color.brandPrimary : .secondary)
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
