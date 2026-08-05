import SwiftUI

// MARK: - 数据加载状态

public enum LoadingState<T: Sendable>: Sendable {
    case idle
    case loading
    case loaded(T)
    case empty
    case error(Error)

    public var value: T? {
        if case .loaded(let value) = self { return value }
        return nil
    }

    public var isLoading: Bool {
        if case .loading = self { return true }
        return false
    }
}

// MARK: - 通用三态视图包装器

/// 包装任意内容视图，统一处理加载中 / 空数据 / 错误三种状态
/// 用法：
/// ```
/// LoadingStateView(state: viewModel.chats) { chats in
///     List(chats) { ... }
/// }
/// ```
public struct LoadingStateView<Value: Sendable, Content: View>: View {
    private let state: LoadingState<Value>
    private let content: (Value) -> Content
    private let emptyMessage: String
    private let onRetry: (() -> Void)?

    public init(
        state: LoadingState<Value>,
        emptyMessage: String = "暂无数据",
        onRetry: (() -> Void)? = nil,
        @ViewBuilder content: @escaping (Value) -> Content
    ) {
        self.state = state
        self.emptyMessage = emptyMessage
        self.onRetry = onRetry
        self.content = content
    }

    public var body: some View {
        Group {
            switch state {
            case .idle:
                Color.clear

            case .loading:
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

            case .loaded(let value):
                content(value)

            case .empty:
                EmptyPlaceholderView(
                    message: emptyMessage,
                    onRetry: onRetry
                )

            case .error(let error):
                ErrorPlaceholderView(
                    error: error,
                    onRetry: onRetry
                )
            }
        }
    }
}

// MARK: - 空数据占位

public struct EmptyPlaceholderView: View {
    private let message: String
    private let onRetry: (() -> Void)?

    public init(message: String, onRetry: (() -> Void)? = nil) {
        self.message = message
        self.onRetry = onRetry
    }

    public var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "tray")
                .font(.system(size: 40))
                .foregroundStyle(.secondary)

            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            if let onRetry = onRetry {
                Button("刷新", action: onRetry)
                    .buttonStyle(.bordered)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - 错误占位

public struct ErrorPlaceholderView: View {
    private let message: String
    private let onRetry: (() -> Void)?

    public init(error: Error, onRetry: (() -> Void)? = nil) {
        self.message = error.localizedDescription
        self.onRetry = onRetry
    }

    public var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 40))
                .foregroundStyle(.orange)

            Text("加载失败")
                .font(.headline)

            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            if let onRetry = onRetry {
                Button("重试", action: onRetry)
                    .buttonStyle(.borderedProminent)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
