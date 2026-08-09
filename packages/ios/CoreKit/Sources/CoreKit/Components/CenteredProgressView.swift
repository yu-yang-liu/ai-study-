import SwiftUI

/// 居中加载指示器，用于 `LoadingState.loading` 统一展示。
///
/// 替代散落在各功能页的 `Spacer(); ProgressView(...); Spacer()` 写法，
/// 统一居中 + 撑满可用区域，避免 `Spacer()` 在缺省父容器尺寸下导致的布局异常。
public struct CenteredProgressView: View {
    private let label: String

    /// - Parameter label: 可选加载文案；为空则仅展示无标签的转圈。
    public init(_ label: String = "") {
        self.label = label
    }

    public var body: some View {
        VStack {
            Spacer()
            if label.isEmpty {
                ProgressView()
            } else {
                ProgressView(label)
            }
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
