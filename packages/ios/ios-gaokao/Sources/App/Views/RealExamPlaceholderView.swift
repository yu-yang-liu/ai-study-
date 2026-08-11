import SwiftUI
import CoreKit
import ApiContracts

struct RealExamView: View {
    @StateObject var viewModel: RealExamViewModel
    var onOpenWrongQuestions: () -> Void = {}

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                filterSection
                Divider()
                questionList
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("真题演练")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: BankQuestionItem.self) { question in
                ExamQuestionView(
                    question: question,
                    apiClient: viewModel.apiClient,
                    onOpenWrongQuestions: onOpenWrongQuestions
                )
            }
            .task { await viewModel.load() }
            .refreshable { await viewModel.load() }
        }
    }

    private var filterSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                filterPicker("学科", selection: $viewModel.subjectFilter) {
                    ForEach(viewModel.subjectOptions, id: \.self) { option in
                        Text(option).tag(option)
                    }
                }

                filterPicker("年份", selection: $viewModel.yearFilter) {
                    ForEach(viewModel.yearOptions, id: \.self) { option in
                        Text(option == 0 ? "全部" : "\(option) 年").tag(option)
                    }
                }
            }

            HStack(spacing: 8) {
                filterPicker("题型", selection: $viewModel.questionTypeFilter) {
                    ForEach(viewModel.questionTypeOptions, id: \.self) { option in
                        Text(option).tag(option)
                    }
                }

                filterPicker("难度", selection: $viewModel.difficultyFilter) {
                    ForEach(viewModel.difficultyOptions, id: \.self) { option in
                        Text(option == 0 ? "全部" : "\(option) / 10").tag(option)
                    }
                }
            }

            HStack {
                Text(viewModel.total > 0 ? "共 \(viewModel.total) 道题" : "选择条件后开始练习")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Button {
                    viewModel.resetFilters()
                    Task { await viewModel.load() }
                } label: {
                    Label("重置", systemImage: "arrow.counterclockwise")
                        .font(.caption)
                }
                .buttonStyle(.borderless)
                Button {
                    Task { await viewModel.load() }
                } label: {
                    Label("筛选", systemImage: "line.3.horizontal.decrease.circle")
                        .font(.caption)
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding()
        .background(.regularMaterial)
    }

    private func filterPicker<Content: View>(
        _ title: String,
        selection: Binding<String>,
        @ViewBuilder content: () -> Content
    ) -> some View {
        HStack(spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Picker(title, selection: selection, content: content)
                .pickerStyle(.menu)
                .labelsHidden()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func filterPicker<Content: View>(
        _ title: String,
        selection: Binding<Int>,
        @ViewBuilder content: () -> Content
    ) -> some View {
        HStack(spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Picker(title, selection: selection, content: content)
                .pickerStyle(.menu)
                .labelsHidden()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var questionList: some View {
        LoadingStateView(
            state: viewModel.questions,
            emptyMessage: "当前筛选下暂无题目，请调整条件后重试。",
            onRetry: { Task { await viewModel.load() } }
        ) { questions in
            if questions.isEmpty {
                EmptyPlaceholderView(message: "当前筛选下暂无题目，请调整条件后重试。")
            } else {
                List(questions) { question in
                    NavigationLink(value: question) {
                        BankQuestionRow(question: question)
                    }
                }
                .listStyle(.plain)
            }
        }
    }
}

private struct BankQuestionRow: View {
    let question: BankQuestionItem

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text(question.subject)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(Color.brandPrimary)
                if let year = question.year {
                    Text("\(year)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if let type = question.questionType {
                    Text(type)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if let difficulty = question.difficulty {
                    Text("难度 \(difficulty)")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }

            Text(question.content)
                .font(.subheadline)
                .foregroundStyle(.primary)
                .lineLimit(4)

            HStack(spacing: 8) {
                if let topic = question.topic, !topic.isEmpty {
                    Label(topic, systemImage: "tag")
                }
                if let source = question.source, !source.isEmpty {
                    Label(source, systemImage: "bookmark")
                }
            }
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 6)
    }
}

private struct ExamQuestionView: View {
    let question: BankQuestionItem
    let apiClient: APIClient
    let onOpenWrongQuestions: () -> Void

    @State private var answer = ""
    @State private var selectedOptionIndexes: Set<Int> = []
    @State private var startedAt = Date()
    @State private var result: BankPracticeResponse?
    @State private var errorMessage: String?
    @State private var isSubmitting = false
    @State private var clientRequestId = UUID()
    @FocusState private var answerFieldFocused: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                questionHeader
                questionContent
                answerSection

                errorSection

                if let result {
                    resultSection(result)
                } else {
                    submitButton
                }
            }
            .padding()
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("开始答题")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if result == nil {
                startedAt = Date()
            }
        }
    }

    private var questionHeader: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(question.subject)
                    .font(.headline)
                    .foregroundStyle(Color.brandPrimary)
                if let type = question.questionType {
                    Text(type)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if let year = question.year {
                    Text("\(year)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            if let examPoint = question.examPoint, !examPoint.isEmpty {
                Label(examPoint, systemImage: "target")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var questionContent: some View {
        Text(question.content)
            .font(.body)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .background(.regularMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var answerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("我的作答")
                .font(.headline)

            if question.options.isEmpty {
                TextEditor(text: $answer)
                    .focused($answerFieldFocused)
                    .frame(minHeight: 120, maxHeight: 200)
                    .padding(4)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(Color(.systemGray4), lineWidth: 0.5)
                    )
            } else {
                VStack(spacing: 8) {
                    ForEach(Array(question.options.enumerated()), id: \.offset) { index, option in
                        Button {
                            selectOption(index: index, value: option)
                        } label: {
                            HStack {
                                Image(systemName: selectedOptionIndexes.contains(index)
                                      ? (supportsMultipleChoice ? "checkmark.square.fill" : "checkmark.circle.fill")
                                      : (supportsMultipleChoice ? "square" : "circle"))
                                Text("\(optionLabel(index)). \(option)")
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .padding(10)
                            .foregroundStyle(selectedOptionIndexes.contains(index) ? Color.brandPrimary : .primary)
                            .background(
                                selectedOptionIndexes.contains(index)
                                    ? Color.brandPrimary.opacity(0.1)
                                    : Color(.systemGray6)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var errorSection: some View {
        Group {
            if let errorMessage {
                Label {
                    Text(errorMessage)
                        .font(.caption)
                        .multilineTextAlignment(.leading)
                } icon: {
                    Image(systemName: "exclamationmark.triangle.fill")
                }
                .foregroundStyle(.red)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 2)
            }
        }
    }

    private var submitButton: some View {
        Button {
            Task { await submit() }
        } label: {
            if isSubmitting {
                ProgressView().tint(.white)
            } else if errorMessage == nil {
                Label("提交答案", systemImage: "paperplane.fill")
            } else {
                Label("重试提交", systemImage: "arrow.clockwise")
            }
        }
        .buttonStyle(.borderedProminent)
        .frame(maxWidth: .infinity)
        .disabled(answer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSubmitting)
    }

    private func resultSection(_ practiceResult: BankPracticeResponse) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: practiceResult.isCorrect ? "checkmark.circle.fill" : "xmark.circle.fill")
                    .foregroundStyle(practiceResult.isCorrect ? .green : .red)
                Text(practiceResult.isCorrect ? "回答正确" : "再想一想")
                    .font(.headline)
                Spacer()
                Text("\(Int(practiceResult.score)) / \(Int(practiceResult.maxScore))")
                    .font(.headline)
                    .monospacedDigit()
            }

            answerResult(title: "参考答案", content: practiceResult.correctAnswer)
            if !practiceResult.analysis.isEmpty {
                answerResult(title: "解析", content: practiceResult.analysis)
            }

            if !practiceResult.isCorrect {
                Label("本题已加入错题复习", systemImage: "bookmark.fill")
                    .font(.subheadline)
                    .foregroundStyle(.orange)

                Button {
                    onOpenWrongQuestions()
                } label: {
                    Label("前往错题复习", systemImage: "arrow.right")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }

            Button {
                answer = ""
                selectedOptionIndexes = []
                result = nil
                errorMessage = nil
                startedAt = Date()
                clientRequestId = UUID()
            } label: {
                Label("再做一次", systemImage: "arrow.clockwise")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
        }
        .padding()
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var supportsMultipleChoice: Bool {
        question.questionType?.contains("多选") == true
    }

    private func optionLabel(_ index: Int) -> String {
        String(UnicodeScalar(65 + index)!)
    }

    private func selectOption(index: Int, value: String) {
        if supportsMultipleChoice {
            if selectedOptionIndexes.contains(index) {
                selectedOptionIndexes.remove(index)
            } else {
                selectedOptionIndexes.insert(index)
            }
            answer = selectedOptionIndexes.sorted().map(optionLabel).joined(separator: ",")
        } else {
            selectedOptionIndexes = [index]
            answer = value
        }
    }

    private func answerResult(title: String, content: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(content.isEmpty ? "暂无内容" : content)
                .font(.subheadline)
        }
    }

    private func submit() async {
        errorMessage = nil
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            answerFieldFocused = false
            result = try await apiClient.submitBankPractice(
                BankPracticeRequest(
                    questionId: question.id,
                    userAnswer: answer,
                    durationSec: max(Int(Date().timeIntervalSince(startedAt)), 0),
                    clientRequestId: clientRequestId.uuidString
                )
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
