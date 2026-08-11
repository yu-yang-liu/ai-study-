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
    @Published var actionError: String?
    @Published private(set) var updatingTaskIDs: Set<String> = []

    private let apiClient: APIClient
    private let dataRepository: DataRepository
    let subjects: [String] = Subject.allCases.map(\.rawValue)

    init(apiClient: APIClient, dataRepository: DataRepository) {
        self.apiClient = apiClient
        self.dataRepository = dataRepository
        Task { await loadPlan() }
    }

    func loadPlan() async {
        let cachedLoaded = await loadCachedPlan()
        do {
            let response = try await apiClient.fetchActivePlan()
            guard let plan = response.plan else {
                if !cachedLoaded { result = .empty }
                return
            }
            result = .loaded(plan)
            showCachedBanner = false
            isOffline = false
            if let jsonData = try? JSONEncoder().encode(plan),
               let jsonString = String(data: jsonData, encoding: .utf8) {
                await dataRepository.savePlanCache(
                    subject: plan.tasks.first?.subject ?? selectedSubject,
                    focus: nil,
                    planJSON: jsonString
                )
            }
        } catch {
            isOffline = (error as? NetworkError) == .networkUnavailable
            if !cachedLoaded {
                result = .error(error)
            }
        }
    }

    @discardableResult
    private func loadCachedPlan() async -> Bool {
        guard let cached = await dataRepository.fetchLatestPlan(subject: selectedSubject),
              let data = cached.planJSON.data(using: .utf8) else { return false }
        if let plan = try? JSONDecoder().decode(PlanResponse.self, from: data) {
            result = .loaded(plan)
            showCachedBanner = true
            return true
        }
        return false
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
            if isOffline { _ = await loadCachedPlan() }
        }
    }

    func updateTask(_ task: PlanTask, status: String) async {
        guard let taskId = task.taskId else { return }
        actionError = nil
        updatingTaskIDs.insert(taskId)
        defer { updatingTaskIDs.remove(taskId) }

        do {
            let response = try await apiClient.updatePlanTask(taskId: taskId, status: status)
            guard case .loaded(let current) = result else { return }
            let tasks = current.tasks.map { $0.id == response.task.id ? response.task : $0 }
            result = .loaded(
                PlanResponse(
                    title: current.title,
                    description: current.description,
                    tasks: tasks,
                    createdAt: current.createdAt
                )
            )
        } catch {
            actionError = error.localizedDescription
        }
    }
}
