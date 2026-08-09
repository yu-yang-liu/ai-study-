import SwiftUI

/// 三点跳动打字指示器，用于 AI 回复等待态。
struct TypingIndicator: View {
    @State private var phase = 0.0

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { i in
                Circle()
                    .fill(Color.secondary)
                    .frame(width: 8, height: 8)
                    .offset(y: sin(phase + Double(i) * 0.6) * -3)
            }
        }
        .padding(10)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .onAppear {
            withAnimation(.linear(duration: 0.8).repeatForever(autoreverses: true)) {
                phase = .pi
            }
        }
    }
}
