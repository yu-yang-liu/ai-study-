import SwiftUI
import ApiContracts
import CoreKit

/// 分析结果展示（AnalyzeView / UploadView 共用）
struct AnalysisResultView: View {
    let result: AnalyzeResponse

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 12) {
                InfoBadge(label: "\u{5b66}\u{79d1}", value: result.subject, color: .blue)
                InfoBadge(label: "\u{9898}\u{578b}", value: result.questionType, color: .purple)
                InfoBadge(label: "\u{96be}\u{5ea6}", value: "\(result.difficulty)/10", color: .orange)
            }

            if !result.knowledgePoints.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("\u{6d89}\u{53ca}\u{77e5}\u{8bc6}\u{70b9}")
                        .font(.headline)

                    FlowLayout(spacing: 6) {
                        ForEach(result.knowledgePoints, id: \.self) { point in
                            Text(point)
                                .font(.caption)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(Color.accentColor.opacity(0.1))
                                .clipShape(Capsule())
                        }
                    }
                }
            }

            if hasAnswer {
                VStack(alignment: .leading, spacing: 4) {
                    Text("\u{53c2}\u{8003}\u{7b54}\u{6848}")
                        .font(.headline)
                    MarkdownRenderer(blocks: result.answerBlocks ?? [.text(content: result.answer ?? "")])
                        .padding(12)
                        .background(Color(.systemGray6))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("\u{89e3}\u{6790}")
                    .font(.headline)
                MarkdownRenderer(blocks: result.analysisBlocks ?? [.text(content: result.analysis)])
            }

            if hasExamPoints {
                VStack(alignment: .leading, spacing: 4) {
                    Text("\u{8003}\u{70b9}\u{8bf4}\u{660e}")
                        .font(.headline)
                    MarkdownRenderer(blocks: result.examPointsBlocks ?? [.text(content: result.examPoints ?? "")])
                }
            }
        }
    }

    /// \u{53c2}\u{8003}\u{7b54}\u{6848}\u{662f}\u{5426}\u{53ef}\u{6e32}\u{67d3}\u{ff1a}blocks \u{975e}\u{7a7a} OR string \u{975e}\u{7a7a}\u{ff08}\u{6a21}\u{578b}\u{53ef}\u{80fd}\u{53ea}\u{8f93}\u{51fa} blocks\u{ff09}\u{3002}
    private var hasAnswer: Bool {
        if let blocks = result.answerBlocks, !blocks.isEmpty { return true }
        if let answer = result.answer, !answer.isEmpty { return true }
        return false
    }

    /// \u{8003}\u{70b9}\u{8bf4}\u{660e}\u{662f}\u{5426}\u{53ef}\u{6e32}\u{67d3}\u{3002}
    private var hasExamPoints: Bool {
        if let blocks = result.examPointsBlocks, !blocks.isEmpty { return true }
        if let examPoints = result.examPoints, !examPoints.isEmpty { return true }
        return false
    }
}

struct InfoBadge: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline)
                .fontWeight(.semibold)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(color.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct FlowLayout: Layout {
    var spacing: CGFloat = 4

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(proposal.width ?? 0, subviews: subviews)
        let height = rows.last.flatMap { $0.max(by: { $0.maxY < $1.maxY })?.maxY } ?? 0
        return CGSize(width: proposal.width ?? 0, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let rows = arrange(bounds.width, subviews: subviews)
        for row in rows {
            for item in row {
                item.subview.place(at: CGPoint(x: bounds.minX + item.x, y: bounds.minY + item.y), proposal: .unspecified)
            }
        }
    }

    private struct Item { let subview: LayoutSubview; let x: CGFloat; let y: CGFloat; var maxY: CGFloat { y + subview.sizeThatFits(.unspecified).height } }

    private func arrange(_ width: CGFloat, subviews: Subviews) -> [[Item]] {
        var rows: [[Item]] = [[]]
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > width, x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
                rows.append([])
            }
            rows[rows.count - 1].append(Item(subview: subview, x: x, y: y))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return rows
    }
}
