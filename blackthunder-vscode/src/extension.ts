import * as vscode from "vscode";
import { StatusBar } from "./statusBar";
import { SoundPlayer } from "./sound";
import { Sidebar } from "./sidebar";
import { ProgressBar } from "./progress";
import { getGrass, repoCwd, Grass } from "./git";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const sound = new SoundPlayer(context.globalStorageUri);
  await sound.init();

  const statusBar = new StatusBar();
  const progress = new ProgressBar();

  const emptyGrass: Grass = {
    weeks: [],
    total: 0,
    max: 0,
    today: 0,
    streak: 0,
    hasRepo: false,
  };
  const loadGrass = async (): Promise<Grass> => {
    const cwd = repoCwd();
    return cwd ? getGrass(cwd) : emptyGrass;
  };

  const sidebar = new Sidebar(context.extensionUri, loadGrass);

  /** 今日のコミット数をステータスバーへ反映する。 */
  const refreshStatus = async (): Promise<void> => {
    const grass = await loadGrass();
    statusBar.render(grass.today, grass.streak, grass.hasRepo);
  };
  void refreshStatus();

  context.subscriptions.push(
    statusBar,
    progress,

    vscode.window.registerWebviewViewProvider(Sidebar.viewType, sidebar, {
      webviewOptions: { retainContextWhenHidden: true },
    }),

    // コマンド: ザクッと味見（クランチ音を鳴らす）
    vscode.commands.registerCommand("blackthunder.eat", () => {
      sound.play("crunch");
    }),

    // コマンド: 草を更新
    vscode.commands.registerCommand("blackthunder.refreshGrass", async () => {
      await sidebar.refresh();
      await refreshStatus();
    }),

    // コマンド: 進捗バーのデモ（下のステータスバーで演出を確認できる）
    vscode.commands.registerCommand("blackthunder.demoProgress", () => {
      progress.start("デモ実行中…");
      sidebar.progressStart("デモ実行中…");
      setTimeout(() => {
        progress.end(true, "完了！");
        sidebar.progressEnd(true, "完了！");
      }, 3500);
    }),

    // 保存時：下のステータスバーでチョコが一瞬ザクッと走る演出
    vscode.workspace.onDidSaveTextDocument(() => {
      const cfg = vscode.workspace.getConfiguration("blackthunder");
      if (cfg.get<boolean>("showBuildProgress", true)) {
        progress.start("保存！");
        setTimeout(() => progress.end(true, "保存完了"), 1200);
      }
    }),

    // ビルド/テスト開始：チョコが震えながら走る進捗バーをスタート
    vscode.tasks.onDidStartTask((e) => {
      const cfg = vscode.workspace.getConfiguration("blackthunder");
      if (!cfg.get<boolean>("showBuildProgress", true)) {
        return;
      }
      const task = e.execution.task;
      if (isBuild(task) || isTest(task)) {
        progress.start(`${task.name} 実行中…`);
        sidebar.progressStart(`${task.name} 実行中…`);
      }
    }),

    // ビルド/テスト終了：完了/失敗の演出
    vscode.tasks.onDidEndTaskProcess((e) => {
      const cfg = vscode.workspace.getConfiguration("blackthunder");
      if (!cfg.get<boolean>("showBuildProgress", true)) {
        return;
      }
      const task = e.execution.task;
      if (!isBuild(task) && !isTest(task)) {
        return;
      }
      const ok = e.exitCode === 0;
      progress.end(ok, ok ? "完了！" : "失敗…");
      sidebar.progressEnd(ok, ok ? "完了！" : "失敗…");
      if (ok) {
        sound.play("thunder");
      }
    })
  );

  // git のコミットを監視し、コミットされたら「ザクザク」音 ＋ 草を更新する。
  void watchGitCommits(context, () => {
    const cfg = vscode.workspace.getConfiguration("blackthunder");
    if (cfg.get<boolean>("crunchOnCommit", true)) {
      sound.play("crunch");
    }
    progress.start("コミット！");
    setTimeout(() => progress.end(true, "ザクッ！"), 1200);
    void sidebar.refresh();
    void refreshStatus();
  });
}

export function deactivate(): void {
  /* subscriptions の dispose で後始末は完了する */
}

/** VSCode の git 拡張 API を使い、新規コミット（HEAD 変化）を検知する。 */
async function watchGitCommits(
  context: vscode.ExtensionContext,
  onCommit: () => void
): Promise<void> {
  const ext = vscode.extensions.getExtension<GitExtension>("vscode.git");
  if (!ext) {
    return;
  }
  const exports = ext.isActive ? ext.exports : await ext.activate();
  const api = exports.getAPI(1);

  const heads = new Map<string, string | undefined>();
  const watch = (repo: GitRepository): void => {
    heads.set(repo.rootUri.toString(), repo.state.HEAD?.commit);
    context.subscriptions.push(
      repo.state.onDidChange(() => {
        const key = repo.rootUri.toString();
        const cur = repo.state.HEAD?.commit;
        const prev = heads.get(key);
        if (cur && cur !== prev) {
          heads.set(key, cur);
          if (prev !== undefined) {
            // 起動直後の初期化は除外し、実際の新規コミットのみ反応する。
            onCommit();
          }
        }
      })
    );
  };

  api.repositories.forEach(watch);
  context.subscriptions.push(api.onDidOpenRepository(watch));
}

/** ビルド系タスクか判定する。 */
function isBuild(task: vscode.Task): boolean {
  return (
    task.group === vscode.TaskGroup.Build ||
    /build|compile|webpack|tsc|esbuild|vite|rollup|make|gradle|cargo|bundle/i.test(
      task.name
    )
  );
}

/** テスト系タスクか判定する。 */
function isTest(task: vscode.Task): boolean {
  return (
    task.group === vscode.TaskGroup.Test ||
    /test|spec|jest|vitest|pytest/i.test(task.name)
  );
}

// ---- VSCode git 拡張 API の最小型定義 ----
interface GitExtension {
  getAPI(version: 1): GitAPI;
}
interface GitAPI {
  readonly repositories: GitRepository[];
  onDidOpenRepository: vscode.Event<GitRepository>;
}
interface GitRepository {
  readonly rootUri: vscode.Uri;
  readonly state: {
    readonly HEAD?: { readonly commit?: string };
    readonly onDidChange: vscode.Event<void>;
  };
}
