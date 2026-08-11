import Foundation
import ApiContracts

/// 统一 API 客户端
/// - 30s 超时
/// - 自动附加 JWT Bearer Token
/// - 401 时触发 Token 刷新并重试一次
/// - 统一错误解析
public actor APIClient: Sendable {
    private let baseURL: URL
    private let session: URLSession
    private let tokenProvider: () async -> String?
    private let onUnauthorized: @Sendable () async -> Bool

    private let timeout: TimeInterval = 30

    public init(
        baseURL: URL,
        tokenProvider: @escaping @Sendable () async -> String?,
        onUnauthorized: @escaping @Sendable () async -> Bool,
        urlSession: URLSession? = nil
    ) {
        self.baseURL = baseURL
        self.tokenProvider = tokenProvider
        self.onUnauthorized = onUnauthorized

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = timeout
        config.timeoutIntervalForResource = timeout
        config.waitsForConnectivity = false
        self.session = urlSession ?? URLSession(configuration: config)
    }

    // MARK: - Auth

    public func login(_ request: LoginRequest) async throws -> LoginResponse {
        return try await send(.login, body: request)
    }

    public func register(_ request: RegisterRequest) async throws -> RegisterResponse {
        return try await send(.register, body: request)
    }

    public func logout() async throws {
        let _: LogoutResponse = try await send(.logout, body: Optional<String>.none)
    }

    public func refreshToken(_ request: RefreshRequest) async throws -> RefreshResponse {
        return try await send(.refreshToken, body: request, requireAuth: false)
    }

    // MARK: - Features

    public func chat(_ request: ChatRequest) async throws -> ChatResponse {
        return try await send(.chat, body: request)
    }

    public func fetchChatHistory(conversationId: String? = nil, subject: String? = nil) async throws -> ChatHistoryResponse {
        var components = URLComponents(url: baseURL.appendingPathComponent(APIEndpoint.chatHistory.path), resolvingAgainstBaseURL: false)
        if let conversationId {
            components?.queryItems = [URLQueryItem(name: "conversationId", value: conversationId)]
        } else if let subject {
            components?.queryItems = [URLQueryItem(name: "subject", value: subject)]
        }
        guard let url = components?.url else {
            throw NetworkError.invalidURL(APIEndpoint.chatHistory.path)
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "GET"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Accept")
        urlRequest.timeoutInterval = timeout
        if let token = await tokenProvider() {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let data = try await perform(urlRequest, allowRetry: true) { [self] in
            var retry = URLRequest(url: url)
            retry.httpMethod = "GET"
            retry.setValue("application/json", forHTTPHeaderField: "Accept")
            retry.timeoutInterval = timeout
            if let token = await tokenProvider() {
                retry.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            let (retryData, retryResponse) = try await session.data(for: retry)
            guard let http = retryResponse as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                throw NetworkError.requestFailed(statusCode: (retryResponse as? HTTPURLResponse)?.statusCode ?? -1, message: "Retry failed")
            }
            return retryData
        }
        return try decode(ChatHistoryResponse.self, from: data)
    }

    public func appendChatHistory(_ request: ChatHistoryAppendRequest) async throws -> ChatHistoryAppendResponse {
        return try await send(.appendChatHistory, body: request)
    }

    public func analyze(_ request: AnalyzeRequest) async throws -> AnalyzeResponse {
        return try await send(.analyze, body: request)
    }

    /// 提交批改请求。返回原始 Data，由调用方根据 questionType 解码。
    public func grade(_ request: GradeRequest) async throws -> Data {
        return try await sendRaw(.grade, body: request)
    }

    public func plan(_ request: PlanRequest) async throws -> PlanResponse {
        return try await send(.plan, body: request)
    }

    public func fetchActivePlan() async throws -> ActivePlanResponse {
        return try await sendGet(.planHistory)
    }

    public func updatePlanTask(taskId: String, status: String) async throws -> PlanTaskUpdateResponse {
        return try await send(.updatePlanTask(taskId), body: PlanTaskUpdateRequest(status: status))
    }

    public func fetchProfile() async throws -> ProfileResponse {
        return try await sendGet(.profile)
    }

    public func updateProfile(_ request: ProfileUpdateRequest) async throws -> ProfileResponse {
        return try await send(.updateProfile, body: request)
    }

    public func fetchGradeHistory() async throws -> GradeHistoryResponse {
        return try await sendGet(.gradeHistory)
    }

    public func fetchLearnerProfile() async throws -> LearnerModel {
        return try await sendGet(.learnerProfile)
    }

    public func uploadImage(data: Data, mimeType: String, filename: String) async throws -> UploadResponse {
        let presign: PresignUploadResponse = try await send(
            .uploadPresign,
            body: PresignUploadRequest(contentType: mimeType)
        )

        guard let uploadURL = URL(string: presign.uploadUrl) else {
            throw NetworkError.invalidURL(presign.uploadUrl)
        }

        var request = URLRequest(url: uploadURL)
        request.httpMethod = "PUT"
        request.setValue(mimeType, forHTTPHeaderField: "Content-Type")
        request.httpBody = data
        request.timeoutInterval = timeout

        let (_, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let code = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw NetworkError.requestFailed(statusCode: code, message: "S3 upload failed")
        }

        return UploadResponse(url: presign.url, key: presign.key)
    }

    public func fetchWrongQuestions() async throws -> WrongQuestionsResponse {
        return try await sendGet(.wrongQuestions)
    }

    public func reviewWrongQuestion(_ request: ReviewWrongQuestionRequest) async throws -> ReviewWrongQuestionResponse {
        return try await send(.reviewWrongQuestion, body: request)
    }

    public func addWrongQuestion(_ request: AddWrongQuestionRequest) async throws -> AddWrongQuestionResponse {
        return try await send(.addWrongQuestion, body: request)
    }

    public func updateAnalysisBookmark(questionId: String, isFavorite: Bool) async throws -> AnalysisBookmarkResponse {
        return try await send(
            .updateAnalysisBookmark(questionId),
            body: AnalysisBookmarkRequest(isFavorite: isFavorite)
        )
    }

    public func fetchStats() async throws -> StatsResponse {
        return try await sendGet(.stats)
    }

    public func fetchBankCount() async throws -> BankCountResponse {
        return try await sendGet(.bankCount, requireAuth: false)
    }

    public func fetchBankQuestions(
        subject: String? = nil,
        year: Int? = nil,
        questionType: String? = nil,
        difficulty: Int? = nil,
        limit: Int = 20,
        offset: Int = 0
    ) async throws -> BankQuestionListResponse {
        var components = URLComponents(
            url: baseURL.appendingPathComponent(APIEndpoint.bank.path),
            resolvingAgainstBaseURL: false
        )
        var queryItems: [URLQueryItem] = []
        if let subject { queryItems.append(URLQueryItem(name: "subject", value: subject)) }
        if let year { queryItems.append(URLQueryItem(name: "year", value: String(year))) }
        if let questionType { queryItems.append(URLQueryItem(name: "questionType", value: questionType)) }
        if let difficulty { queryItems.append(URLQueryItem(name: "difficulty", value: String(difficulty))) }
        queryItems.append(URLQueryItem(name: "limit", value: String(limit)))
        queryItems.append(URLQueryItem(name: "offset", value: String(offset)))
        components?.queryItems = queryItems

        guard let url = components?.url else {
            throw NetworkError.invalidURL(APIEndpoint.bank.path)
        }

        var request = authenticatedGetRequest(url: url)
        if let token = await tokenProvider() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let data = try await perform(request, allowRetry: true) { [self] in
            try await sendBankQuestionsRetry(url: url)
        }
        return try decode(BankQuestionListResponse.self, from: data)
    }

    public func submitBankPractice(_ request: BankPracticeRequest) async throws -> BankPracticeResponse {
        return try await send(.submitBankPractice, body: request)
    }

    // MARK: - Core send

    private func authenticatedGetRequest(url: URL) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = timeout
        return request
    }

    private func sendBankQuestionsRetry(url: URL) async throws -> Data {
        var retry = URLRequest(url: url)
        retry.httpMethod = "GET"
        retry.setValue("application/json", forHTTPHeaderField: "Accept")
        retry.timeoutInterval = timeout
        if let token = await tokenProvider() {
            retry.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (retryData, retryResponse) = try await session.data(for: retry)
        guard let http = retryResponse as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw NetworkError.requestFailed(
                statusCode: (retryResponse as? HTTPURLResponse)?.statusCode ?? -1,
                message: "Retry failed"
            )
        }
        return retryData
    }

    private func sendGet<T: Decodable>(
        _ endpoint: APIEndpoint,
        requireAuth: Bool = true,
        allowRetry: Bool = true
    ) async throws -> T {
        let data = try await sendRawGet(endpoint, requireAuth: requireAuth, allowRetry: allowRetry)
        return try decode(T.self, from: data)
    }

    private func send<T: Decodable, B: Encodable>(
        _ endpoint: APIEndpoint,
        body: B?,
        requireAuth: Bool = true
    ) async throws -> T {
        let data = try await sendRaw(endpoint, body: body, requireAuth: requireAuth, allowRetry: true)
        return try decode(T.self, from: data)
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            if let apiError = try? JSONDecoder().decode(APIErrorResponse.self, from: data) {
                throw NetworkError.requestFailed(statusCode: 400, message: apiError.error)
            }
            throw NetworkError.decodingFailed("\(T.self): \(error.localizedDescription)")
        }
    }

    private func sendRawGet(
        _ endpoint: APIEndpoint,
        requireAuth: Bool = true,
        allowRetry: Bool = true
    ) async throws -> Data {
        let url = baseURL.appendingPathComponent(endpoint.path)
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "GET"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Accept")
        urlRequest.timeoutInterval = timeout

        if requireAuth, let token = await tokenProvider() {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return try await perform(urlRequest, allowRetry: allowRetry) { [self] in
            try await sendRawGet(endpoint, requireAuth: requireAuth, allowRetry: false)
        }
    }

    private func sendRaw<B: Encodable>(
        _ endpoint: APIEndpoint,
        body: B?,
        requireAuth: Bool = true,
        allowRetry: Bool = true
    ) async throws -> Data {
        let url = baseURL.appendingPathComponent(endpoint.path)
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = endpoint.method
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.setValue("application/json", forHTTPHeaderField: "Accept")
        urlRequest.timeoutInterval = timeout

        if requireAuth, let token = await tokenProvider() {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = body, !(body is Optional<Never>) {
            urlRequest.httpBody = try JSONEncoder().encode(body)
        }

        return try await perform(urlRequest, allowRetry: allowRetry) { [self] in
            try await sendRaw(endpoint, body: body, requireAuth: requireAuth, allowRetry: false)
        }
    }

    private func perform(
        _ urlRequest: URLRequest,
        allowRetry: Bool,
        retry: () async throws -> Data
    ) async throws -> Data {
        let (data, response): (Data, URLResponse)
        do {
            #if DEBUG
            print("[APIClient] → \(urlRequest.httpMethod ?? "?") \(urlRequest.url?.absoluteString ?? "")")
            #endif
            (data, response) = try await session.data(for: urlRequest)
        } catch let error as URLError {
            switch error.code {
            case .timedOut:
                throw NetworkError.timeout
            case .notConnectedToInternet, .networkConnectionLost:
                throw NetworkError.networkUnavailable
            default:
                throw NetworkError.unknown(error)
            }
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.invalidURL(urlRequest.url?.absoluteString ?? "")
        }

        #if DEBUG
        print("[APIClient] ← \(httpResponse.statusCode)")
        #endif

        switch httpResponse.statusCode {
        case 200...299:
            return data

        case 401:
            if allowRetry, await onUnauthorized() {
                return try await retry()
            }
            throw NetworkError.unauthorized

        case 429:
            let retryAfter = httpResponse.value(forHTTPHeaderField: "Retry-After")
                .flatMap(TimeInterval.init)
            throw NetworkError.rateLimited(retryAfter: retryAfter)

        default:
            let message = (try? JSONDecoder().decode(APIErrorResponse.self, from: data))?.error
                ?? HTTPURLResponse.localizedString(forStatusCode: httpResponse.statusCode)
            throw NetworkError.requestFailed(statusCode: httpResponse.statusCode, message: message)
        }
    }
}
