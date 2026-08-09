import SwiftUI
import ApiContracts
import CoreKit

/// 分析结果展示（AnalyzeView / UploadView 共用）
struct AnalysisResultView: View {
    let result: AnalyzeResponse

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 12) {
                InfoBadge(label: "\u5b66\u79d1", value: result.subject, color: .blue)
                InfoBadge(label: "\u9898\u578b", value: result.questionType, color: .purple)
                InfoBadge(label: "\u96be\u5ea6", value: "\(result.difficulty)/10", color: .orange)
            }

            if !result.knowledgePoints.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("\u6d89\u53ca\u77e5\u8bc6\u70b9")
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
                    Text("\u53c2\u8003\u7b54\u6848")
                        .font(.headline)
                    MarkdownRenderer(blocks: result.answerBlocks ?? [.text(content: result.answer ?? "")])
                        .padding(12)
                        .background(Color(.systemGray6))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("\u89e3\u6790")
                    .font(.headline)
                MarkdownRenderer(blocks: result.analysisBlocks ?? [.text(content: result.analysis)])
            }

            if hasExamPoints {
                VStack(alignment: .leading, spacing: 4) {
                    Text("\u8003\u70b9\u8bf4\u660e")
                        .font(.headline)
                    MarkdownRenderer(blocks: result.examPointsBlocks ?? [.text(content: result.examPoints ?? "")])
                }
            }
        }
    }

    /// \u53c2\u8003\u7b54\u6848\u662f\u5426\u53ef\u6e32\u67d3\uff1ablocks \u975e\u7a7a OR string \u975e\u7a7a\uff08\u6a21\u578b\u53ef\u80fd\u53ea\u8f93\u51fa blocks\uff09\u3002
    private var hasAnswer: Bool {
        if let blocks = result.answerBlocks, !blocks.isEmpty { return true }
        if let answer = result.answer, !answer.isEmpty { return true }
        return false
    }

    /// \u8003\u70b9\u8bf4\u660e\u662f\u5426\u53ef\u6e32\u67d3\u3002
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
