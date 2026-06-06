/*
 * ThunderCaptcha — background (service worker)
 *
 * content script からの "bt-ci:launcher" メッセージを受けて、
 * 物理 Launcher(Raspberry Pi 等) へ HTTP POST する。
 *
 * 設定: LAUNCHER_ENDPOINT
 *   - 既定は空文字 → 何もしない
 *   - 下の定数を書き換えるか、chrome.storage.local の "launcherEndpoint" で上書き可能
 *   - 例: chrome.storage.local.set({ launcherEndpoint: "http://raspberrypi.local:8080/fire" })
 *
 * POST に失敗しても content 側の UI / Merge 演出は止めない（ここで握りつぶす）。
 */

// ▼ ここを書き換えれば storage 設定なしでも POST 先を指定できる
const LAUNCHER_ENDPOINT = "";

async function resolveEndpoint() {
  if (LAUNCHER_ENDPOINT) return LAUNCHER_ENDPOINT;
  try {
    const { launcherEndpoint } = await chrome.storage.local.get("launcherEndpoint");
    return typeof launcherEndpoint === "string" ? launcherEndpoint : "";
  } catch (e) {
    return "";
  }
}

async function fireLauncher(prKey) {
  const endpoint = await resolveEndpoint();
  if (!endpoint) return; // 空なら何もしない

  const body = JSON.stringify({
    reason: "github_merge",
    pr: prKey || "",
    source: "black-thunder-ci"
  });

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });
    if (!res.ok) {
      console.warn("[ThunderCaptcha] launcher POST non-OK:", res.status);
    }
  } catch (e) {
    // fetch 失敗してもここで止める（UI には影響させない）
    console.warn("[ThunderCaptcha] launcher POST failed:", e && e.message);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "bt-ci:launcher") {
    // 非同期で投げる。応答は待たせない。
    fireLauncher(msg.pr);
    sendResponse({ ok: true });
  }
  return false;
});
