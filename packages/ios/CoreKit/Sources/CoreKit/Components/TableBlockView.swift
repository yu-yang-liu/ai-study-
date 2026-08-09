import SwiftUI

/// 表格块渲染（Phase 1 Science AST · Text AST）。
///
/// 由 `ContentBlock.table(headers:rows:)` 驱动：表头加粗 + 底纹，行内单元格左对齐，
/// 横向超宽时滚动。纯 SwiftUI，不依赖 WebView。
public struct TableBlockView: View {
    public let headers: [String]?
    public let rows: [[String]]

    public init(headers: [String]?, rows: [[String]]) {
        self.headers = headers
        self.rows = rows
    }

    public var body: some View {
        let columns = max(headers?.count ?? 0, rows.map(\.count).max() ?? 0)
        if columns > 0 {
            ScrollView(.horizontal, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    if let headers, !headers.isEmpty {
                        GridRowView(cells: headers, isHeader: true, columns: columns)
                        Divider()
                    }
                    ForEach(rows.indices, id: \.self) { index in
                        GridRowView(cells: rows[index], isHeader: false, columns: columns)
                        if index < rows.count - 1 {
                            Divider()
                        }
                    }
                }
                .background(Color.secondary.opacity(0.06))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.gray.opacity(0.25), lineWidth: 1)
                )
            }
            .padding(.vertical, 6)
        }
    }
}

private struct GridRowView: View {
    let cells: [String]
    let isHeader: Bool
    let columns: Int

    var body: some View {
        Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 0) {
            GridRow {
                ForEach(0..<columns, id: \.self) { index in
                    Text(index < cells.count ? cells[index] : "")
                        .font(isHeader ? .subheadline.weight(.semibold) : .body)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(isHeader ? Color.gray.opacity(0.12) : Color.clear)
                }
            }
        }
    }
}

#Preview {
    ScrollView {
        TableBlockView(
            headers: ["公式", "值", "说明"],
            rows: [
                ["x^2", "4", "平方"],
                ["\\sqrt{2}", "1.41", "无理数"],
            ]
        )
        .padding()
    }
}
