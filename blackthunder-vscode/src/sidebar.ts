import * as vscode from "vscode";
import { SLOGANS, pick } from "./slogans";
import { Grass } from "./git";

/** アクティビティバーに表示するブラックサンダーのサイドバー webview。 */
export class Sidebar implements vscode.WebviewViewProvider {
  public static readonly viewType = "blackthunder.sidebar";
  private view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly loadGrass: () => Promise<Grass>
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.html(view.webview);

    view.webview.onDidReceiveMessage((msg) => {
      if (msg?.type === "eat") {
        void vscode.commands.executeCommand("blackthunder.eat");
      } else if (msg?.type === "refresh") {
        void this.refresh();
      }
    });
    void this.refresh();
  }

  /** git の草データを読み直して webview に反映する。 */
  async refresh(): Promise<void> {
    if (!this.view) {
      return;
    }
    const grass = await this.loadGrass();
    this.view.webview.postMessage({
      type: "update",
      slogan: pick(SLOGANS, grass.total + new Date().getDate()),
      grass,
    });
  }

  /** ビルド等のタスク開始時、進捗バー演出をスタートする。 */
  progressStart(label: string): void {
    this.view?.webview.postMessage({ type: "progStart", label });
  }

  /** タスク終了時、進捗バーを完了/失敗状態にする。 */
  progressEnd(ok: boolean, label?: string): void {
    this.view?.webview.postMessage({ type: "progEnd", ok, label });
  }

  private uri(webview: vscode.Webview, ...p: string[]): vscode.Uri {
    return webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, ...p));
  }

  private html(webview: vscode.Webview): string {
    const nonce = makeNonce();
    const logo = this.uri(webview, "media", "logo.png");
    const choco = this.uri(webview, "media", "chocolate.png");
    return /* html */ `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; img-src ${webview.cspSource}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    /* ブラックサンダー パッケージ配色: 黒地 × 金の雷 × 赤の差し色 × クリーム文字 */
    :root {
      --bt-black: #0d0b0a;
      --bt-black2: #1a1613;
      --bt-gold: #f5c518;
      --bt-gold-soft: #ffe082;
      --bt-red: #e3001b;
      --bt-cream: #f3ead4;
      --bt-line: #3a2f1f;
    }
    body { font-family: var(--vscode-font-family); color: var(--bt-cream);
      text-align: center; padding: 14px 12px;
      background:
        radial-gradient(120% 60% at 50% -10%, #241c12 0%, transparent 60%),
        repeating-linear-gradient(45deg, #100d0b 0 14px, #0a0807 14px 28px);
      background-color: var(--bt-black); }
    /* 公式ロゴ */
    .logo { width: 88%; max-width: 240px; height: auto; display: block; margin: 2px auto 8px;
      filter: drop-shadow(0 3px 6px rgba(0,0,0,.6)); user-select: none; }
    /* チョコ本体（クリックでザクッと味見） */
    .choco-wrap { position: relative; display: inline-block; cursor: pointer;
      user-select: none; transition: transform .1s; margin: 4px auto 2px; }
    .choco-wrap:active { transform: scale(.94); }
    .choco { width: 70%; max-width: 180px; height: auto; display: block; margin: 0 auto;
      border-radius: 7px; filter: drop-shadow(0 4px 10px rgba(0,0,0,.65)); }
    .choco-wrap .spark { position: absolute; top: -6px; right: 8%; font-size: 26px;
      color: var(--bt-gold); filter: drop-shadow(0 0 8px rgba(245,197,24,.8));
      opacity: 0; pointer-events: none; }
    .choco-wrap.pop .spark { animation: spark .6s ease; }
    .choco-wrap.pop .choco { animation: pop .5s ease; }
    @keyframes pop { 0%{transform:scale(1)} 40%{transform:scale(1.1) rotate(-3deg)} 100%{transform:scale(1)} }
    @keyframes spark { 0%{opacity:0;transform:scale(.4) translateY(6px)}
      40%{opacity:1;transform:scale(1.3) translateY(-2px)} 100%{opacity:0;transform:scale(1) translateY(-10px)} }
    h3 { margin: 18px 0 6px; font-size: 12px; text-transform: uppercase;
      color: var(--bt-red); font-weight: 800; letter-spacing: .12em; }
    .slogan { font-style: italic; color: var(--bt-gold-soft); opacity: .95;
      min-height: 2.2em; font-size: 12px; margin-top: 4px; }
    button { margin-top: 10px; padding: 7px 16px; cursor: pointer;
      color: var(--bt-black); font-weight: 800;
      background: linear-gradient(180deg, var(--bt-gold) 0%, #d6a400 100%);
      border: 1px solid #8a6a00; border-radius: 4px; font-size: 13px;
      box-shadow: 0 2px 0 #5e4800, 0 0 10px rgba(245,197,24,.35); }
    button:hover { background: linear-gradient(180deg, var(--bt-gold-soft) 0%, var(--bt-gold) 100%); }
    button:active { transform: translateY(1px); box-shadow: 0 1px 0 #5e4800; }
    /* ビルド進捗バー（黒・黄・赤） */
    .prog { margin: 14px 0 4px; }
    .prog-label { font-size: 12px; font-weight: 700; color: var(--bt-gold-soft); margin-bottom: 5px; }
    .prog-track { position: relative; height: 24px; border-radius: 12px; overflow: hidden;
      background: #0a0807; border: 1px solid var(--bt-line); box-shadow: inset 0 0 6px rgba(0,0,0,.7); }
    .prog-fill { position: absolute; inset: 0; width: 0%;
      background: repeating-linear-gradient(45deg, #0d0b0a 0 12px, var(--bt-gold) 12px 24px, var(--bt-red) 24px 36px);
      background-size: 200% 100%; transition: width .3s ease; }
    .prog.running .prog-fill { width: 100%; opacity: .9; animation: stripes .5s linear infinite; }
    @keyframes stripes { from { background-position: 0 0; } to { background-position: 72px 0; } }
    .prog-choco { position: absolute; top: 50%; left: 6%; width: 34px; transform: translate(-50%, -50%); }
    .prog-choco img { width: 100%; height: auto; display: block; border-radius: 4px;
      filter: drop-shadow(0 0 5px rgba(0,0,0,.8)); }
    .prog.running .prog-choco { animation: race 1s linear infinite, shake .07s linear infinite; }
    @keyframes race { 0% { left: 7%; } 100% { left: 93%; } }
    @keyframes shake {
      0%   { transform: translate(-50%, -50%) rotate(-7deg); }
      50%  { transform: translate(-50%, -62%) rotate(7deg); }
      100% { transform: translate(-50%, -50%) rotate(-7deg); } }
    .prog.done .prog-fill { width: 100%; animation: none; opacity: 1;
      background: linear-gradient(90deg, var(--bt-gold), #ff8a00); }
    .prog.done .prog-choco { left: 93%; animation: none; }
    .prog.fail .prog-fill { width: 100%; animation: none; opacity: 1;
      background: linear-gradient(90deg, var(--bt-red), #7a0010); }
    .prog.fail .prog-choco { left: 50%; animation: none; filter: grayscale(.55) drop-shadow(0 0 4px #000); }
    .prog-result { font-weight: 800; min-height: 1.2em; margin-top: 6px; font-size: 13px; }
    .prog.done .prog-result { color: var(--bt-gold); text-shadow: 0 0 10px rgba(245,197,24,.5); }
    .prog.fail .prog-result { color: var(--bt-red); }
    /* コミットの草 */
    .stats { font-size: 12px; color: var(--bt-cream); margin: 2px 0 8px; }
    .stats b { color: var(--bt-gold); font-weight: 800; }
    .grass { display: flex; gap: 3px; justify-content: center; overflow-x: auto;
      padding: 4px 2px 6px; }
    .gcol { display: flex; flex-direction: column; gap: 3px; }
    .gcell { width: 11px; height: 11px; border-radius: 2px; background: #19130e; }
    .gcell.l0 { background: #19130e; }
    .gcell.l1 { background: #5e4a05; }
    .gcell.l2 { background: #a87e00; }
    .gcell.l3 { background: var(--bt-gold); }
    .gcell.l4 { background: var(--bt-red); box-shadow: 0 0 4px rgba(227,0,27,.7); }
    .gcell.empty { background: transparent; }
    .gcell.today { outline: 1px solid var(--bt-gold-soft); outline-offset: 1px; }
    .legend { font-size: 10px; color: var(--bt-cream); opacity: .7;
      display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 2px; }
    .legend .gcell { width: 9px; height: 9px; }
    .norepo { font-size: 12px; color: var(--bt-cream); opacity: .7; padding: 10px; }
  </style>
</head>
<body>
  <img class="logo" src="${logo}" alt="ブラックサンダー" draggable="false" />
  <div class="choco-wrap" id="bolt" title="クリックでザクッと味見">
    <img class="choco" src="${choco}" alt="ブラックサンダー チョコ" draggable="false" />
    <span class="spark">⚡</span>
  </div>
  <div class="slogan" id="slogan"></div>
  <button id="eat">ザクッと味見 🍫</button>

  <div class="prog" id="prog" hidden>
    <div class="prog-label" id="progLabel">ビルド中…</div>
    <div class="prog-track">
      <div class="prog-fill" id="progFill"></div>
      <div class="prog-choco" id="progChoco"><img src="${choco}" alt="" draggable="false" /></div>
    </div>
    <div class="prog-result" id="progResult"></div>
  </div>

  <h3>コミットの草 ⚡</h3>
  <div class="stats" id="stats"></div>
  <div id="grassWrap"><div class="grass" id="grass"></div></div>
  <div class="legend" id="legend"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    function eat() { vscode.postMessage({ type: 'eat' }); }
    document.getElementById('bolt').addEventListener('click', eat);
    document.getElementById('eat').addEventListener('click', eat);

    function level(count, max) {
      if (count <= 0) return 0;
      if (max <= 1) return 3;
      const r = count / max;
      if (r > 0.75) return 4;
      if (r > 0.5) return 3;
      if (r > 0.25) return 2;
      return 1;
    }
    function renderGrass(g) {
      const stats = document.getElementById('stats');
      const grass = document.getElementById('grass');
      const legend = document.getElementById('legend');
      if (!g || !g.hasRepo) {
        stats.textContent = '';
        grass.parentElement.innerHTML = '<div class="norepo">gitリポジトリが見つかりません。<br>このフォルダで git init するとコミットの草が育ちます🌱</div>';
        legend.innerHTML = '';
        return;
      }
      const today = new Date();
      const tIso = today.getFullYear() + '-' +
        String(today.getMonth()+1).padStart(2,'0') + '-' +
        String(today.getDate()).padStart(2,'0');
      stats.innerHTML = '直近 <b>' + g.total + '</b> コミット ／ 連続 <b>' + g.streak +
        '</b> 日 ／ 今日 <b>' + g.today + '</b>';
      grass.innerHTML = g.weeks.map(col =>
        '<div class="gcol">' + col.map(cell => {
          if (cell.count < 0) return '<div class="gcell empty"></div>';
          const lv = level(cell.count, g.max);
          const isToday = cell.date === tIso ? ' today' : '';
          return '<div class="gcell l' + lv + isToday + '" title="' +
            cell.date + ': ' + cell.count + ' commits"></div>';
        }).join('') + '</div>'
      ).join('');
      legend.innerHTML = '少 ' +
        [0,1,2,3,4].map(l => '<span class="gcell l' + l + '"></span>').join('') + ' 多';
    }

    let progTimer;
    function progStart(label) {
      const p = document.getElementById('prog');
      clearTimeout(progTimer);
      p.hidden = false; p.className = 'prog running';
      document.getElementById('progLabel').textContent = label || 'ビルド中…';
      document.getElementById('progResult').textContent = '';
    }
    function progEnd(ok, label) {
      const p = document.getElementById('prog');
      p.className = 'prog ' + (ok ? 'done' : 'fail');
      document.getElementById('progLabel').textContent = label || (ok ? '完了！' : '失敗…');
      document.getElementById('progResult').textContent =
        ok ? 'おいしさイナズマ級！⚡' : '甘さ控えめエラーです🍫';
      progTimer = setTimeout(() => { p.hidden = true; p.className = 'prog'; }, ok ? 4500 : 6500);
    }

    window.addEventListener('message', (e) => {
      const m = e.data;
      if (m.type === 'progStart') { progStart(m.label); return; }
      if (m.type === 'progEnd') { progEnd(m.ok, m.label); return; }
      if (m.type !== 'update') return;
      document.getElementById('slogan').textContent = m.slogan;
      renderGrass(m.grass);
      const bolt = document.getElementById('bolt');
      bolt.classList.remove('pop'); void bolt.offsetWidth; bolt.classList.add('pop');
    });
  </script>
</body>
</html>`;
  }
}

function makeNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}
