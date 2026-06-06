package com.yurakuseika.blackthunder.core

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.util.xmlb.XmlSerializerUtil

/**
 * プラグインの設定（永続化）。`Settings → Tools → ブラックサンダー⚡` で変更できる。
 */
@Service(Service.Level.APP)
@State(
    name = "BlackThunderSettings",
    storages = [Storage("blackThunderSettings.xml")],
)
class ThunderSettings : PersistentStateComponent<ThunderSettings.State> {

    class State {
        /** 保存時に「ザクザク」音を鳴らすか（VSCode 版の enableSound 相当、既定 ON）。 */
        var soundOnSave: Boolean = true
    }

    private var state = State()

    override fun getState(): State = state

    override fun loadState(loaded: State) {
        XmlSerializerUtil.copyBean(loaded, state)
    }

    var soundOnSave: Boolean
        get() = state.soundOnSave
        set(value) {
            state.soundOnSave = value
        }

    companion object {
        fun getInstance(): ThunderSettings =
            ApplicationManager.getApplication().getService(ThunderSettings::class.java)
    }
}
