import SwiftUI
import CoreKit
import ApiContracts
import UIKit

@MainActor
final class UploadViewModel: ObservableObject {
    @Published var selectedSubject: String = "\u{6570}\u{5b66}"
    @Published var imageData: Data?
    @Published var previewImage: UIImage?
    @Published var imageUrl: String?
    @Published var uploadState: LoadingState<UploadResponse> = .idle
    @Published var analyzeState: LoadingState<AnalyzeResponse> = .idle
    @Published var imagePreparationError: Error?

    let apiClient: APIClient
    let subjects: [String] = Subject.allCases.map(\.rawValue)

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func setImageData(_ data: Data?) {
        guard let data else {
            reset()
            return
        }

        do {
            let prepared = try ImageUploadPreparer.prepare(data: data)
            imageData = prepared.data
            previewImage = prepared.preview
            imagePreparationError = nil
            imageUrl = nil
            uploadState = .idle
            analyzeState = .idle
        } catch {
            imageData = nil
            previewImage = nil
            imagePreparationError = error
            imageUrl = nil
            uploadState = .idle
            analyzeState = .idle
        }
    }

    func upload() async {
        guard let data = imageData else { return }
        uploadState = .loading
        do {
            let response = try await apiClient.uploadImage(
                data: data,
                mimeType: "image/jpeg",
                filename: "photo.jpg"
            )
            imageUrl = response.url
            uploadState = .loaded(response)
        } catch {
            uploadState = .error(error)
        }
    }

    func analyze() async {
        guard let url = imageUrl else { return }
        analyzeState = .loading
        do {
            let request = AnalyzeRequest(imageUrl: url, subject: selectedSubject)
            let response = try await apiClient.analyze(request)
            analyzeState = .loaded(response)
        } catch {
            analyzeState = .error(error)
        }
    }

    func reset() {
        imageData = nil
        previewImage = nil
        imageUrl = nil
        uploadState = .idle
        analyzeState = .idle
        imagePreparationError = nil
    }
}
