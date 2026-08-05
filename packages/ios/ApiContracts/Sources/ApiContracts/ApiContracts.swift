import Foundation

/// ApiContracts: AI 高中学习系统 iOS 客户端 API 模型层
///
/// 所有模型严格对应后端 packages/core/src 下的 zod schema 定义：
/// - Auth: LoginRequest/RegisterRequest 等 ← apps/web/src/app/api/auth/*/route.ts
/// - Chat: ChatRequest/ChatResponse ← TASK_SCHEMA.chat
/// - Analyze: AnalyzeRequest/AnalyzeResponse ← TASK_SCHEMA.analyze
/// - Grade: GradeRequest + GradeMathResponse/GradeEssayResponse ← TASK_SCHEMA.gradeMath/gradeEssay
/// - Plan: PlanRequest/PlanResponse ← TASK_SCHEMA.plan
/// - Learner: LearnerModel/LearningEvent ← packages/core/src/ai/learner/types.ts
/// - Content: ContentRecord ← packages/core/src/content.ts
public enum ApiContracts {
    public static let version = "0.1.0"
}
