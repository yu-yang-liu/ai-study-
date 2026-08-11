import Foundation
import SwiftData
import XCTest
import CoreKit
import ApiContracts
@testable import ios_gaokao

@MainActor
final class PlanViewModelTests: XCTestCase {
    func testLoadsRemotePlanAndCachesIt() async throws {
        PlanURLProtocol.handler = { request in
            XCTAssertEqual(request.httpMethod, "GET")
            XCTAssertEqual(request.url?.path, "/api/plan")
            let data = #"{"plan":{"title":"远程计划","description":"来自服务端","tasks":[],"createdAt":"2026-08-11T08:00:00.000Z"}}"#.data(using: .utf8)!
            return (
                HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!,
                data
            )
        }
        defer { PlanURLProtocol.handler = nil }

        let schema = Schema([ChatHistoryRecord.self, GradeRecord.self, PlanCache.self, UserSettings.self])
        let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
        let container = try ModelContainer(for: schema, configurations: [configuration])
        let repository = DataRepository(modelContainer: container, phase: "test", userID: "user-a")

        let urlConfiguration = URLSessionConfiguration.ephemeral
        urlConfiguration.protocolClasses = [PlanURLProtocol.self]
        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            tokenProvider: { "token" },
            onUnauthorized: { false },
            urlSession: URLSession(configuration: urlConfiguration)
        )

        let viewModel = PlanViewModel(apiClient: client, dataRepository: repository)
        await viewModel.loadPlan()

        guard case .loaded(let plan) = viewModel.result else {
            return XCTFail("expected a remote plan")
        }
        XCTAssertEqual(plan.title, "远程计划")
        let cachedPlan = await repository.fetchLatestPlan(subject: "数学")
        XCTAssertNotNil(cachedPlan)
    }
}

private final class PlanURLProtocol: URLProtocol {
    nonisolated(unsafe) static var handler: ((URLRequest) -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.handler else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }
        let (response, data) = handler(request)
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}
