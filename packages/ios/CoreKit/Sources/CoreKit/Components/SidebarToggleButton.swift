import SwiftUI

/// 侧边栏显示/隐藏切换按钮
/// 配合 NavigationSplitView(columnVisibility:) 使用；
/// iPad 隐藏后支持从屏幕左边缘滑出侧边栏（系统原生手势）。
public struct SidebarToggleButton: View {
    @Binding var columnVisibility: NavigationSplitViewVisibility
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    public init(columnVisibility: Binding<NavigationSplitViewVisibility>) {
        self._columnVisibility = columnVisibility
    }

    public var body: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.25)) {
                toggleSidebar()
            }
        } label: {
            Image(systemName: "sidebar.leading")
        }
        .accessibilityLabel(isSidebarHidden ? "显示侧边栏" : "隐藏侧边栏")
    }

    private var isSidebarHidden: Bool {
        columnVisibility == .detailOnly
    }

    private func toggleSidebar() {
        if isSidebarHidden {
            // iPad 宽屏：双栏；iPhone 窄屏：交给系统自动（overlay 弹出）
            columnVisibility = horizontalSizeClass == .regular ? .doubleColumn : .automatic
        } else {
            columnVisibility = .detailOnly
        }
    }
}
