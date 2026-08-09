package com.aistudy.app.data

import com.aistudy.corekit.config.AppEnvironment
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import java.time.LocalDate

/**
 * 数据仓库（镜像 iOS `DataRepository` actor）：封装 Room 读写。
 * 全部 suspend，内部切到 [Dispatchers.IO]；与 iOS 各段方法一一对应。
 */
class DataRepository(private val database: AiStudyDatabase) {

    private val phase: String get() = AppEnvironment.phase

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    // MARK: - 对话历史

    suspend fun saveChatHistory(title: String, subject: String, messages: List<CodableChatMessage>) {
        withContext(Dispatchers.IO) {
            val now = System.currentTimeMillis()
            val messagesJson = json.encodeToString(ListSerializer(CodableChatMessage.serializer()), messages)
            database.chatHistoryDao().deleteByTitle(title)
            database.chatHistoryDao().upsert(
                ChatHistoryEntity(
                    phase = phase,
                    title = title,
                    subject = subject,
                    messagesJson = messagesJson,
                    createdAt = now,
                    updatedAt = now,
                ),
            )
        }
    }

    suspend fun fetchChatHistories(limit: Int = 20): List<ChatHistoryEntity> = withContext(Dispatchers.IO) {
        database.chatHistoryDao().fetchHistories(phase, limit)
    }

    suspend fun fetchChatMessages(title: String): List<CodableChatMessage> = withContext(Dispatchers.IO) {
        val record = database.chatHistoryDao().fetchByTitle(title) ?: return@withContext emptyList()
        runCatching {
            json.decodeFromString(ListSerializer(CodableChatMessage.serializer()), record.messagesJson)
        }.getOrDefault(emptyList())
    }

    // MARK: - 批改记录

    suspend fun saveGradeRecord(
        subject: String,
        questionType: String,
        questionContent: String,
        studentAnswer: String,
        resultJson: String,
        score: Double,
        maxScore: Double,
    ) {
        withContext(Dispatchers.IO) {
            database.gradeRecordDao().insert(
                GradeRecordEntity(
                    phase = phase,
                    subject = subject,
                    questionType = questionType,
                    questionContent = questionContent,
                    studentAnswer = studentAnswer,
                    resultJson = resultJson,
                    score = score,
                    maxScore = maxScore,
                    createdAt = System.currentTimeMillis(),
                ),
            )
        }
    }

    suspend fun fetchGradeRecords(subject: String? = null, limit: Int = 30): List<GradeRecordEntity> =
        withContext(Dispatchers.IO) {
            if (subject != null) {
                database.gradeRecordDao().fetchBySubject(phase, subject, limit)
            } else {
                database.gradeRecordDao().fetchAll(phase, limit)
            }
        }

    // MARK: - 学习计划缓存

    suspend fun savePlanCache(subject: String, focus: String?, planJson: String) {
        withContext(Dispatchers.IO) {
            database.planCacheDao().delete(subject, focus)
            database.planCacheDao().upsert(
                PlanCacheEntity(
                    phase = phase,
                    subject = subject,
                    focus = focus,
                    planJson = planJson,
                    createdAt = System.currentTimeMillis(),
                ),
            )
        }
    }

    suspend fun fetchLatestPlan(subject: String? = null): PlanCacheEntity? = withContext(Dispatchers.IO) {
        if (subject != null) {
            database.planCacheDao().fetchLatestBySubject(phase, subject)
        } else {
            database.planCacheDao().fetchLatest(phase)
        }
    }

    // MARK: - 用户设置

    /** 获取或创建用户设置单例（镜像 iOS `fetchOrCreateSettings`）。返回的 `daysRemaining` 已据今日重算。 */
    suspend fun fetchOrCreateSettings(): UserSettingsEntity = withContext(Dispatchers.IO) {
        val existing = database.userSettingsDao().fetchById()
        val today = LocalDate.now()
        if (existing != null) {
            // 重算倒计时，保持 UI 与「今天」一致。
            val recomputed = existing.copy(
                daysRemaining = UserSettingsEntity.daysRemainingFrom(existing.examDateEpochDay, today),
            )
            if (recomputed.daysRemaining != existing.daysRemaining) {
                database.userSettingsDao().upsert(recomputed)
            }
            recomputed
        } else {
            val created = UserSettingsEntity(
                daysRemaining = UserSettingsEntity.daysRemainingFrom(
                    UserSettingsEntity.defaultExamDateEpochDay(today),
                    today,
                ),
                examDateEpochDay = UserSettingsEntity.defaultExamDateEpochDay(today),
            )
            database.userSettingsDao().upsert(created)
            created
        }
    }

    /**
     * 更新用户设置单例（镜像 iOS `updateSettings`）。
     * 据今日重算 [UserSettingsEntity.daysRemaining] 后 upsert，复用既有 DAO，无需新增方法。
     */
    suspend fun updateSettings(entity: UserSettingsEntity) {
        withContext(Dispatchers.IO) {
            val today = LocalDate.now()
            val updated = entity.copy(
                daysRemaining = UserSettingsEntity.daysRemainingFrom(entity.examDateEpochDay, today),
                updatedAt = System.currentTimeMillis(),
            )
            database.userSettingsDao().upsert(updated)
        }
    }
}

/** 可编码的消息条目（镜像 iOS `CodableChatMessage`），用于对话历史 JSON 串存储。 */
@Serializable
data class CodableChatMessage(
    val role: String,       // "user" | "assistant"
    val content: String,
    val timestamp: Long,
)
