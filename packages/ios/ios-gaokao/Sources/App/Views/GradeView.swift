import SwiftUI
import CoreKit
import ApiContracts

struct GradeView: View {
    @StateObject var viewModel: GradeViewModel

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.isOffline {
                HStack(spacing: 6) {
                    Image(systemName: "wifi.slash").font(.caption)
                    Text("离线模式，可查看历史批改记录").font(.caption)
                }
                .foregroundStyle(.white).frame(maxWidth: .infinity)
                .padding(.vertical, 6).background(Color.semanticWarning)
            }
            TabView {
                inputSection.tabItem { Label("新批改", systemImage: "pencil.and.list.clipboard") }
                historySection.tabItem { Label("历史", systemImage: "clock") }
            }
            Divider()
            resultSection
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .navigationTitle("作业批改")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var inputSection: some View {
        ScrollView {
            VStack(spacing: 12) {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("学科").font(.caption).foregroundStyle(.secondary)
                        Picker("学科", selection: $viewModel.subject) {
                            ForEach(viewModel.subjects, id: \.self) { s in Text(s).tag(s) }
                        }.pickerStyle(.menu)
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text("题型").font(.caption).foregroundStyle(.secondary)
                        Picker("题型", selection: $viewModel.questionType) {
                            Text("数学/理科").tag(GradeQuestionType.math)
                            Text("作文/文科").tag(GradeQuestionType.essay)
                        }.pickerStyle(.menu)
                    }
                }.frame(maxWidth: .infinity, alignment: .leading)

                VStack(alignment: .leading, spacing: 4) {
                    Text("题目内容（至少10字）").font(.caption).foregroundStyle(.secondary)
                    TextEditor(text: $viewModel.questionContent)
                        .frame(minHeight: 100, maxHeight: 160)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(.systemGray4), lineWidth: 0.5))
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text("我的作答").font(.caption).foregroundStyle(.secondary)
                    TextEditor(text: $viewModel.studentAnswer)
                        .frame(minHeight: 100, maxHeight: 160)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(.systemGray4), lineWidth: 0.5))
                }
                Button {
                    Task { await viewModel.submitForGrading() }
                } label: {
                    if viewModel.result.isLoading {
                        ProgressView().tint(.white)
                    } else { Text("提交批改") }
                }.buttonStyle(.borderedProminent).frame(maxWidth: .infinity)
                .disabled(viewModel.questionContent.trimmingCharacters(in: .whitespacesAndNewlines).count < 10
                    || viewModel.studentAnswer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }.padding()
        }
    }

    private var historySection: some View {
        Group {
            if viewModel.historyRecords.isEmpty {
                EmptyPlaceholderView(message: "暂无批改历史")
            } else {
                List(viewModel.historyRecords) { record in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(record.subject).font(.headline)
                            Spacer()
                            Text("\(record.score, specifier: "%.1f") / \(record.maxScore, specifier: "%.0f")")
                                .font(.subheadline).monospacedDigit()
                                .foregroundStyle(record.score / record.maxScore >= 0.6 ? .green : .red)
                        }
                        Text(record.questionContent).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                        Text(record.createdAt, style: .date).font(.caption2).foregroundStyle(.tertiary)
                    }.padding(.vertical, 4)
                }.listStyle(.plain)
            }
        }
    }

    @ViewBuilder
    private var resultSection: some View {
        switch viewModel.result {
        case .idle: EmptyView()
        case .loading:
            CenteredProgressView("正在批改...")
        case .loaded(let gradeResult):
            GradeResultView(result: gradeResult)
        case .empty:
            EmptyPlaceholderView(message: "暂无批改结果")
        case .error(let error):
            ErrorPlaceholderView(error: error) { Task { await viewModel.submitForGrading() } }
        }
    }
}