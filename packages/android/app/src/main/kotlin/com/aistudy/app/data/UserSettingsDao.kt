package com.aistudy.app.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

/** 用户设置单例 DAO（镜像 iOS `DataRepository` 设置段）。 */
@Dao
interface UserSettingsDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: UserSettingsEntity)

    @Query("SELECT * FROM user_settings WHERE id = :id LIMIT 1")
    suspend fun fetchById(id: String = UserSettingsEntity.singletonId): UserSettingsEntity?
}
