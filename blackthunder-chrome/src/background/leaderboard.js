/*
 * ThunderCaptcha — リーダーボード連携（background / service worker 専用）
 *
 * 役割:
 *   1) website-brokered な APP TOKEN を取得する（chrome.identity.launchWebAuthFlow）。
 *      Chrome 拡張は GitHub OAuth を自前で実装しない。Web 側の /connect フローを
 *      開いて、サイトが GitHub 認証 → 不透明なトークンを発行 → redirect_uri に返す。
 *   2) 取得したトークンを chrome.storage.local に保存し、ブラックサンダーカウント用の
 *      eat イベントを <base>/api/ingest へ POST する。
 *
 * 重要: ここでの失敗は ThunderCaptcha 本体（Merge 演出）を一切止めない。
 *       eat の記録は best-effort。例外は握りつぶし、結果だけ返す。
 *
 * service worker（module ではない classic worker）から importScripts で読み込むか、
 * もしくは globalThis 経由で参照する。本ファイルは self.BTCI_LB に API を載せる。
 */
(function (root) {
  "use strict";

  // -------------------------------------------------------------------------
  // 設定
  // -------------------------------------------------------------------------

  // Web サービスのベース URL。プレースホルダ（実環境では run.app の本番 URL）。
  // chrome.storage.local の "leaderboardBaseUrl" で上書き可能（再ビルド不要）。
  var DEFAULT_BASE_URL = "https://blackathon.run.app";

  // chrome.storage.local のキー。
  var STORAGE_KEYS = {
    baseUrl: "leaderboardBaseUrl",
    token: "leaderboardToken"
  };

  // eat イベントの client 識別子（IngestRequest.client）。
  var CLIENT_ID = "blackthunder-chrome";

  // -------------------------------------------------------------------------
  // 小物ユーティリティ
  // -------------------------------------------------------------------------

  /** chrome.storage.local.get を Promise 化（callback / Promise 両対応）。 */
  function storageGet(keys) {
    return new Promise(function (resolve) {
      try {
        var ret = chrome.storage.local.get(keys, function (items) {
          var err = chrome.runtime && chrome.runtime.lastError;
          if (err) {
            resolve({});
            return;
          }
          resolve(items || {});
        });
        // MV3 の一部実装は Promise を返す。callback と二重 resolve しないよう、
        // callback 未発火のときのみ Promise 経路を使う形にはせず、上の callback に任せる。
        if (ret && typeof ret.then === "function") {
          ret.then(function (items) {
            resolve(items || {});
          }, function () {
            resolve({});
          });
        }
      } catch (e) {
        resolve({});
      }
    });
  }

  /** chrome.storage.local.set を Promise 化。 */
  function storageSet(items) {
    return new Promise(function (resolve) {
      try {
        var ret = chrome.storage.local.set(items, function () {
          // lastError を読んで握りつぶす。
          void (chrome.runtime && chrome.runtime.lastError);
          resolve();
        });
        if (ret && typeof ret.then === "function") {
          ret.then(function () {
            resolve();
          }, function () {
            resolve();
          });
        }
      } catch (e) {
        resolve();
      }
    });
  }

  /** chrome.storage.local.remove を Promise 化。 */
  function storageRemove(keys) {
    return new Promise(function (resolve) {
      try {
        var ret = chrome.storage.local.remove(keys, function () {
          void (chrome.runtime && chrome.runtime.lastError);
          resolve();
        });
        if (ret && typeof ret.then === "function") {
          ret.then(function () {
            resolve();
          }, function () {
            resolve();
          });
        }
      } catch (e) {
        resolve();
      }
    });
  }

  /** 末尾スラッシュを取り除いたベース URL を返す。 */
  function normalizeBaseUrl(value) {
    var url = typeof value === "string" && value ? value : DEFAULT_BASE_URL;
    return url.replace(/\/+$/, "");
  }

  /** 設定済みベース URL を解決する。 */
  function getBaseUrl() {
    return storageGet(STORAGE_KEYS.baseUrl).then(function (items) {
      return normalizeBaseUrl(items[STORAGE_KEYS.baseUrl]);
    });
  }

  /** ランダムな state nonce（CSRF / リダイレクト整合性確認用）。 */
  function makeNonce() {
    try {
      if (root.crypto && typeof root.crypto.randomUUID === "function") {
        return root.crypto.randomUUID();
      }
    } catch (e) {
      /* fallthrough */
    }
    // フォールバック: getRandomValues 由来の hex。
    try {
      var arr = new Uint8Array(16);
      root.crypto.getRandomValues(arr);
      var hex = "";
      for (var i = 0; i < arr.length; i++) {
        hex += ("0" + arr[i].toString(16)).slice(-2);
      }
      return hex;
    } catch (e2) {
      return String(Date.now()) + "-" + Math.random().toString(16).slice(2);
    }
  }

  /** UUID を生成（eat イベントの eventId 用）。 */
  function makeUuid() {
    try {
      if (root.crypto && typeof root.crypto.randomUUID === "function") {
        return root.crypto.randomUUID();
      }
    } catch (e) {
      /* fallthrough */
    }
    return makeNonce();
  }

  /**
   * リダイレクト先 URL（getRedirectURL() の結果や戻り URL）から token / state を抽出。
   * /connect は redirect_uri?token=...&state=... を返す（query / hash 双方を許容）。
   * @param {string} redirectUrl
   * @returns {{ token: string|null, state: string|null, error: string|null }}
   */
  function parseRedirect(redirectUrl) {
    var out = { token: null, state: null, error: null };
    if (!redirectUrl) return out;
    try {
      var u = new URL(redirectUrl);
      // query 優先、無ければ hash（#token=...）も見る。
      var sp = u.searchParams;
      if (u.hash && u.hash.length > 1) {
        var hashParams = new URLSearchParams(u.hash.replace(/^#/, ""));
        hashParams.forEach(function (v, k) {
          if (!sp.has(k)) sp.append(k, v);
        });
      }
      out.token = sp.get("token");
      out.state = sp.get("state");
      out.error = sp.get("error");
    } catch (e) {
      out.error = "parse_failed";
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // トークン入出力
  // -------------------------------------------------------------------------

  /** 保存済み APP TOKEN を取得（無ければ null）。 */
  function getToken() {
    return storageGet(STORAGE_KEYS.token).then(function (items) {
      var t = items[STORAGE_KEYS.token];
      return typeof t === "string" && t ? t : null;
    });
  }

  /** APP TOKEN を破棄（リーダーボード連携を解除）。 */
  function clearToken() {
    return storageRemove(STORAGE_KEYS.token);
  }

  // -------------------------------------------------------------------------
  // /connect フロー（launchWebAuthFlow）
  // -------------------------------------------------------------------------

  /**
   * Web 側 /connect を開いて APP TOKEN を取得し、保存する。
   * @param {boolean} interactive UI を出すか（ユーザー操作起点なら true）
   * @returns {Promise<string>} token（失敗時は reject）
   */
  function connect(interactive) {
    return getBaseUrl().then(function (base) {
      return new Promise(function (resolve, reject) {
        if (!chrome.identity || typeof chrome.identity.launchWebAuthFlow !== "function") {
          reject(new Error("chrome.identity.launchWebAuthFlow is unavailable"));
          return;
        }

        var redirectUri = chrome.identity.getRedirectURL();
        var nonce = makeNonce();
        var authUrl =
          base +
          "/connect?app=chrome" +
          "&redirect_uri=" +
          encodeURIComponent(redirectUri) +
          "&state=" +
          encodeURIComponent(nonce);

        var opts = { url: authUrl, interactive: interactive !== false };

        var ret = chrome.identity.launchWebAuthFlow(opts, function (responseUrl) {
          var err = chrome.runtime && chrome.runtime.lastError;
          if (err) {
            reject(new Error(err.message || "launchWebAuthFlow failed"));
            return;
          }
          if (!responseUrl) {
            reject(new Error("No response from /connect"));
            return;
          }
          var parsed = parseRedirect(responseUrl);
          if (parsed.error) {
            reject(new Error("connect error: " + parsed.error));
            return;
          }
          if (!parsed.token) {
            reject(new Error("No token in redirect"));
            return;
          }
          // state 検証（戻り値に state が含まれる場合のみ厳格にチェック）。
          if (parsed.state != null && parsed.state !== nonce) {
            reject(new Error("State mismatch"));
            return;
          }
          storageSet(
            (function () {
              var o = {};
              o[STORAGE_KEYS.token] = parsed.token;
              return o;
            })()
          ).then(function () {
            resolve(parsed.token);
          });
        });

        // 一部実装は Promise を返す（callback 未対応環境）。
        if (ret && typeof ret.then === "function") {
          ret.then(
            function (responseUrl) {
              var parsed = parseRedirect(responseUrl);
              if (parsed.error || !parsed.token) {
                reject(new Error(parsed.error || "No token in redirect"));
                return;
              }
              if (parsed.state != null && parsed.state !== nonce) {
                reject(new Error("State mismatch"));
                return;
              }
              var o = {};
              o[STORAGE_KEYS.token] = parsed.token;
              storageSet(o).then(function () {
                resolve(parsed.token);
              });
            },
            function (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          );
        }
      });
    });
  }

  /**
   * トークンがあればそれを返し、無ければ（許可されていれば）connect を試みる。
   * @param {boolean} interactive 未接続時に対話フローを起動するか
   * @returns {Promise<string|null>}
   */
  function ensureToken(interactive) {
    return getToken().then(function (token) {
      if (token) return token;
      if (!interactive) return null;
      return connect(true).catch(function () {
        return null;
      });
    });
  }

  // -------------------------------------------------------------------------
  // eat イベント送信
  // -------------------------------------------------------------------------

  /**
   * eat IngestEvent を 1 件 POST する。IngestEatEvent の wire shape に厳密一致。
   * @param {string} base 正規化済みベース URL
   * @param {string} token APP TOKEN
   * @returns {Promise<{ ok: boolean, status?: number }>}
   */
  function postEat(base, token) {
    var event = {
      kind: "eat",
      source: "chrome",
      eventId: "chrome:" + makeUuid(),
      tsMs: Date.now(),
      count: 1
    };
    var body = JSON.stringify({ client: CLIENT_ID, events: [event] });

    return fetch(base + "/api/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: body
    }).then(function (res) {
      return { ok: res.ok, status: res.status };
    });
  }

  /**
   * ThunderCaptcha 認証成功時に呼ぶエントリ。トークンを確保し eat を 1 件記録。
   * best-effort: 失敗しても reject せず { ok:false, reason } を返す。
   * @param {boolean} interactiveConnect 未接続なら対話フローを試みるか
   * @returns {Promise<{ ok: boolean, reason?: string }>}
   */
  function recordEat(interactiveConnect) {
    return getBaseUrl()
      .then(function (base) {
        return ensureToken(interactiveConnect !== false).then(function (token) {
          if (!token) {
            return { ok: false, reason: "not_connected" };
          }
          return postEat(base, token)
            .then(function (r) {
              if (r.ok) return { ok: true };
              // 401/403 はトークン失効の可能性 → 破棄して次回再接続を促す。
              if (r.status === 401 || r.status === 403) {
                return clearToken().then(function () {
                  return { ok: false, reason: "unauthorized" };
                });
              }
              return { ok: false, reason: "http_" + r.status };
            })
            .catch(function (e) {
              return { ok: false, reason: (e && e.message) || "fetch_failed" };
            });
        });
      })
      .catch(function (e) {
        return { ok: false, reason: (e && e.message) || "error" };
      });
  }

  /** リーダーボードに接続済みか（トークンの有無）。 */
  function isConnected() {
    return getToken().then(function (t) {
      return !!t;
    });
  }

  var api = {
    DEFAULT_BASE_URL: DEFAULT_BASE_URL,
    STORAGE_KEYS: STORAGE_KEYS,
    getBaseUrl: getBaseUrl,
    getToken: getToken,
    clearToken: clearToken,
    connect: connect,
    ensureToken: ensureToken,
    recordEat: recordEat,
    isConnected: isConnected
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.BTCI_LB = api;
  }
})(typeof self !== "undefined" ? self : this);
