import Foundation

/// API 端点定义
public enum APIEndpoint: Sendable {
    case login
    case register
    case logout
    case refreshToken
    case chat
    case chatHistory
    case analyze
    case grade
    case plan
    case upload
    case uploadPresign
    case wrongQuestions
    case reviewWrongQuestion
    case stats
    case bankCount

    public var path: String {
        switch self {
        case .login:              return "/api/auth/login"
        case .register:           return "/api/auth/register"
        case .logout:             return "/api/auth/logout"
        case .refreshToken:       return "/api/auth/refresh"
        case .chat:               return "/api/chat"
        case .chatHistory:        return "/api/chat/history"
        case .analyze:            return "/api/analyze"
        case .grade:              return "/api/grade"
        case .plan:               return "/api/plan"
        case .upload:             return "/api/upload"
        case .uploadPresign:      return "/api/upload/presign"
        case .wrongQuestions:     return "/api/wrong-questions"
        case .reviewWrongQuestion: return "/api/wrong-questions"
        case .stats:              return "/api/stats"
        case .bankCount:          return "/api/bank/count"
        }
    }

    public var method: String {
        switch self {
        case .wrongQuestions, .stats, .bankCount, .chatHistory:
            return "GET"
        default:
            return "POST"
        }
    }
}
