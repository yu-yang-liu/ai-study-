import SwiftUI
import PhotosUI
import CoreKit
import ApiContracts

struct UploadView: View {
    @StateObject var viewModel: UploadViewModel
    @State private var pickerItem: PhotosPickerItem?

    var body: some View {
        VStack(spacing: 0) {
            inputSection
            Divider()
            resultSection
        }
        .navigationTitle("\u62cd\u7167\u5206\u6790")
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: pickerItem) { _, newItem in
            Task { await loadPickerItem(newItem) }
        }
    }

    private var inputSection: some View {
        VStack(spacing: 12) {
            HStack {
                Text("\u5b66\u79d1")
                    .font(.subheadline)
                Picker("\u5b66\u79d1", selection: $viewModel.selectedSubject) {
                    ForEach(viewModel.subjects, id: \.self) { subject in
                        Text(subject).tag(subject)
                    }
                }
                .pickerStyle(.menu)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            PhotosPicker(selection: $pickerItem, matching: .images) {
                Label("\u9009\u62e9\u9898\u76ee\u56fe\u7247", systemImage: "photo.on.rectangle.angled")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.bordered)

            if let image = viewModel.previewImage {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(maxHeight: 220)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }

            HStack(spacing: 12) {
                Button {
                    Task { await viewModel.upload() }
                } label: {
                    if viewModel.uploadState.isLoading {
                        ProgressView().tint(.white)
                    } else {
                        Text(viewModel.imageUrl == nil ? "\u4e0a\u4f20\u5230\u4e91\u7aef" : "\u5df2\u4e0a\u4f20")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(viewModel.imageData == nil || viewModel.imageUrl != nil || viewModel.uploadState.isLoading)

                if viewModel.imageData != nil {
                    Button("\u91cd\u65b0\u9009\u62e9") {
                        pickerItem = nil
                        viewModel.reset()
                    }
                    .buttonStyle(.bordered)
                }
            }

            if viewModel.imageUrl != nil {
                Button {
                    Task { await viewModel.analyze() }
                } label: {
                    if viewModel.analyzeState.isLoading {
                        ProgressView().tint(.white)
                    } else {
                        Text("\u5f00\u59cb AI \u5206\u6790")
                    }
                }
                .buttonStyle(.borderedProminent)
                .frame(maxWidth: .infinity)
                .disabled(viewModel.analyzeState.isLoading)
            }
        }
        .padding()
    }

    @ViewBuilder
    private var resultSection: some View {
        switch viewModel.analyzeState {
        case .idle:
            if case .error(let error) = viewModel.uploadState {
                ErrorPlaceholderView(error: error) {
                    Task { await viewModel.upload() }
                }
            } else {
                EmptyPlaceholderView(message: "\u4e0a\u4f20\u9898\u76ee\u56fe\u7247\u540e\uff0cAI \u5c06\u81ea\u52a8\u8bc6\u522b\u5e76\u5206\u6790")
            }

        case .loading:
            CenteredProgressView("\u6b63\u5728\u5206\u6790...")

        case .loaded(let response):
            ScrollView {
                AnalysisResultView(result: response)
                    .padding()
            }

        case .empty:
            EmptyPlaceholderView(message: "\u6682\u65e0\u5206\u6790\u7ed3\u679c")

        case .error(let error):
            ErrorPlaceholderView(error: error) {
                Task { await viewModel.analyze() }
            }
        }
    }

    private func loadPickerItem(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        if let data = try? await item.loadTransferable(type: Data.self) {
            viewModel.setImageData(data)
        }
    }
}

#Preview {
    NavigationStack {
        UploadView(viewModel: UploadViewModel(apiClient: APIClient(
            baseURL: URL(string: "https://example.com")!,
            tokenProvider: { nil },
            onUnauthorized: { false }
        )))
    }
}
