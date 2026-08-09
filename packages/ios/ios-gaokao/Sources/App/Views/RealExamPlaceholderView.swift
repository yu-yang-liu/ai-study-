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

            Text("\u771f\u9898\u6f14\u7ec3")
                .font(.title2)
                .fontWeight(.semibold)

            if let count = bankCount {
                Text("\u9898\u5e93\u5df2\u6709 \(count) \u9053\u9ad8\u4e2d\u9898\u76ee")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                ProgressView()
            }

            Text("\u8fd1\u5341\u5e74\u771f\u9898\u5e93\u529f\u80fd\u5373\u5c06\u4e0a\u7ebf")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
        .navigationTitle("\u771f\u9898\u6f14\u7ec3")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            bankCount = try? await apiClient.fetchBankCount().count
        }
    }
}
