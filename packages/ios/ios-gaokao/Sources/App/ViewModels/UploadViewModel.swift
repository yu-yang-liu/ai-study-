import SwiftUI
import CoreKit
import ApiContracts
import UIKit

@MainActor
final class UploadViewModel: ObservableObject {
    @Published var selectedSubject: String = "\u6570\u5b66"
    @Published var imageData: Data?
    @Published var previewImage: UIImage?
    @Published var imageUrl: String?
    @Published var uploadState: LoadingState<UploadResponse> = .idle
    @Published var analyzeState: LoadingState<AnalyzeResponse> = .idle

    private let apiClient: APIClient
    let subjects: [String] = Subject.allCases.map(\.rawValue)

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func setImageData(_ data: Data?) {
        imageData = data
        previewImage = data.flatMap { UIImage(data: $0) }
        imageUrl = nil
        uploadState = .idle
        analyzeState = .idle
    }

    func upload() async {
        guard let data = imageData else { return }
        uploadState = .loading
        do {
            let mime = mimeType(for: data)
            let filename = "photo.\(fileExtension(for: mime))"
            let response = try await apiClient.uploadImage(data: data, mimeType: mime, filename: filename)
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
    }

    private func mimeType(for data: Data) -> String {
        if data.starts(with: [0xFF, 0xD8, 0xFF]) { return "image/jpeg" }
        if data.starts(with: [0x89, 0x50, 0x4E, 0x47]) { return "image/png" }
        if data.starts(with: [0x47, 0x49, 0x46]) { return "image/gif" }
        return "image/jpeg"
    }

    private func fileExtension(for mime: String) -> String {
        switch mime {
        case "image/png": return "png"
        case "image/gif": return "gif"
        case "image/webp": return "webp"
        default: return "jpg"
        }
    }
}
