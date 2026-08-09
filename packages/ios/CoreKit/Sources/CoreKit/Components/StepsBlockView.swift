import SwiftUI
import ApiContracts

/// 解题步骤块（Phase 1 Science AST · Solution AST）。
///
/// 由 `ContentBlock.steps(title:steps:interaction:)` 驱动：
/// - 每步显示序号（或对错图标）、标题、方法标签与内容块（可递归包含公式/表格）；
/// - 内容块复用 `MarkdownRenderer(blocks:)`，保持 AST 与 UI 解耦；
/// - Interaction AST（折叠/可选择）在后续迭代驱动交互行为，Phase 1 默认全部展开。
public struct StepsBlockView: View {
    public let title: String?
    public let steps: [StepContent]
    public let interaction: InteractionHint?

    public init(title: String?, steps: [StepContent], interaction: InteractionHint?) {
        self.title = title
        self.steps = steps
        self.interaction = interaction
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let title, !title.isEmpty {
                Text(title)
                    .font(.headline)
            }
            ForEach(steps.indices, id: \.self) { index in
                StepContentView(index: index, step: steps[index])
            }
        }
        .padding(.vertical, 4)
    }
}

private struct StepContentView: View {
    let index: Int
    let step: StepContent

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            icon
            VStack(alignment: .leading, spacing: 4) {
                if let tag = step.tag, !tag.isEmpty {
                    Text(tag)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                if let title = step.title, !title.isEmpty {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.medium)
                }
                MarkdownRenderer(blocks: step.blocks)
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    @ViewBuilder
    private var icon: some View {
        if let isCorrect = step.isCorrect {
            Image(systemName: isCorrect ? "checkmark.circle.fill" : "xmark.circle.fill")
                .foregroundStyle(isCorrect ? Color.green : Color.red)
        } else {
            Text("\(index + 1)")
                .font(.caption.weight(.bold))
                .foregroundStyle(.white)
                .frame(width: 22, height: 22)
                .background(Color.accentColor)
                .clipShape(Circle())
        }
    }
}

#Preview {
    ScrollView {
        StepsBlockView(
            title: "配方法解方程",
            steps: [
                StepContent(
                    title: "移项",
                    blocks: [.text(content: "把常数项移到右边："), .formula(latex: "x^2-6x=-8")],
                    isCorrect: true,
                    tag: "配方"
                ),
                StepContent(
                    title: "配方",
                    blocks: [.formula(latex: "(x-3)^2=1")],
                    tag: "完全平方"
                ),
                StepContent(
                    blocks: [.formula(latex: "x=2 \\text{ 或 } x=4")],
                    isCorrect: false,
                    tag: "求解"
                ),
            ],
            interaction: InteractionHint(collapsible: false, selectable: false)
        )
        .padding()
    }
}
