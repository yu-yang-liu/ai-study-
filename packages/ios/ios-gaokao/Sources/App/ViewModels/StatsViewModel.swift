import SwiftUI
import CoreKit
import ApiContracts

@MainActor
final class StatsViewModel: ObservableObject {
    @Published var stats: LoadingState<StatsResponse> = .idle

    private let apiClient: APIClient
    let subjects: [String] = Subject.allCases.map(\.rawValue)

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func load() async {
        stats = .loading
        do {
            let response = try await apiClient.fetchStats()
            stats = .loaded(response)
        } catch {
            stats = .error(error)
        }
    }

    func subjectAccuracy(_ item: SubjectBreakdownItem) -> Int {
        let total = item.correct + item.wrong
        guard total > 0 else { return 0 }
        return Int((Double(item.correct) / Double(total) * 100).rounded())
    }
}
