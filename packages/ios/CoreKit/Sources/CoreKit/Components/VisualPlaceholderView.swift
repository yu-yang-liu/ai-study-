import SwiftUI

/// 视觉块占位（Phase 1 Science AST · Visual AST）。
///
/// Phase 1 仅占位：示意「此处为结构化图形」。Phase 2 由 `GeometryCanvasView`
/// （Swift `Canvas` / `Shape`）真实渲染，不依赖图片 URL / TikZ。
public struct VisualPlaceholderView: View {
    public let kind: String

    public init(kind: String) {
        self.kind = kind
    }

    public var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "square.dashed")
                .font(.title2)
                .foregroundStyle(.secondary)
            Text(kind == "geometry" ? "几何图形（Phase 2 渲染）" : "示意图占位")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, minHeight: 80)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .padding(.vertical, 6)
    }
}

#Preview {
    VStack {
        VisualPlaceholderView(kind: "placeholder")
        VisualPlaceholderView(kind: "geometry")
    }
    .padding()
}
