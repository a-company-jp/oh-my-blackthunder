#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");

const root = path.resolve(__dirname, "..", "..");
const cacheDir = process.env.OMB_AI_BLACKTHUNDER_CACHE_DIR
  || path.join(process.env.OMB_CACHE_DIR || path.join(root, "cache"), "ai-blackthunder");
const codexHome = process.env.OMB_CODEX_HOME
  || process.env.CODEX_HOME
  || path.join(os.homedir(), ".codex");
const sessionDir = process.env.OMB_CODEX_SESSION_DIR
  || path.join(codexHome, "sessions");
const pricingFile = process.env.OMB_CODEX_PRICING_FILE
  || path.join(root, "plugins", "ai-blackthunder", "pricing", "codex.tsv");
const defaultModel = process.env.OMB_CODEX_DEFAULT_MODEL || "gpt-5.5";
const priceJpy = Number.parseFloat(process.env.OMB_BLACKTHUNDER_PRICE_JPY || "43");
const usdJpy = Number.parseFloat(process.env.OMB_USD_JPY || "160");
const retentionSeconds = Number.parseInt(
  process.env.OMB_AI_BLACKTHUNDER_EVENT_RETENTION_SECONDS
    || process.env.OMB_AI_BLACKTHUNDER_WINDOW_SECONDS
    || "18000",
  10
);
const scanIntervalMs = Math.max(
  1000,
  Number.parseFloat(process.env.OMB_CODEX_SESSION_SCAN_INTERVAL_SECONDS || "3") * 1000
);
const staleStateSeconds = Number.parseInt(process.env.OMB_CODEX_SESSION_STATE_TTL_SECONDS || "604800", 10);

const eventsDir = path.join(cacheDir, "events");
const eventFile = path.join(eventsDir, "Codex.tsv");
const legacyFile = path.join(cacheDir, "last.tsv");
const stateFile = process.env.OMB_CODEX_SESSION_STATE_FILE
  || path.join(cacheDir, "codex-session-state.json");
const lockDir = process.env.OMB_CODEX_SESSION_LOCK_DIR
  || path.join(cacheDir, "codex-session.lock");
const lockWaitMs = Math.max(0, Number.parseInt(process.env.OMB_CODEX_SESSION_LOCK_WAIT_MS || "2000", 10));
const lockStaleMs = Math.max(1000, Number.parseInt(process.env.OMB_CODEX_SESSION_LOCK_STALE_MS || "300000", 10));
const lockTouchIntervalMs = Math.max(
  100,
  Number.parseInt(process.env.OMB_CODEX_SESSION_LOCK_TOUCH_INTERVAL_MS || "1000", 10)
);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function formatBars(value) {
  if (value > 0 && value < 0.05) {
    return "0.1";
  }
  if (value >= 10) {
    return String(Math.round(value));
  }
  return value.toFixed(1);
}

function loadPricing() {
  const fallback = {
    "gpt-5.5": { input: 5.00, cached: 0.50, output: 30.00 },
    "gpt-5.4": { input: 2.50, cached: 0.25, output: 15.00 },
    "gpt-5.4-mini": { input: 0.75, cached: 0.075, output: 4.50 },
  };

  if (!fs.existsSync(pricingFile)) {
    return fallback;
  }

  const table = { ...fallback };
  const lines = fs.readFileSync(pricingFile, "utf8").split(/\r?\n/);
  for (const line of lines.slice(1)) {
    if (!line.trim() || line.trim().startsWith("#")) {
      continue;
    }

    const [model, input, cached, output] = line.split(/\t+/);
    if (!model || !input || !cached || !output) {
      continue;
    }

    table[model.toLowerCase()] = {
      input: Number.parseFloat(input),
      cached: Number.parseFloat(cached),
      output: Number.parseFloat(output),
    };
  }

  return table;
}

const pricing = loadPricing();

function resolvePricing(model) {
  const key = String(model || defaultModel).toLowerCase();
  if (pricing[key]) {
    return pricing[key];
  }

  const matched = Object.keys(pricing)
    .filter((candidate) => key.startsWith(candidate))
    .sort((a, b) => b.length - a.length)[0];

  return pricing[matched] || pricing[defaultModel] || pricing["gpt-5.5"];
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch {
    return { version: 1, files: {} };
  }
}

function saveState(state) {
  ensureDir(cacheDir);
  const tmpFile = `${stateFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmpFile, `${JSON.stringify(state, null, 2)}\n`);
  fs.renameSync(tmpFile, stateFile);
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function processToken(prefix) {
  return `${prefix}-${process.pid}-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
}

function lockOwnerPath() {
  return path.join(lockDir, "owner.json");
}

function lockReaperPath() {
  return path.join(lockDir, "reaper.json");
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function readLockOwner() {
  return readJsonFile(lockOwnerPath());
}

function readLockReaper() {
  return readJsonFile(lockReaperPath());
}

function forceRemoveLock() {
  fs.rmSync(lockDir, { recursive: true, force: true });
}

function releaseReaper(token) {
  const reaper = readLockReaper();
  if (!reaper || reaper.token !== token) {
    return false;
  }

  try {
    fs.unlinkSync(lockReaperPath());
  } catch {
    return false;
  }

  return true;
}

function removeLockForOwner(expectedOwnerToken, reason) {
  const reaperToken = processToken("reaper");
  let removed = false;

  try {
    fs.writeFileSync(
      lockReaperPath(),
      `${JSON.stringify({
        pid: process.pid,
        token: reaperToken,
        ownerToken: expectedOwnerToken || null,
        reason,
        createdAt: new Date().toISOString(),
      })}\n`,
      { flag: "wx" }
    );
  } catch {
    return false;
  }

  try {
    const owner = readLockOwner();
    const currentOwnerToken = owner && owner.token ? owner.token : null;
    if (currentOwnerToken !== (expectedOwnerToken || null)) {
      return false;
    }

    forceRemoveLock();
    removed = true;
    return true;
  } finally {
    if (!removed) {
      releaseReaper(reaperToken);
    }
  }
}

function releaseLock(token) {
  return removeLockForOwner(token, "release");
}

function reclaimStaleLock() {
  let stat;
  try {
    stat = fs.statSync(lockDir);
  } catch {
    return false;
  }

  if (Date.now() - stat.mtimeMs <= lockStaleMs) {
    return false;
  }

  const owner = readLockOwner();
  const ownerToken = owner && owner.token ? owner.token : null;
  return removeLockForOwner(ownerToken, "stale");
}

function touchLock(token) {
  try {
    const owner = readLockOwner();
    if (!owner || owner.token !== token) {
      return false;
    }

    const now = new Date();
    fs.utimesSync(lockDir, now, now);
    fs.writeFileSync(lockOwnerPath(), `${JSON.stringify({ ...owner, touchedAt: now.toISOString() })}\n`);
    return true;
  } catch {
    return false;
  }
}

function acquireLock() {
  ensureDir(cacheDir);
  const startedAt = Date.now();
  const token = processToken("owner");

  while (Date.now() - startedAt <= lockWaitMs) {
    try {
      fs.mkdirSync(lockDir);
      fs.writeFileSync(
        lockOwnerPath(),
        `${JSON.stringify({ pid: process.pid, token, createdAt: new Date().toISOString() })}\n`
      );
      return token;
    } catch (error) {
      if (error && error.code !== "EEXIST") {
        throw error;
      }

      if (reclaimStaleLock()) {
        continue;
      }

      sleepMs(50);
    }
  }

  return false;
}

function withLock(callback) {
  const token = acquireLock();
  if (!token) {
    return { events: 0, locked: false };
  }

  try {
    return callback(token);
  } finally {
    releaseLock(token);
  }
}

function fileKey(filePath) {
  return crypto.createHash("sha256").update(path.resolve(filePath)).digest("hex");
}

function listJsonlFiles(dir, result = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      listJsonlFiles(entryPath, result);
    } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      result.push(entryPath);
    }
  }

  return result;
}

function numberFrom(value) {
  const number = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function normalizeUsage(usage) {
  if (!usage || typeof usage !== "object") {
    return null;
  }

  return {
    input: numberFrom(usage.input_tokens ?? usage.inputTokens),
    cached: numberFrom(usage.cached_input_tokens ?? usage.cachedInputTokens),
    output: numberFrom(usage.output_tokens ?? usage.outputTokens),
    reasoning: numberFrom(usage.reasoning_output_tokens ?? usage.reasoningOutputTokens),
    total: numberFrom(usage.total_tokens ?? usage.totalTokens),
  };
}

function diffUsage(current, previous, useZeroBaseline = false) {
  if (!current) {
    return null;
  }

  previous = previous || (useZeroBaseline
    ? { input: 0, cached: 0, output: 0, reasoning: 0, total: 0 }
    : null);

  if (!previous) {
    return null;
  }

  const diff = {
    input: Math.max(current.input - (previous.input || 0), 0),
    cached: Math.max(current.cached - (previous.cached || 0), 0),
    output: Math.max(current.output - (previous.output || 0), 0),
    reasoning: Math.max(current.reasoning - (previous.reasoning || 0), 0),
    total: Math.max(current.total - (previous.total || 0), 0),
  };

  return diff.input > 0 || diff.output > 0 || diff.reasoning > 0 ? diff : null;
}

function walk(value, visit, seen = new Set()) {
  if (value == null) {
    return;
  }

  if (typeof value !== "object") {
    visit(value);
    return;
  }

  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      walk(item, visit, seen);
    }
    return;
  }

  visit(value);
  for (const child of Object.values(value)) {
    walk(child, visit, seen);
  }
}

function findModel(value) {
  const candidates = [];
  walk(value, (child) => {
    if (typeof child === "string" && /^gpt-[a-z0-9.-]+$/i.test(child)) {
      candidates.push(child);
    }
  });

  return candidates[0] || null;
}

function findTokenCountPayload(value) {
  let found = null;
  walk(value, (child) => {
    if (found || !child || typeof child !== "object") {
      return;
    }
    if (child.type === "token_count") {
      found = child;
    }
  });
  return found;
}

function timestampSeconds(record) {
  const raw = record && (record.timestamp || record.time || record.created_at);
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw > 10_000_000_000 ? Math.floor(raw / 1000) : Math.floor(raw);
  }

  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed / 1000);
    }
  }

  return Math.floor(Date.now() / 1000);
}

function usageToBars(usage, model) {
  const price = resolvePricing(model);
  const input = Math.max(usage.input || 0, 0);
  const cached = Math.min(Math.max(usage.cached || 0, 0), input);
  const fresh = Math.max(input - cached, 0);
  const output = Math.max(usage.output || usage.reasoning || 0, 0);

  const costUsd = (fresh / 1_000_000) * price.input
    + (cached / 1_000_000) * price.cached
    + (output / 1_000_000) * price.output;

  if (!Number.isFinite(costUsd) || costUsd <= 0 || priceJpy <= 0 || usdJpy <= 0) {
    return null;
  }

  return (costUsd * usdJpy) / priceJpy;
}

function pruneEvents(now) {
  if (!Number.isFinite(retentionSeconds) || retentionSeconds <= 0 || !fs.existsSync(eventFile)) {
    return;
  }

  const cutoff = now - retentionSeconds;
  const retained = fs.readFileSync(eventFile, "utf8")
    .split(/\r?\n/)
    .filter((line) => {
      if (!line.trim()) {
        return false;
      }
      const [time] = line.split("\t");
      return Number.parseInt(time, 10) >= cutoff;
    });
  fs.writeFileSync(eventFile, retained.length ? `${retained.join("\n")}\n` : "");
}

function eventId(fileKeyValue, lineOffset, timestamp, model, usage) {
  return crypto.createHash("sha256")
    .update(JSON.stringify({
      file: fileKeyValue,
      offset: lineOffset,
      timestamp,
      model,
      input: usage.input || 0,
      cached: usage.cached || 0,
      output: usage.output || 0,
      reasoning: usage.reasoning || 0,
    }))
    .digest("hex");
}

function readExistingEventIds() {
  const ids = new Set();
  if (!fs.existsSync(eventFile)) {
    return ids;
  }

  const lines = fs.readFileSync(eventFile, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const fields = line.split("\t");
    if (fields[2]) {
      ids.add(fields[2]);
    }
  }

  return ids;
}

function flushCodexEvents(events) {
  if (!events.length) {
    return 0;
  }

  ensureDir(eventsDir);
  ensureDir(cacheDir);

  const existingIds = readExistingEventIds();
  const newEvents = [];

  for (const event of events) {
    if (existingIds.has(event.id)) {
      continue;
    }
    existingIds.add(event.id);
    newEvents.push(event);
  }

  if (!newEvents.length) {
    return 0;
  }

  const rows = newEvents
    .map((event) => `${event.timestamp}\t${event.bars.toFixed(6)}\t${event.id}`)
    .join("\n");
  const lastEvent = newEvents[newEvents.length - 1];

  fs.appendFileSync(eventFile, `${rows}\n`);
  fs.writeFileSync(legacyFile, `${lastEvent.timestamp}\tCodex\t${formatBars(lastEvent.bars)}\n`);
  pruneEvents(Math.floor(Date.now() / 1000));
  return newEvents.length;
}

function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function handleLine(line, fileState, counters, lineContext) {
  if (line.includes('"turn_context"') || line.includes('"session_configured"')) {
    const record = parseJsonLine(line);
    const model = record ? findModel(record) : null;
    if (model) {
      fileState.model = model;
    }
  }

  if (!line.includes('"token_count"')) {
    return;
  }

  const record = parseJsonLine(line);
  if (!record) {
    return;
  }

  const payload = findTokenCountPayload(record);
  if (!payload) {
    return;
  }

  const info = payload.info || payload;
  const lastUsage = normalizeUsage(info.last_token_usage || payload.last_token_usage);
  const totalUsage = normalizeUsage(info.total_token_usage || payload.total_token_usage);
  const usage = lastUsage || diffUsage(totalUsage, fileState.lastTotalUsage, fileState.offset === 0);

  if (totalUsage) {
    fileState.lastTotalUsage = totalUsage;
  }

  if (!usage || ((usage.input || 0) <= 0 && (usage.output || 0) <= 0 && (usage.reasoning || 0) <= 0)) {
    return;
  }

  const timestamp = timestampSeconds(record);
  const now = Math.floor(Date.now() / 1000);
  if (Number.isFinite(retentionSeconds) && retentionSeconds > 0 && timestamp < now - retentionSeconds) {
    return;
  }

  const model = fileState.model || findModel(record) || defaultModel;
  const bars = usageToBars(usage, model);
  if (!bars) {
    return;
  }

  counters.pendingEvents.push({
    id: eventId(lineContext.fileKeyValue, lineContext.lineOffset, timestamp, model, usage),
    timestamp,
    bars,
  });
}

function heartbeat(counters, lockToken, force = false) {
  if (!lockToken) {
    return true;
  }

  const now = Date.now();
  if (!force && counters.lockTouchedAt && now - counters.lockTouchedAt < lockTouchIntervalMs) {
    return true;
  }

  if (!touchLock(lockToken)) {
    counters.lockLost = true;
    return false;
  }

  counters.lockTouchedAt = now;
  return true;
}

function scanFile(filePath, state, counters, lockToken) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const key = fileKey(filePath);
  const fileState = state.files[key] || { offset: 0 };

  if (
    !state.files[key]
    && Number.isFinite(retentionSeconds)
    && retentionSeconds > 0
    && stat.mtimeMs < (now - retentionSeconds) * 1000
  ) {
    return;
  }

  if (fileState.offset > stat.size) {
    fileState.offset = 0;
    fileState.lastTotalUsage = null;
  }

  if (fileState.offset === stat.size) {
    fileState.lastSeenAt = now;
    state.files[key] = fileState;
    return;
  }

  let buffer;
  try {
    const fd = fs.openSync(filePath, "r");
    buffer = Buffer.alloc(stat.size - fileState.offset);
    fs.readSync(fd, buffer, 0, buffer.length, fileState.offset);
    fs.closeSync(fd);
  } catch {
    return;
  }

  const chunk = buffer.toString("utf8");
  const lastBreak = chunk.lastIndexOf("\n");
  if (lastBreak === -1) {
    state.files[key] = { ...fileState, lastSeenAt: now };
    return;
  }

  const complete = chunk.slice(0, lastBreak + 1);
  const rawLines = complete.match(/[^\n]*\n/g) || [];
  let lineOffset = fileState.offset;
  for (const rawLine of rawLines) {
    let line = rawLine.slice(0, -1);
    if (line.endsWith("\r")) {
      line = line.slice(0, -1);
    }

    if (line) {
      handleLine(line, fileState, counters, {
        fileKeyValue: key,
        lineOffset,
      });
    }
    if (!heartbeat(counters, lockToken)) {
      return;
    }
    lineOffset += Buffer.byteLength(rawLine, "utf8");
  }

  fileState.offset += Buffer.byteLength(complete, "utf8");
  fileState.lastSeenAt = now;
  state.files[key] = fileState;
}

function pruneState(state) {
  if (!Number.isFinite(staleStateSeconds) || staleStateSeconds <= 0) {
    return;
  }

  const cutoff = Math.floor(Date.now() / 1000) - staleStateSeconds;
  for (const [key, fileState] of Object.entries(state.files || {})) {
    if ((fileState.lastSeenAt || 0) < cutoff) {
      delete state.files[key];
    }
  }
}

function scanOnceUnlocked(state, lockToken) {
  const counters = {
    events: 0,
    lockLost: false,
    lockTouchedAt: 0,
    pendingEvents: [],
  };
  const files = listJsonlFiles(sessionDir)
    .sort((a, b) => {
      try {
        return fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs;
      } catch {
        return 0;
      }
    });

  for (const filePath of files) {
    if (!heartbeat(counters, lockToken, true)) {
      return counters;
    }
    scanFile(filePath, state, counters, lockToken);
    if (counters.lockLost) {
      return counters;
    }
  }

  if (!heartbeat(counters, lockToken, true)) {
    return counters;
  }

  pruneState(state);
  counters.events = flushCodexEvents(counters.pendingEvents);
  if (!heartbeat(counters, lockToken, true)) {
    return counters;
  }
  saveState(state);
  pruneEvents(Math.floor(Date.now() / 1000));
  return counters;
}

function scanOnce() {
  return withLock((lockToken) => {
    const state = loadState();
    return scanOnceUnlocked(state, lockToken);
  });
}

function main() {
  ensureDir(cacheDir);

  if (process.argv.includes("--scan-once")) {
    const counters = scanOnce();
    process.stdout.write(`${counters.events}\n`);
    return;
  }

  scanOnce();
  setInterval(() => {
    try {
      scanOnce();
    } catch (error) {
      process.stderr.write(`omb-codex-session: ${error.message}\n`);
    }
  }, scanIntervalMs);
}

main();
