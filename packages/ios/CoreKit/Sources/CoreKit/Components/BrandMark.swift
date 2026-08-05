import SwiftUI

/// 纯代码矢量品牌标志（无需图片资源）
/// 高端极简风：纯色深墨底 + 白色字形
public struct BrandMark: View {
    private let size: CGFloat

    public init(size: CGFloat = 96) {
        self.size = size
    }

    /// 学段字形：高考=高，中考=中
    private var character: String {
        #if GAOKAO
        return "高"
        #else
        return "中"
        #endif
    }

    public var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                .fill(Color.brandPrimary)

            Text(character)
                .font(.system(size: size * 0.58, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
        }
        .frame(width: size, height: size)
    }
}

#Preview {
    BrandMark(size: 120)
        .padding()
}
