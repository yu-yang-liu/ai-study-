import SwiftUI
import CoreKit
import ApiContracts

struct WrongQuestionsView: View {
    @StateObject var viewModel: WrongQuestionsViewModel
    @State private var isShowingAddSheet = false
    @State private var selectedQuestion: WrongQuestionItem?

    var body: some View {
        VStack(spacing: 0) {
            if let error = viewModel.actionError {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .padding(.horizontal)
                    .padding(.top, 8)
            }

            filterBar

            LoadingStateView(
                state: viewModel.questions,
                emptyMessage: "\u{6682}\u{65e0}\u{9519}\u{9898}\u{8bb0}\u{5f55}\u{3002}\u{5b8c}\u{6210}\u{6279}\u{6539}\u{540e}\u{ff0c}\u{9519}\u{9898}\u{4f1a}\u{81ea}\u{52a8}\u{6c47}\u{96c6}\u{5230}\u{8fd9}\u{91cc}\u{3002}",
                onRetry: { Task { await viewModel.load() } }
            ) { _ in
                ScrollView {
                    VStack(spacing: 16) {
                        if !viewModel.dueQuestions.isEmpty {
                            sectionHeader("\u{5f85}\u{590d}\u{4e60}", count: viewModel.dueQuestions.count)
                            ForEach(viewModel.dueQuestions) { item in
                                dueCard(item)
                                    .onTapGesture { selectedQuestion = item }
                            }
                        }

                        if !viewModel.upcomingQuestions.isEmpty {
                            sectionHeader("\u{8ba1}\u{5212}\u{4e2d}", count: viewModel.upcomingQuestions.count)
                            ForEach(viewModel.upcomingQuestions.prefix(5)) { item in
                                upcomingRow(item)
                                    .onTapGesture { selectedQuestion = item }
                            }
                        }
                    }
                    .padding()
                }
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("\u{9519}\u{9898}\u{590d}\u{4e60}")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    isShowingAddSheet = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("手动加入错题")
            }
        }
        .sheet(isPresented: $isShowingAddSheet) {
            ManualWrongQuestionView(
                subjects: Subject.allCases.map(\.rawValue),
                onSubmit: { request in
                    await viewModel.addManualQuestion(request)
                }
            )
        }
        .sheet(item: $selectedQuestion) { item in
            WrongQuestionDetailView(
                item: item,
                isFavoriteUpdating: viewModel.updatingFavoriteIDs.contains(item.id),
                onToggleFavorite: { Task { await viewModel.updateFavorite(item) } }
            )
        }
        .task { await viewModel.load() }
        .refreshable { await viewModel.load() }
    }

    private var filterBar: some View {
        VStack(spacing: 8) {
            TextField("搜索题目、知识点或错误类型", text: $viewModel.searchText)
                .textFieldStyle(.roundedBorder)
            HStack {
                Text("学科")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Picker("学科", selection: $viewModel.subjectFilter) {
                    ForEach(viewModel.subjectOptions, id: \.self) { option in
                        Text(option).tag(option)
                    }
                }
                .pickerStyle(.menu)
                Spacer()
            }
        }
        .padding(.horizontal)
        .padding(.top, 8)
    }

    private func sectionHeader(_ title: String, count: Int) -> some View {
        HStack {
            Text(title).font(.headline)
            Text("\(count) \u{9053}").font(.caption).foregroundStyle(.secondary)
            Spacer()
        }
        .padding(.top, 4)
    }

    private func dueCard(_ item: WrongQuestionItem) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(item.subject)
                    .font(.caption)
                    .fontWeight(.medium)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color(.systemGray6))
                    .clipShape(Capsule())

                if !item.knowledgePoint.isEmpty {
                    Text(item.knowledgePoint).font(.caption).foregroundStyle(.secondary)
                }

                Spacer()

                Button {
                    Task { await viewModel.updateFavorite(item) }
                } label: {
                    Image(systemName: item.isFavorite ? "star.fill" : "star")
                        .foregroundStyle(item.isFavorite ? .yellow : .secondary)
                }
                .buttonStyle(.borderless)
                .disabled(viewModel.updatingFavoriteIDs.contains(item.id))

                Text("\u{7b2c} \(item.sm2Interval) \u{6b21}\u{590d}\u{4e60}")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Text(item.questionContent)
                .font(.subheadline)
                .padding(.leading, 8)
                .overlay(alignment: .leading) {
                    Rectangle().fill(Color(.systemGray4)).frame(width: 3)
                }

            HStack(spacing: 12) {
                answerBox(title: "\u{4f60}\u{7684}\u{4f5c}\u{7b54}", text: item.studentAnswer, background: Color.red.opacity(0.08), foreground: .red)
                answerBox(title: "\u{6b63}\u{786e}\u{7b54}\u{6848}", text: item.correctAnswer, background: Color.green.opacity(0.08), foreground: .green)
            }

            reviewButtons(for: item.id)
        }
        .padding()
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func answerBox(title: String, text: String, background: Color, foreground: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.caption2).foregroundStyle(foreground.opacity(0.7))
            Text(text.isEmpty ? "\u{2014}" : text).font(.caption).foregroundStyle(foreground)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .background(background)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func reviewButtons(for id: String) -> some View {
        HStack(spacing: 8) {
            reviewButton(id: id, label: "\u{5b8c}\u{5168}\u{5fd8}\u{4e86}", quality: 0, prominent: false)
            reviewButton(id: id, label: "\u{6709}\u{70b9}\u{5370}\u{8c61}", quality: 2, prominent: false)
            reviewButton(id: id, label: "\u{57fa}\u{672c}\u{638c}\u{63e1}", quality: 3, prominent: false)
            reviewButton(id: id, label: "\u{5b8c}\u{5168}\u{638c}\u{63e1}", quality: 5, prominent: true)
        }
    }

    @ViewBuilder
    private func reviewButton(id: String, label: String, quality: Int, prominent: Bool) -> some View {
        let button = Button {
            Task { await viewModel.review(id: id, quality: quality) }
        } label: {
            Text(label)
                .font(.caption2)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
        }
        .controlSize(.small)

        if prominent {
            button.buttonStyle(.borderedProminent)
        } else {
            button.buttonStyle(.bordered)
        }
    }

    private func upcomingRow(_ item: WrongQuestionItem) -> some View {
        HStack {
            Text("\(item.subject) \u{00b7} \(item.knowledgePoint.isEmpty ? "\u{9519}\u{9898}" : item.knowledgePoint)")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
            Text(formatReviewDate(item.nextReviewAt))
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func formatReviewDate(_ iso: String) -> String {
        guard let date = Date.fromISO8601(iso) ?? ISO8601DateFormatter().date(from: iso) else {
            return "\u{5f85}\u{6392}\u{671f}"
        }
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.locale = Locale(identifier: "zh_CN")
        return formatter.string(from: date)
    }
}

private struct WrongQuestionDetailView: View {
    let item: WrongQuestionItem
    let isFavoriteUpdating: Bool
    let onToggleFavorite: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        Text(item.subject)
                            .font(.headline)
                            .foregroundStyle(Color.brandPrimary)
                        Spacer()
                        Button(action: onToggleFavorite) {
                            if isFavoriteUpdating {
                                ProgressView()
                            } else {
                                Image(systemName: item.isFavorite ? "star.fill" : "star")
                            }
                        }
                        .buttonStyle(.borderless)
                        .foregroundStyle(item.isFavorite ? .yellow : .secondary)
                    }

                    detailSection("题目", item.questionContent)
                    detailSection("我的作答", item.studentAnswer)
                    detailSection("参考答案", item.correctAnswer)
                    if !item.analysis.isEmpty {
                        detailSection("解析", item.analysis)
                    }
                    if !item.explanation.isEmpty {
                        detailSection("考点说明", item.explanation)
                    }
                    if !item.knowledgePoints.isEmpty {
                        detailSection("知识点", item.knowledgePoints.joined(separator: "、"))
                    }
                    if let errorType = item.errorType, !errorType.isEmpty {
                        detailSection("错误类型", errorType)
                    }
                }
                .padding()
            }
            .navigationTitle("错题详情")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") { dismiss() }
                }
            }
        }
    }

    private func detailSection(_ title: String, _ content: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(content.isEmpty ? "暂无内容" : content)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(10)
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }
}

private struct ManualWrongQuestionView: View {
    let subjects: [String]
    let onSubmit: (AddWrongQuestionRequest) async -> Bool
    @Environment(\.dismiss) private var dismiss
    @State private var subject: String
    @State private var questionContent = ""
    @State private var studentAnswer = ""
    @State private var correctAnswer = ""
    @State private var knowledgePoints = ""
    @State private var errorType = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(subjects: [String], onSubmit: @escaping (AddWrongQuestionRequest) async -> Bool) {
        self.subjects = subjects
        self.onSubmit = onSubmit
        _subject = State(initialValue: subjects.first ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("题目信息") {
                    Picker("学科", selection: $subject) {
                        ForEach(subjects, id: \.self) { Text($0).tag($0) }
                    }
                    TextEditor(text: $questionContent)
                        .frame(minHeight: 110)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(.systemGray4), lineWidth: 0.5))
                }
                Section("答案") {
                    TextField("我的作答（可选）", text: $studentAnswer, axis: .vertical)
                    TextField("正确答案（可选）", text: $correctAnswer, axis: .vertical)
                }
                Section("复习标签") {
                    TextField("知识点，用逗号分隔", text: $knowledgePoints)
                    TextField("错误类型（可选）", text: $errorType)
                }
                if let errorMessage {
                    Text(errorMessage).font(.caption).foregroundStyle(.red)
                }
            }
            .navigationTitle("加入错题")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await submit() }
                    } label: {
                        if isSaving { ProgressView() } else { Text("保存") }
                    }
                    .disabled(isSaving || questionContent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }

    private func submit() async {
        let content = questionContent.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return }
        isSaving = true
        errorMessage = nil
        let points = knowledgePoints
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        let success = await onSubmit(
            AddWrongQuestionRequest(
                subject: subject,
                questionContent: content,
                studentAnswer: studentAnswer.trimmingCharacters(in: .whitespacesAndNewlines),
                correctAnswer: correctAnswer.trimmingCharacters(in: .whitespacesAndNewlines),
                knowledgePoints: points,
                errorType: errorType.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : errorType
            )
        )
        isSaving = false
        if success {
            dismiss()
        } else {
            errorMessage = "保存失败，请检查网络后重试。"
        }
    }
}

#Preview {
    NavigationStack {
        WrongQuestionsView(viewModel: WrongQuestionsViewModel(apiClient: APIClient(
            baseURL: URL(string: "https://example.com")!,
            tokenProvider: { nil },
            onUnauthorized: { false }
        )))
    }
}
