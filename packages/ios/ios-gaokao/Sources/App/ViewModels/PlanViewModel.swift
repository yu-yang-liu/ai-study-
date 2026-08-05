import SwiftUI
import CoreKit
import ApiContracts

@MainActor
final class PlanViewModel: ObservableObject {
    @Published var selectedSubject: String = "数学"
    @Published var focus = ""
    @Published var result: LoadingState<PlanResponse> = .idle
    @Published var isOffline = false
    @Published var showCachedBanner = false

    private let apiClient: APIClient
    private let dataRepository: DataRepository
    let subjects: [String] = Subject.allCases.map(\.rawValue)

    init(apiClient: APIClient, dataRepository: DataRepository) {
        self.apiClient = apiClient
        self.dataRepository = dataRepository
        Task { await loadCachedPlan() }
    }

    func loadCachedPlan() async {
        guard let cached = await dataRepository.fetchLatestPlan(subject: selectedSubject),
              let data = cached.planJSON.data(using: .utf8) else { return }
        if let plan = try? JSONDecoder().decode(PlanResponse.self, from: data) {
            result = .loaded(plan)
            showCachedBanner = true
        }
    }

    func generatePlan() async {
        result = .loading
        showCachedBanner = false
        let focusText = focus.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            let request = PlanRequest(subject: selectedSubject, focus: focusText.isEmpty ? nil : focusText)
            let response = try await apiClient.plan(request)
            result = .loaded(response)

            if let jsonData = try? JSONEncoder().encode(response),
               let jsonString = String(data: jsonData, encoding: .utf8) {
                await dataRepository.savePlanCache(subject: selectedSubject, focus: focusText.isEmpty ? nil : focusText, planJSON: jsonString)
            }
            isOffline = false
        } catch {
            result = .error(error)
            isOffline = (error as? NetworkError) == .networkUnavailable
            if isOffline { await loadCachedPlan() }
        }
    }
}