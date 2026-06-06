import * as vscode from "vscode";
import { StatusBar } from "./statusBar";
import { SoundPlayer } from "./sound";
import { Sidebar } from "./sidebar";
import { ProgressBar } from "./progress";
import { getGrass, repoCwd, headCommit, Grass } from "./git";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const sound = new SoundPlayer(context.globalStorageUri, context.extensionUri);
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

  // VSCode 組み込みの git 拡張（vscode.git）。コミット検知に使う。
  const gitApi = await getGitApi();

  const sidebar = new Sidebar(context.extensionUri, loadGrass);

  /** 今日のコミット数をステータスバーへ反映する。 */
  const refreshStatus = async (): Promise<void> => {
    const grass = await loadGrass();
    statusBar.render(grass.today, grass.streak, grass.hasRepo);
  };
  void refreshStatus();

  // 保存・新規作成・整形など頻繁な操作で鳴らすザクッ音（コミットと同じ PIXTA 音源）。
  // 4.5 秒と長めなので、Save All 等で大量に重ならないよう軽くスロットルする。
  let lastCrunch = 0;
  const crunch = (): void => {
    const now = Date.now();
    if (now - lastCrunch < 800) {
      return;
    }
    lastCrunch = now;
    sound.play("crunch");
  };

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

    // コマンド: 整形してザクッ（Shift+Alt+F に割り当てると整形のたびに鳴る）
    vscode.commands.registerCommand("blackthunder.formatAndCrunch", async () => {
      await vscode.commands.executeCommand("editor.action.formatDocument");
      crunch();
    }),

    // 保存時：ザクッ音 ＋ 下のステータスバーでチョコが一瞬走る演出
    vscode.workspace.onDidSaveTextDocument(() => {
      crunch();
      const cfg = vscode.workspace.getConfiguration("blackthunder");
      if (cfg.get<boolean>("showBuildProgress", true)) {
        progress.start("保存！");
        setTimeout(() => progress.end(true, "保存完了"), 1200);
      }
    }),

    // ファイル新規作成時：ザクッ音
    vscode.workspace.onDidCreateFiles(() => crunch()),

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
  void watchGitCommits(context, gitApi, () => {
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

/**
 * 新規コミット（HEAD の変化）を検知して onCommit を呼ぶ。
 *
 * 取りこぼしを防ぐため 2 系統のトリガを併用する:
 *   1. VSCode の git 拡張 API（SCM パネルからのコミットを即座に検知）
 *   2. .git/logs/HEAD（reflog）のファイル監視（ターミナル/CLI/外部ツール経由も検知）
 *
 * どちらのトリガでも「実際の HEAD ハッシュが変わったか」だけで判定するので、
 * 二重発火や起動直後の誤発火は起こらない。
 */
async function watchGitCommits(
  context: vscode.ExtensionContext,
  api: GitAPI | undefined,
  onCommit: () => void
): Promise<void> {
  const cwd = repoCwd();
  let lastHead = cwd ? await headCommit(cwd) : undefined;

  // HEAD を読み直し、前回から変われば onCommit。await と状態更新の間に別の
  // 呼び出しが割り込まないよう、比較～代入は同期的に行う（二重発火を防ぐ）。
  const check = async (): Promise<void> => {
    if (!cwd) {
      return;
    }
    const cur = await headCommit(cwd);
    if (cur && cur !== lastHead) {
      const prev = lastHead;
      lastHead = cur;
      if (prev !== undefined) {
        onCommit();
      }
    }
  };

  // 1) git 拡張の state 変化（SCM パネルからのコミット）。
  if (api) {
    const hook = (repo: GitRepository): void => {
      context.subscriptions.push(
        repo.state.onDidChange(() => void check())
      );
    };
    api.repositories.forEach(hook);
    context.subscriptions.push(api.onDidOpenRepository(hook));
  }

  // 2) .git/logs/HEAD（reflog）の監視。あらゆる手段のコミットを拾える。
  if (cwd) {
    const pattern = new vscode.RelativePattern(
      vscode.Uri.file(cwd),
      ".git/logs/HEAD"
    );
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    watcher.onDidChange(() => void check());
    watcher.onDidCreate(() => void check());
    context.subscriptions.push(watcher);
  }
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

/** VSCode 組み込みの git 拡張 API（vscode.git）を取得する。無ければ undefined。 */
async function getGitApi(): Promise<GitAPI | undefined> {
  try {
    const ext = vscode.extensions.getExtension<GitExtension>("vscode.git");
    if (!ext) {
      return undefined;
    }
    const exports = ext.isActive ? ext.exports : await ext.activate();
    return exports.getAPI(1);
  } catch {
    return undefined;
  }
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
