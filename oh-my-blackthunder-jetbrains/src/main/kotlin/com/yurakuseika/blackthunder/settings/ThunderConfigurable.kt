package com.yurakuseika.blackthunder.settings

import com.intellij.openapi.options.Configurable
import com.intellij.ui.components.JBCheckBox
import com.intellij.util.ui.JBUI
import com.yurakuseika.blackthunder.core.ThunderSettings
import com.yurakuseika.blackthunder.core.ThunderSound
import java.awt.FlowLayout
import javax.swing.BoxLayout
import javax.swing.JButton
import javax.swing.JComponent
import javax.swing.JPanel

/**
 * `Settings → Tools → ブラックサンダー⚡` の設定画面。
 */
class ThunderConfigurable : Configurable {

    private var soundOnSave: JBCheckBox? = null

    override fun getDisplayName(): String = "ブラックサンダー⚡"

    override fun createComponent(): JComponent {
        val checkbox = JBCheckBox("保存時に「ザクザク」音を鳴らす").also { soundOnSave = it }

        val tryRow = JPanel(FlowLayout(FlowLayout.LEFT, 0, 0)).apply {
            add(JButton("ザクッと味見⚡").apply { addActionListener { ThunderSound.play() } })
        }

        return JPanel().apply {
            layout = BoxLayout(this, BoxLayout.Y_AXIS)
            border = JBUI.Borders.empty(10)
            add(checkbox)
            add(tryRow)
        }
    }

    override fun isModified(): Boolean =
        soundOnSave?.isSelected != ThunderSettings.getInstance().soundOnSave

    override fun apply() {
        ThunderSettings.getInstance().soundOnSave = soundOnSave?.isSelected ?: true
    }

    override fun reset() {
        soundOnSave?.isSelected = ThunderSettings.getInstance().soundOnSave
    }

    override fun disposeUIResources() {
        soundOnSave = null
    }
}
