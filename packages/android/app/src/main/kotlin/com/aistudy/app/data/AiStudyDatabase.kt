package com.aistudy.app.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

/**
 * 本地缓存数据库（镜像 iOS SwiftData ModelContainer，承载 4 个模型）。
 * Room 通过 KSP 生成实现；`create` 单例化，避免反复打开连接。
 */
@Database(
    entities = [
        ChatHistoryEntity::class,
        GradeRecordEntity::class,
        PlanCacheEntity::class,
        UserSettingsEntity::class,
    ],
    version = 1,
    exportSchema = false,
)
abstract class AiStudyDatabase : RoomDatabase() {
    abstract fun chatHistoryDao(): ChatHistoryDao
    abstract fun gradeRecordDao(): GradeRecordDao
    abstract fun planCacheDao(): PlanCacheDao
    abstract fun userSettingsDao(): UserSettingsDao

    companion object {
        @Volatile private var instance: AiStudyDatabase? = null

        fun create(context: Context): AiStudyDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    AiStudyDatabase::class.java,
                    "aistudy.db",
                ).fallbackToDestructiveMigration().build().also { instance = it }
            }
    }
}
