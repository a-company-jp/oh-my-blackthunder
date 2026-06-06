import * as cp from "child_process";
import * as vscode from "vscode";

export interface DayCell {
  /** YYYY-MM-DD（未来日は count = -1 で非表示扱い） */
  date: string;
  count: number;
}

export interface Grass {
  /** 週（列）の配列。各列は日曜→土曜の 7 セル。 */
  weeks: DayCell[][];
  total: number;
  max: number;
  today: number;
  /** 今日から遡って連続でコミットした日数。 */
  streak: number;
  hasRepo: boolean;
}

/** ワークスペースの git 作業ディレクトリを返す。 */
export function repoCwd(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/** 現在の HEAD コミットハッシュを返す（リポジトリでなければ undefined）。 */
export async function headCommit(cwd: string): Promise<string | undefined> {
  const out = (await git(cwd, ["rev-parse", "HEAD"])).trim();
  return out || undefined;
}

function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    cp.execFile(
      "git",
      args,
      { cwd, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => resolve(err ? "" : stdout)
    );
  });
}

/** ローカルの YYYY-MM-DD（git --date=short と桁を合わせる）。 */
function iso(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** git のコミット履歴から「草」グリッドを組み立てる。 */
export async function getGrass(cwd: string, weeks = 17): Promise<Grass> {
  const totalDays = weeks * 7;
  const out = await git(cwd, [
    "log",
    "--no-merges",
    `--since=${totalDays} days ago`,
    "--date=short",
    "--pretty=format:%cd",
  ]);

  const isRepo = (await git(cwd, ["rev-parse", "--is-inside-work-tree"]))
    .trim()
    .startsWith("true");

  const counts: Record<string, number> = {};
  if (out) {
    for (const line of out.split("\n")) {
      const d = line.trim();
      if (d) {
        counts[d] = (counts[d] ?? 0) + 1;
      }
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // グリッド開始日：totalDays 分さかのぼり、さらに直前の日曜まで戻す。
  const start = new Date(today);
  start.setDate(today.getDate() - (totalDays - 1));
  start.setDate(start.getDate() - start.getDay());

  const weeksArr: DayCell[][] = [];
  const cur = new Date(start);
  let total = 0;
  let max = 0;
  while (cur <= today) {
    const col: DayCell[] = [];
    for (let i = 0; i < 7; i++) {
      const date = iso(cur);
      const count = cur > today ? -1 : counts[date] ?? 0;
      if (count > 0) {
        total += count;
        max = Math.max(max, count);
      }
      col.push({ date, count });
      cur.setDate(cur.getDate() + 1);
    }
    weeksArr.push(col);
  }

  // 連続コミット日数（今日から遡る）
  let streak = 0;
  const probe = new Date(today);
  while ((counts[iso(probe)] ?? 0) > 0) {
    streak++;
    probe.setDate(probe.getDate() - 1);
  }

  return {
    weeks: weeksArr,
    total,
    max,
    today: counts[iso(today)] ?? 0,
    streak,
    hasRepo: isRepo,
  };
}
