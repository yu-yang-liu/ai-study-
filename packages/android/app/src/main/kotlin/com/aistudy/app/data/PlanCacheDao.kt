package com.aistudy.app.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

/** 学习计划缓存 DAO（镜像 iOS `DataRepository` 计划段）。 */
@Dao
interface PlanCacheDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: PlanCacheEntity)

    @Query("DELETE FROM plan_cache WHERE subject = :subject AND (focus IS :focus OR (focus IS NULL AND :focus IS NULL))")
    suspend fun delete(subject: String, focus: String?)

    @Query("SELECT * FROM plan_cache WHERE phase = :phase AND subject = :subject ORDER BY createdAt DESC LIMIT 1")
    suspend fun fetchLatestBySubject(phase: String, subject: String): PlanCacheEntity?

    @Query("SELECT * FROM plan_cache WHERE phase = :phase ORDER BY createdAt DESC LIMIT 1")
    suspend fun fetchLatest(phase: String): PlanCacheEntity?
}
