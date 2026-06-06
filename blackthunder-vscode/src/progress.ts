import * as vscode from "vscode";

/**
 * 下のステータスバーに「チョコが震えながらバー上を疾走する」進捗演出を出す。
 * VSCode のステータスバーは文字とテーマ色しか使えないため、ブロック文字で
 * バーを描き、🍫/⚡ を高速で点滅・移動させて“震えながら進む”を表現する。
 */
export class ProgressBar {
  private readonly item: vscode.StatusBarItem;
  private timer: ReturnType<typeof setInterval> | undefined;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  private tick = 0;
  private label = "";
  private readonly cells = 12;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      10000
    );
    this.item.command = "blackthunder.demoProgress";
  }

  /** 進捗演出を開始する（実行中は不定アニメ）。 */
  start(label: string): void {
    this.clearTimers();
    this.label = label;
    this.tick = 0;
    // 走行中は黄色背景（ブラックサンダーの黄）
    this.item.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground"
    );
    this.item.color = undefined;
    this.item.tooltip = label;
    this.item.show();
    this.timer = setInterval(() => this.frame(), 90);
    this.frame();
  }

  /** 完了/失敗で締める。数秒後に自動で消える。 */
  end(ok: boolean, label?: string): void {
    this.clearTimers();
    if (ok) {
      this.item.backgroundColor = undefined;
      this.item.color = "#f5c518";
      this.item.text = "$(zap) おいしさイナズマ級！";
      this.item.tooltip = label ?? "ビルド完了";
    } else {
      this.item.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.errorBackground"
      );
      this.item.color = undefined;
      this.item.text = "$(error) 甘さ控えめエラーです";
      this.item.tooltip = label ?? "タスク失敗";
    }
    this.item.show();
    this.hideTimer = setTimeout(() => this.item.hide(), ok ? 4500 : 6500);
  }

  /** 走行フレームを 1 コマ描画する。 */
  private frame(): void {
    const pos = this.tick % this.cells;
    // 進んだ部分＝■、残り＝・。マーカーは 🍫 と ⚡ を交互にして“震え/点滅”を表現
    const marker = this.tick % 2 === 0 ? "🍫" : "⚡";
    const traveled = "▰".repeat(pos);
    const remaining = "▱".repeat(this.cells - pos - 1);
    this.item.text = `${traveled}${marker}${remaining}`;
    this.tick++;
  }

  private clearTimers(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = undefined;
    }
  }

  dispose(): void {
    this.clearTimers();
    this.item.dispose();
  }
}
