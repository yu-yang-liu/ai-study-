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
        .navigationTitle("\u{62cd}\u{7167}\u{5206}\u{6790}")
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: pickerItem) { _, newItem in
            Task { await loadPickerItem(newItem) }
        }
    }

    private var inputSection: some View {
        VStack(spacing: 12) {
            HStack {
                Text("\u{5b66}\u{79d1}")
                    .font(.subheadline)
                Picker("\u{5b66}\u{79d1}", selection: $viewModel.selectedSubject) {
                    ForEach(viewModel.subjects, id: \.self) { subject in
                        Text(subject).tag(subject)
                    }
                }
                .pickerStyle(.menu)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            PhotosPicker(selection: $pickerItem, matching: .images) {
                Label("\u{9009}\u{62e9}\u{9898}\u{76ee}\u{56fe}\u{7247}", systemImage: "photo.on.rectangle.angled")
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
                        Text(viewModel.imageUrl == nil ? "\u{4e0a}\u{4f20}\u{5230}\u{4e91}\u{7aef}" : "\u{5df2}\u{4e0a}\u{4f20}")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(viewModel.imageData == nil || viewModel.imageUrl != nil || viewModel.uploadState.isLoading)

                if viewModel.imageData != nil {
                    Button("\u{91cd}\u{65b0}\u{9009}\u{62e9}") {
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
                        Text("\u{5f00}\u{59cb} AI \u{5206}\u{6790}")
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
                EmptyPlaceholderView(message: "\u{4e0a}\u{4f20}\u{9898}\u{76ee}\u{56fe}\u{7247}\u{540e}\u{ff0c}AI \u{5c06}\u{81ea}\u{52a8}\u{8bc6}\u{522b}\u{5e76}\u{5206}\u{6790}")
            }

        case .loading:
            CenteredProgressView("\u{6b63}\u{5728}\u{5206}\u{6790}...")

        case .loaded(let response):
            ScrollView {
                AnalysisResultView(result: response)
                    .padding()
            }

        case .empty:
            EmptyPlaceholderView(message: "\u{6682}\u{65e0}\u{5206}\u{6790}\u{7ed3}\u{679c}")

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
