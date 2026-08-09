package com.aistudy.app.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

/** 对话历史 DAO（镜像 iOS `DataRepository` 对话段）。 */
@Dao
interface ChatHistoryDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: ChatHistoryEntity)

    @Query("DELETE FROM chat_history WHERE title = :title")
    suspend fun deleteByTitle(title: String)

    @Query("SELECT * FROM chat_history WHERE phase = :phase ORDER BY updatedAt DESC LIMIT :limit")
    suspend fun fetchHistories(phase: String, limit: Int = 20): List<ChatHistoryEntity>

    @Query("SELECT * FROM chat_history WHERE title = :title LIMIT 1")
    suspend fun fetchByTitle(title: String): ChatHistoryEntity?

    @Query("SELECT * FROM chat_history WHERE phase = :phase ORDER BY updatedAt DESC LIMIT :limit")
    fun observeHistories(phase: String, limit: Int = 20): Flow<List<ChatHistoryEntity>>
}
