import SwiftUI
import CoreKit
import ApiContracts

struct ChatView: View {
    @StateObject var viewModel: ChatViewModel

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.isOffline {
                HStack(spacing: 6) {
                    Image(systemName: "wifi.slash").font(.caption)
                    Text("\u7f51\u7edc\u8fde\u63a5\u4e0d\u53ef\u7528\uff0c\u6b63\u5728\u663e\u793a\u672c\u5730\u6570\u636e").font(.caption)
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
                .background(Color.orange)
            }
            subjectPicker
            messageList
            inputBar
        }
        .navigationTitle("AI \u5b66\u4e60\u52a9\u624b")
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: viewModel.selectedSubject) { _, _ in
            Task { await viewModel.loadHistory() }
        }
    }

    private var subjectPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(viewModel.subjects, id: \.self) { subject in
                    Button { viewModel.selectedSubject = subject } label: {
                        Text(subject).font(.subheadline).padding(.horizontal, 12).padding(.vertical, 6)
                            .background(viewModel.selectedSubject == subject ? Color.accentColor : Color(.systemGray6))
                            .foregroundStyle(viewModel.selectedSubject == subject ? .white : .primary)
                            .clipShape(Capsule())
                    }
                }
            }.padding(.horizontal).padding(.vertical, 8)
        }.background(.thinMaterial)
    }

    private var messageList: some View {
        LoadingStateView(state: viewModel.messages, emptyMessage: "\u5f00\u59cb\u548c AI \u5b66\u4e60\u52a9\u624b\u804a\u804a\u5427\uff01") { messages in
            ScrollViewReader { proxy in
                List {
                    if messages.isEmpty {
                        Section {
                            ForEach(viewModel.quickChips, id: \.self) { chip in
                                Button {
                                    Task { await viewModel.sendMessage(chip) }
                                } label: {
                                    Text(chip)
                                        .font(.caption)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 8)
                                        .background(Color(.systemGray6))
                                        .clipShape(Capsule())
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
                        }
                        .listRowSeparator(.hidden)
                        .id(message.id)
                    }
                }
                .listStyle(.plain)
                .onChange(of: messages.count) { _, _ in
                    if let lastId = messages.last?.id {
                        withAnimation { proxy.scrollTo(lastId, anchor: .bottom) }
                    }
                }
            }
        }
    }

    private var inputBar: some View {
        HStack(spacing: 10) {
            TextField("\u8f93\u5165\u4f60\u7684\u95ee\u9898...", text: $viewModel.inputText, axis: .vertical)
                .lineLimit(1...4).textFieldStyle(.roundedBorder)
            Button {
                Task { await viewModel.sendMessage() }
            } label: {
                if viewModel.isSending {
                    ProgressView().tint(.white).frame(width: 24, height: 24)
                } else {
                    Image(systemName: "arrow.up.circle.fill").font(.title2)
                }
            }
            .disabled(viewModel.inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || viewModel.isSending)
        }.padding(.horizontal).padding(.vertical, 8).background(.thinMaterial)
    }
}

struct MessageBubble: View {
    let message: ChatMessage
    var isUser: Bool { message.role == .user }
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            if isUser { Spacer(minLength: 60) }
            VStack(alignment: isUser ? .trailing : .leading, spacing: 4) {
                Text(isUser ? "\u4f60" : "AI\u8001\u5e08").font(.caption2).foregroundStyle(.secondary)
                if isUser {
                    Text(message.content).font(.body).padding(10)
                        .background(Color.accentColor.opacity(0.15))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                } else {
                    MarkdownRenderer(message.content).padding(10)
                        .background(Color(.systemGray6))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
            if !isUser { Spacer(minLength: 60) }
        }.padding(.horizontal, 4)
    }
}

struct ChatActionCard: View {
    let action: ChatActionPayload

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            switch action.type {
            case "plan":
                if let title = action.payload["title"]?.stringValue {
                    Text("\u5b66\u4e60\u8ba1\u5212\uff1a\(title)").font(.caption).fontWeight(.semibold)
                }
                if let tasks = action.payload["tasks"]?.arrayValue {
                    ForEach(Array(tasks.prefix(3).enumerated()), id: \.offset) { _, task in
                        if let obj = task.objectValue,
                           let t = obj["title"]?.stringValue,
                           let s = obj["subject"]?.stringValue {
                            Text("\u2022 \(t) (\(s))").font(.caption2)
                        }
                    }
                }
            case "grade":
                if let score = action.payload["score"]?.doubleValue,
                   let maxScore = action.payload["maxScore"]?.doubleValue {
                    Text("\u6279\u6539\u7ed3\u679c\uff1a\(Int(score))/\(Int(maxScore))").font(.caption).fontWeight(.semibold)
                }
                if let summary = action.payload["summary"]?.stringValue {
                    Text(summary).font(.caption2)
                }
            case "wrong_questions":
                if let total = action.payload["total"]?.doubleValue {
                    Text("\u9519\u9898\u6458\u8981\uff1a\u5171 \(Int(total)) \u9898").font(.caption).fontWeight(.semibold)
                }
            default:
                EmptyView()
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}
