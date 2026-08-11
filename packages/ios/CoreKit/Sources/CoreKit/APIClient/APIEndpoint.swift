import Foundation

/// API 端点定义
public enum APIEndpoint: Sendable {
    case login
    case register
    case logout
    case refreshToken
    case chat
    case chatHistory
    case appendChatHistory
    case analyze
    case grade
    case plan
    case planHistory
    case updatePlanTask(String)
    case profile
    case updateProfile
    case gradeHistory
    case learnerProfile
    case upload
    case uploadPresign
    case wrongQuestions
    case reviewWrongQuestion
    case addWrongQuestion
    case updateAnalysisBookmark(String)
    case stats
    case bankCount
    case bank
    case submitBankPractice

    public var path: String {
        switch self {
        case .login:               return "/api/auth/login"
        case .register:            return "/api/auth/register"
        case .logout:              return "/api/auth/logout"
        case .refreshToken:        return "/api/auth/refresh"
        case .chat:                return "/api/chat"
        case .chatHistory:         return "/api/chat/history"
        case .appendChatHistory:   return "/api/chat/history"
        case .analyze:             return "/api/analyze"
        case .grade:               return "/api/grade"
        case .plan:                return "/api/plan"
        case .planHistory:         return "/api/plan"
        case .updatePlanTask(let taskId): return "/api/plan/tasks/\(taskId)"
        case .profile, .updateProfile: return "/api/profile"
        case .gradeHistory:        return "/api/grade/history"
        case .learnerProfile:      return "/api/learner-profile"
        case .upload:              return "/api/upload"
        case .uploadPresign:       return "/api/upload/presign"
        case .wrongQuestions:      return "/api/wrong-questions"
        case .reviewWrongQuestion: return "/api/wrong-questions"
        case .addWrongQuestion:    return "/api/wrong-questions/add"
        case .updateAnalysisBookmark(let questionId): return "/api/analysis/\(questionId)"
        case .stats:               return "/api/stats"
        case .bankCount:           return "/api/bank/count"
        case .bank:                return "/api/bank"
        case .submitBankPractice:  return "/api/bank/practice"
        }
    }

    public var method: String {
        switch self {
        case .wrongQuestions, .stats, .bankCount, .bank, .chatHistory, .planHistory, .profile, .gradeHistory, .learnerProfile:
            return "GET"
        case .updateProfile, .updatePlanTask(_), .updateAnalysisBookmark(_):
            return "PATCH"
        default:
            return "POST"
        }
    }
}
