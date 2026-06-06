package com.yurakuseika.blackthunder.core

import com.intellij.ui.JBColor
import java.awt.Color

/**
 * Black Thunder package palette.
 * - Thunder Yellow: RGB(255, 211, 0)
 * - Thunder Red:    RGB(230, 0, 18)
 * - Normal White:   #FFFFFF
 */
object ThunderColors {
    val YELLOW: Color = Color(255, 211, 0)
    val RED: Color = Color(230, 0, 18)
    val BLACK: Color = Color(17, 17, 17)
    val WHITE: Color = Color(255, 255, 255)

    /** Foreground that stays readable in both light and dark themes. */
    val ACCENT: JBColor = JBColor(RED, YELLOW)
}
