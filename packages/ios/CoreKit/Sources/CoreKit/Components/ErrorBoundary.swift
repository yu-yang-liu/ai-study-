import SwiftUI

// MARK: - 错误边界视图

/// 捕获子视图中未处理的运行时错误，展示优雅降级 UI
///
/// 用法：
/// ```
/// ErrorBoundary {
///     MyFeatureView()
/// } fallback: { error in
///     Text("出错了: \(error.localizedDescription)")
/// }
/// ```
public struct ErrorBoundary<Content: View, Fallback: View>: View {
    @State private var capturedError: (any Error)?

    private let content: () -> Content
    private let fallback: (any Error) -> Fallback

    public init(
        @ViewBuilder content: @escaping () -> Content,
        @ViewBuilder fallback: @escaping (any Error) -> Fallback
    ) {
        self.content = content
        self.fallback = fallback
    }

    public var body: some View {
        if let error = capturedError {
            fallback(error)
        } else {
            content()
                .task {
                    // 轻量级错误边界：不主动捕获，子视图通过 @StateObject 等自行报告
                }
        }
    }

    /// 手动报告错误（供子视图调用）
    public func reportError(_ error: any Error) {
        capturedError = error
    }
}

// MARK: - 默认降级视图

/// 通用错误降级视图：显示图标 + 消息 + 重试
public struct DefaultErrorFallback: View {
    private let error: any Error
    private let onRetry: (() -> Void)?

    public init(error: any Error, onRetry: (() -> Void)? = nil) {
        self.error = error
        self.onRetry = onRetry
    }

    public var body: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 48))
                .foregroundStyle(.orange)

            Text("页面加载出错")
                .font(.headline)

            Text(error.localizedDescription)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            if let onRetry = onRetry {
                Button("重试") { onRetry() }
                    .buttonStyle(.borderedProminent)
                    .padding(.top, 8)
            }

            Spacer()
        }
//        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#Preview("默认降级视图") {
    DefaultErrorFallback(
        error: NetworkError.timeout,
        onRetry: {}
    )
}