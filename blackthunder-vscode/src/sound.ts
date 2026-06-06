import * as vscode from "vscode";
import { spawn } from "child_process";
import * as fs from "fs";

/**
 * 雷っぽい効果音を WAV として生成し、OS 標準のプレーヤーで再生する。
 * サイドバー webview に依存せず、保存ご褒美などからいつでも鳴らせる。
 */
export type SoundName = "thunder" | "crunch";

export class SoundPlayer {
  private files: Partial<Record<SoundName, string>> = {};

  constructor(private readonly storageUri: vscode.Uri) {}

  /** 効果音ファイルを globalStorage に用意する（無ければ生成）。 */
  async init(): Promise<void> {
    await fs.promises.mkdir(this.storageUri.fsPath, { recursive: true });
    const sounds: Record<SoundName, () => Buffer> = {
      thunder: buildThunderWav,
      crunch: buildCrunchWav,
    };
    for (const name of Object.keys(sounds) as SoundName[]) {
      const file = vscode.Uri.joinPath(this.storageUri, `${name}.wav`).fsPath;
      // 生成ロジック更新時に作り直せるよう毎回書き出す（軽いので問題なし）。
      await fs.promises.writeFile(file, sounds[name]());
      this.files[name] = file;
    }
  }

  /** 設定が有効なら効果音を再生する。失敗しても無視する（おまけ機能）。 */
  play(name: SoundName = "thunder"): void {
    const enabled = vscode.workspace
      .getConfiguration("blackthunder")
      .get<boolean>("enableSound", true);
    const filePath = this.files[name];
    if (!enabled || !filePath) {
      return;
    }
    const cmd = playerCommand(filePath);
    if (!cmd) {
      return;
    }
    try {
      const child = spawn(cmd.command, cmd.args, {
        stdio: "ignore",
        detached: false,
      });
      child.on("error", () => {
        /* プレーヤーが無い環境では黙って諦める */
      });
    } catch {
      /* noop */
    }
  }
}

/** プラットフォームごとの再生コマンドを返す。 */
function playerCommand(
  file: string
): { command: string; args: string[] } | undefined {
  switch (process.platform) {
    case "darwin":
      return { command: "afplay", args: [file] };
    case "win32":
      return {
        command: "powershell",
        args: [
          "-NoProfile",
          "-Command",
          `(New-Object Media.SoundPlayer '${file}').PlaySync();`,
        ],
      };
    default:
      // Linux など: paplay があれば優先、無ければ aplay。
      return { command: "sh", args: ["-c", `paplay '${file}' || aplay '${file}'`] };
  }
}

/**
 * ノイズバーストを指数減衰させた「ゴロゴロ」っぽいモノラル WAV を生成する。
 * 外部アセットを同梱せずに済むよう、起動時にプログラムで作る。
 */
function buildThunderWav(): Buffer {
  const sampleRate = 44100;
  const seconds = 0.9;
  const numSamples = Math.floor(sampleRate * seconds);
  const bytesPerSample = 2;

  const dataSize = numSamples * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // ---- WAV ヘッダ ----
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16); // fmt チャンクサイズ
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // モノラル
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28); // バイトレート
  buffer.writeUInt16LE(bytesPerSample, 32); // ブロックアライン
  buffer.writeUInt16LE(16, 34); // ビット深度
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  // ---- 波形データ ----
  // 低域寄りのノイズ（一次ローパス風）を指数減衰で包んだ、雷鳴っぽい音。
  let prev = 0;
  for (let i = 0; i < numSamples; i++) {
    const t = i / numSamples;
    const decay = Math.exp(-3.2 * t); // ゴロゴロと減衰
    const noise = Math.random() * 2 - 1;
    prev = prev * 0.85 + noise * 0.15; // ローパスで重みを出す
    // 立ち上がりのバチッという衝撃を少しだけ加える。
    const crack = t < 0.02 ? (Math.random() * 2 - 1) * (1 - t / 0.02) : 0;
    const sample = Math.max(-1, Math.min(1, (prev * 2.2 + crack) * decay));
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * bytesPerSample);
  }

  return buffer;
}

/**
 * 「ザクッ、ザクッ」というブラックサンダーの食感を表す短いクランチ音を作る。
 * 複数の鋭いノイズ粒（グレイン）を並べ、ハイパス強調でカリッとさせる。
 */
function buildCrunchWav(): Buffer {
  const sampleRate = 44100;
  const seconds = 0.45;
  const numSamples = Math.floor(sampleRate * seconds);
  const bytesPerSample = 2;
  const dataSize = numSamples * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  // 「ザク・ザク・ザク」の 3 粒。各粒は素早い立ち上がりと短い減衰。
  const grains = [0.0, 0.14, 0.27];
  let prevN = 0;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let env = 0;
    for (const g of grains) {
      const dt = t - g;
      if (dt >= 0 && dt < 0.1) {
        env = Math.max(env, Math.exp(-45 * dt));
      }
    }
    const n = Math.random() * 2 - 1;
    const hp = n - prevN; // ハイパス強調＝カリッとした質感
    prevN = n;
    const sample = Math.max(-1, Math.min(1, hp * 1.6 * env));
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * bytesPerSample);
  }

  return buffer;
}
