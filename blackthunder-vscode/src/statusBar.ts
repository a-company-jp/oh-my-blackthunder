import * as vscode from "vscode";

/** 今日のコミット数と連続日数をステータスバーに表示する。 */
export class StatusBar {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.command = "blackthunder.refreshGrass";
    this.item.color = "#f5c518"; // ブラックサンダーの金
    this.render(0, 0, false);
    this.item.show();
  }

  /** 今日のコミット数・連続日数・リポジトリ有無を反映する。 */
  render(today: number, streak: number, hasRepo: boolean): void {
    if (!hasRepo) {
      this.item.text = "$(zap) Black Thunder";
      this.item.tooltip = "gitリポジトリがありません";
      return;
    }
    this.item.text = `$(zap) ${today}  $(flame) ${streak}`;
    this.item.tooltip = `今日のコミット: ${today} ／ 連続コミット: ${streak}日（クリックで更新）`;
  }

  dispose(): void {
    this.item.dispose();
  }
}
