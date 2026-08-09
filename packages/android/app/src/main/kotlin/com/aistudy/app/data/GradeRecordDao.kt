package com.aistudy.app.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

/** 批改记录 DAO（镜像 iOS `DataRepository` 批改段）。 */
@Dao
interface GradeRecordDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: GradeRecordEntity)

    @Query("SELECT * FROM grade_records WHERE phase = :phase AND subject = :subject ORDER BY createdAt DESC LIMIT :limit")
    suspend fun fetchBySubject(phase: String, subject: String, limit: Int = 30): List<GradeRecordEntity>

    @Query("SELECT * FROM grade_records WHERE phase = :phase ORDER BY createdAt DESC LIMIT :limit")
    suspend fun fetchAll(phase: String, limit: Int = 30): List<GradeRecordEntity>
}
