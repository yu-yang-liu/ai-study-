import SwiftUI
import CoreKit

/// 真题演练占位页，展示题库数量
struct RealExamPlaceholderView: View {
    let apiClient: APIClient
    @State private var bankCount: Int?

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "book.pages.fill")
                .font(.system(size: 48))
                .foregroundStyle(Color.brandAccent)

            Text("\u{771f}\u{9898}\u{6f14}\u{7ec3}")
                .font(.title2)
                .fontWeight(.semibold)

            if let count = bankCount {
                Text("\u{9898}\u{5e93}\u{5df2}\u{6709} \(count) \u{9053}\u{9ad8}\u{4e2d}\u{9898}\u{76ee}")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                ProgressView()
            }

            Text("\u{8fd1}\u{5341}\u{5e74}\u{771f}\u{9898}\u{5e93}\u{529f}\u{80fd}\u{5373}\u{5c06}\u{4e0a}\u{7ebf}")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
        .navigationTitle("\u{771f}\u{9898}\u{6f14}\u{7ec3}")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            bankCount = try? await apiClient.fetchBankCount().count
        }
    }
}
