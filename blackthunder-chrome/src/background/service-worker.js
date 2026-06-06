/*
 * ThunderCaptcha — background (service worker)
 *
 * content script からのメッセージを受けて以下を行う:
 *   - "bt-ci:launcher" : 物理 Launcher(Raspberry Pi 等) へ HTTP POST する。
 *   - "bt-ci:eat"      : リーダーボードへ「ブラックサンダーを食べた」eat イベントを
 *                        website-brokered な APP TOKEN 経由で best-effort 送信する。
 *   - "bt-ci:lb-connect"/"bt-ci:lb-disconnect"/"bt-ci:lb-status"
 *                      : リーダーボード接続の管理（popup / options 用）。
 *
 * 設定: LAUNCHER_ENDPOINT
 *   - 既定は空文字 → 何もしない
 *   - 下の定数を書き換えるか、chrome.storage.local の "launcherEndpoint" で上書き可能
 *   - 例: chrome.storage.local.set({ launcherEndpoint: "http://raspberrypi.local:8080/fire" })
 *
 * POST に失敗しても content 側の UI / Merge 演出は止めない（ここで握りつぶす）。
 */

// リーダーボード連携 API（self.BTCI_LB を生やす）。
importScripts("leaderboard.js");

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

const LB = self.BTCI_LB;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg.type !== "string") return false;

  switch (msg.type) {
    case "bt-ci:launcher":
      // 非同期で投げる。応答は待たせない。
      fireLauncher(msg.pr);
      sendResponse({ ok: true });
      return false;

    case "bt-ci:eat":
      // 認証成功 → eat を 1 件記録。best-effort。Merge 演出はここの結果に依存しない。
      // 第一引数 true で未接続時に対話的 /connect フローを起動する。
      if (LB) {
        LB.recordEat(true).then(
          (r) => sendResponse(r),
          (e) => sendResponse({ ok: false, reason: (e && e.message) || "error" })
        );
        return true; // 非同期応答
      }
      sendResponse({ ok: false, reason: "leaderboard_unavailable" });
      return false;

    case "bt-ci:lb-connect":
      if (LB) {
        LB.connect(true).then(
          () => sendResponse({ ok: true }),
          (e) => sendResponse({ ok: false, reason: (e && e.message) || "error" })
        );
        return true;
      }
      sendResponse({ ok: false, reason: "leaderboard_unavailable" });
      return false;

    case "bt-ci:lb-disconnect":
      if (LB) {
        LB.clearToken().then(() => sendResponse({ ok: true }));
        return true;
      }
      sendResponse({ ok: false, reason: "leaderboard_unavailable" });
      return false;

    case "bt-ci:lb-status":
      if (LB) {
        Promise.all([LB.isConnected(), LB.getBaseUrl()]).then(
          ([connected, baseUrl]) => sendResponse({ ok: true, connected, baseUrl }),
          () => sendResponse({ ok: false, reason: "error" })
        );
        return true;
      }
      sendResponse({ ok: false, reason: "leaderboard_unavailable" });
      return false;

    default:
      return false;
  }
});
