package com.yurakuseika.blackthunder.core

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.util.xmlb.XmlSerializerUtil

/**
 * がんばりカウンター（永続化）。
 *
 * 保存・ビルド成功・テスト成功などの回数からポイントを貯め、
 * 「ブラックサンダー何個分がんばったか」を可視化する。
 */
@Service(Service.Level.APP)
@State(
    name = "BlackThunderStats",
    storages = [Storage("blackThunderStats.xml")],
)
class ThunderStats : PersistentStateComponent<ThunderStats.State> {

    /** ポイント配分（ブラックサンダー＝1個30円にちなんで 30pt で1個）。 */
    object Points {
        const val SAVE = 1
        const val BUILD_SUCCESS = 5
        const val TEST_PASS = 10
        const val PER_BAR = 30
    }

    class State {
        var saves: Int = 0
        var successfulBuilds: Int = 0
        var testsPassed: Int = 0
        var points: Int = 0
    }

    private var state = State()

    override fun getState(): State = state

    override fun loadState(loaded: State) {
        XmlSerializerUtil.copyBean(loaded, state)
    }

    fun recordSave() {
        state.saves++
        state.points += Points.SAVE
    }

    fun recordSuccessfulBuild() {
        state.successfulBuilds++
        state.points += Points.BUILD_SUCCESS
    }

    fun recordTestsPassed() {
        state.testsPassed++
        state.points += Points.TEST_PASS
    }

    val saves: Int get() = state.saves
    val successfulBuilds: Int get() = state.successfulBuilds
    val testsPassed: Int get() = state.testsPassed
    val points: Int get() = state.points

    /** 貯めたポイントを「ブラックサンダー何個分」に換算。 */
    val thunderBars: Int get() = state.points / Points.PER_BAR

    /** 次の1個まであと何ポイントか。 */
    val pointsToNextBar: Int get() = Points.PER_BAR - (state.points % Points.PER_BAR)

    companion object {
        fun getInstance(): ThunderStats =
            ApplicationManager.getApplication().getService(ThunderStats::class.java)
    }
}
