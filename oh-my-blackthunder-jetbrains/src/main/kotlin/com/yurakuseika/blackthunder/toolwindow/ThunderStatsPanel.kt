package com.yurakuseika.blackthunder.toolwindow

import com.intellij.openapi.project.Project
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBPanel
import com.intellij.util.ui.JBFont
import com.intellij.util.ui.JBUI
import com.yurakuseika.blackthunder.core.ThunderColors
import com.yurakuseika.blackthunder.core.ThunderNotifier
import com.yurakuseika.blackthunder.core.ThunderStats
import java.awt.BorderLayout
import java.awt.Component
import java.awt.FlowLayout
import java.awt.GridLayout
import javax.swing.BoxLayout
import javax.swing.JButton
import javax.swing.JPanel

/**
 * がんばりカウンターの表示パネル。
 * 「ブラックサンダー○個分がんばった」を中心に、保存／ビルド／テストの回数を見せる。
 */
class ThunderStatsPanel(private val project: Project) : JBPanel<ThunderStatsPanel>(BorderLayout()) {

    private val barsLabel = JBLabel().apply {
        font = JBFont.label().biggerOn(8f).asBold()
        foreground = ThunderColors.ACCENT
    }
    private val progressLabel = JBLabel()
    private val savesLabel = JBLabel()
    private val buildsLabel = JBLabel()
    private val testsLabel = JBLabel()
    private val pointsLabel = JBLabel()

    init {
        border = JBUI.Borders.empty(12)

        val header = JBLabel("⚡ ブラックサンダー がんばりカウンター ⚡").apply {
            font = JBFont.label().asBold()
            alignmentX = Component.LEFT_ALIGNMENT
        }

        val center = JPanel().apply {
            layout = BoxLayout(this, BoxLayout.Y_AXIS)
            isOpaque = false
            add(header)
            add(barsLabel.also { it.alignmentX = Component.LEFT_ALIGNMENT })
            add(progressLabel.also { it.alignmentX = Component.LEFT_ALIGNMENT })

            val grid = JPanel(GridLayout(0, 1, 0, 4)).apply {
                isOpaque = false
                border = JBUI.Borders.emptyTop(12)
                alignmentX = Component.LEFT_ALIGNMENT
                add(savesLabel)
                add(buildsLabel)
                add(testsLabel)
                add(pointsLabel)
            }
            add(grid)
        }

        val buttons = JPanel(FlowLayout(FlowLayout.LEFT, 8, 0)).apply {
            isOpaque = false
            add(JButton("応援して⚡").apply {
                addActionListener { ThunderNotifier.cheer(project) }
            })
            add(JButton("更新").apply {
                addActionListener { refresh() }
            })
        }

        add(center, BorderLayout.NORTH)
        add(buttons, BorderLayout.SOUTH)

        refresh()
    }

    fun refresh() {
        val stats = ThunderStats.getInstance()
        barsLabel.text = "🍫 ブラックサンダー ${stats.thunderBars} 個分！"
        progressLabel.text = "次の1個まであと ${stats.pointsToNextBar} pt"
        savesLabel.text = "保存した回数: ${stats.saves}"
        buildsLabel.text = "ビルド成功: ${stats.successfulBuilds}"
        testsLabel.text = "テスト全グリーン: ${stats.testsPassed}"
        pointsLabel.text = "合計ポイント: ${stats.points} pt"
    }
}
