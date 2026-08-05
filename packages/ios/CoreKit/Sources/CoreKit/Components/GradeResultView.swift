import SwiftUI
import ApiContracts

/// 批改结果展示组件，根据数学/作文类型展示不同样式
public struct GradeResultView: View {
    private let result: GradeResult

    public init(result: GradeResult) {
        self.result = result
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                switch result {
                case .math(let math):
                    mathResultView(math)
                case .essay(let essay):
                    essayResultView(essay)
                }
            }
            .padding()
        }
    }

    // MARK: - 数学批改

    private func mathResultView(_ result: GradeMathResponse) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            // 总分卡片
            scoreCard(score: result.score, maxScore: result.maxScore, isCorrect: result.isCorrect)

            // 步骤详情
            if !result.steps.isEmpty {
                Text("解题步骤")
                    .font(.headline)
                    .padding(.top, 8)

                ForEach(result.steps, id: \.stepNumber) { step in
                    StepCard(step: step)
                }
            }

            // 总结
            if !result.summary.isEmpty {
                Text("评语")
                    .font(.headline)
                    .padding(.top, 8)

                Text(result.summary)
                    .font(.body)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - 作文批改

    private func essayResultView(_ result: GradeEssayResponse) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            // 总分卡片
            scoreCard(score: result.score, maxScore: result.maxScore, isCorrect: nil)

            // 维度得分
            if !result.dimensions.isEmpty {
                Text("评分维度")
                    .font(.headline)

                ForEach(result.dimensions.sorted(by: { $0.key < $1.key }), id: \.key) { key, value in
                    DimensionBar(label: key, score: value, maxScore: result.maxScore / Double(result.dimensions.count))
                }
            }

            // 优点
            if !result.strengths.isEmpty {
                Text("优点")
                    .font(.headline)
                    .foregroundStyle(.green)
                    .padding(.top, 8)

                ForEach(result.strengths.indices, id: \.self) { i in
                    HStack(alignment: .top) {
                        Text("✓")
                            .foregroundStyle(.green)
                        Text(result.strengths[i])
                            .font(.body)
                    }
                }
            }

            // 不足
            if !result.weaknesses.isEmpty {
                Text("待改进")
                    .font(.headline)
                    .foregroundStyle(.orange)
                    .padding(.top, 8)

                ForEach(result.weaknesses.indices, id: \.self) { i in
                    HStack(alignment: .top) {
                        Text("!")
                            .foregroundStyle(.orange)
                        Text(result.weaknesses[i])
                            .font(.body)
                    }
                }
            }

            // 总结
            if !result.summary.isEmpty {
                Text("总评")
                    .font(.headline)
                    .padding(.top, 8)

                Text(result.summary)
                    .font(.body)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - 共享组件

    private func scoreCard(score: Double, maxScore: Double, isCorrect: Bool?) -> some View {
        HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 4) {
                Text("得分")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("\(score, specifier: "%.1f") / \(maxScore, specifier: "%.0f")")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .foregroundStyle(scoreColor(score: score, maxScore: maxScore, isCorrect: isCorrect))
            }

            Spacer()

            if let isCorrect = isCorrect {
                Image(systemName: isCorrect ? "checkmark.circle.fill" : "xmark.circle.fill")
                    .font(.system(size: 40))
                    .foregroundStyle(isCorrect ? .green : .red)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func scoreColor(score: Double, maxScore: Double, isCorrect: Bool?) -> Color {
        if let isCorrect = isCorrect { return isCorrect ? .green : .red }
        let ratio = score / maxScore
        if ratio >= 0.8 { return .green }
        if ratio >= 0.6 { return .orange }
        return .red
    }
}

// MARK: - 子组件

private struct StepCard: View {
    let step: GradeMathStep

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: step.isCorrect ? "checkmark.circle.fill" : "xmark.circle.fill")
                .foregroundStyle(step.isCorrect ? .green : .red)
                .padding(.top, 2)

            VStack(alignment: .leading, spacing: 4) {
                Text("第 \(step.stepNumber) 步")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(step.feedback)
                    .font(.body)
            }
        }
        .padding(12)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

private struct DimensionBar: View {
    let label: String
    let score: Double
    let maxScore: Double

    private var ratio: CGFloat {
        guard maxScore > 0 else { return 0 }
        return CGFloat(min(score / maxScore, 1.0))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(label)
                    .font(.subheadline)
                Spacer()
                Text(String(format: "%.1f", score))
                    .font(.subheadline)
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }

            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color(.systemGray5))
                        .frame(height: 8)

                    RoundedRectangle(cornerRadius: 4)
                        .fill(barColor)
                        .frame(width: geometry.size.width * ratio, height: 8)
                }
            }
            .frame(height: 8)
        }
    }

    private var barColor: Color {
        if ratio >= 0.8 { return .green }
        if ratio >= 0.6 { return .orange }
        return .red
    }
}

#Preview {
    GradeResultView(result: .math(GradeMathResponse(
        score: 85,
        maxScore: 100,
        isCorrect: true,
        steps: [
            GradeMathStep(stepNumber: 1, isCorrect: true, feedback: "正确理解题意，设未知数"),
            GradeMathStep(stepNumber: 2, isCorrect: true, feedback: "列方程正确"),
            GradeMathStep(stepNumber: 3, isCorrect: false, feedback: "计算错误，应为 x=5 而非 x=6"),
        ],
        summary: "解题思路清晰，但存在计算失误，需加强运算练习。"
    )))
}
