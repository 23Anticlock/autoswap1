/**
 * AutoSwap — Binance Automation Server (Fixed for Render)
 * Uses better-sqlite3 replaced with @sqlite.org/sqlite-wasm (pure JS)
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const crypto = require("crypto");
const axios = require("axios");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("sqlite3").verbose();
const { WebSocketServer, WebSocket } = require("ws");
const path = require("path");

// ─── Config ───────────────────────────────────
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "change_me_in_production";
const BINANCE_BASE = process.env.BINANCE_BASE_URL || "https://api.binance.com";
const DB_PATH = process.env.DB_PATH || "./autoswap.db";

const ENC_KEY = crypto.createHash("sha256").update(JWT_SECRET).digest("hex").slice(0, 32);

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENC_KEY, iv);
  return iv.toString("hex") + ":" + cipher.update(text, "utf8", "hex") + cipher.final("hex");
}
function decrypt(text) {
  const [iv, enc] = text.split(":");
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENC_KEY, Buffer.from(iv, "hex"));
  return decipher.update(enc, "hex", "utf8") + decipher.final("utf8");
}

// ─── Database Setup ───────────────────────────
const db = new Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDb() {
  await run(`PRAGMA journal_mode=WAL`);
  await run(`PRAGMA foreign_keys=ON`);
  await run(`CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT,
    email      TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    role       TEXT NOT NULL DEFAULT 'buyer',
    status     TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`);
  await run(`CREATE TABLE IF NOT EXISTS api_keys (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER UNIQUE,
    api_key     TEXT NOT NULL,
    secret_key  TEXT NOT NULL,
    updated_at  INTEGER DEFAULT (strftime('%s','now'))
  )`);
  await run(`CREATE TABLE IF NOT EXISTS bot_config (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER UNIQUE,
    enabled         INTEGER DEFAULT 0,
    buy_rules       TEXT DEFAULT '[]',
    convert_target  TEXT DEFAULT 'usdt',
    convert_ratio   INTEGER DEFAULT 60,
    convert_timing  TEXT DEFAULT 'immediate',
    markup_pct      REAL DEFAULT 2.5,
    min_order       REAL DEFAULT 50,
    max_order       REAL DEFAULT 5000,
    fiat_currency   TEXT DEFAULT 'USD',
    p2p_auto        INTEGER DEFAULT 1,
    site_auto       INTEGER DEFAULT 1,
    payment_methods TEXT DEFAULT '["Bank Transfer"]',
    updated_at      INTEGER DEFAULT (strftime('%s','now'))
  )`);
  await run(`CREATE TABLE IF NOT EXISTS orders (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    buyer_id    INTEGER,
    coin        TEXT NOT NULL,
    amount      REAL NOT NULL,
    rate        REAL,
    method      TEXT,
    status      TEXT DEFAULT 'pending',
    created_at  INTEGER DEFAULT (strftime('%s','now'))
  )`);
  await run(`CREATE TABLE IF NOT EXISTS activity (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER,
    type        TEXT,
    description TEXT,
    amount      TEXT,
    price       TEXT,
    status      TEXT DEFAULT 'COMPLETED',
    created_at  INTEGER DEFAULT (strftime('%s','now'))
  )`);
  console.log("✓ Database initialized");
}

// ─── Express App ──────────────────────────────
const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000").split(",");
app.use(cors({
  origin: (o, cb) => cb(null, !o || allowedOrigins.some(a => o.startsWith(a.trim()))),
  credentials: true,
}));
app.use(express.json());

// ─── Health Check ─────────────────────────────
app.get("/api/health", (req, res) => res.json({ ok: true, ts: Date.now() }));

// ─── Auth Middleware ──────────────────────────
function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(h.replace("Bearer ", ""), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
function requireOwner(req, res, next) {
  if (req.user.role !== "owner") return res.status(403).json({ error: "Owner only" });
  next();
}

// ─── Binance Helpers ──────────────────────────
async function getKeys(userId) {
  const row = await get("SELECT api_key, secret_key FROM api_keys WHERE user_id = ?", [userId]);
  if (!row) throw new Error("No API keys configured");
  return { apiKey: decrypt(row.api_key), secretKey: decrypt(row.secret_key) };
}

function sign(query, secret) {
  return crypto.createHmac("sha256", secret).update(query).digest("hex");
}

async function binancePublic(p, params = {}) {
  const { data } = await axios.get(`${BINANCE_BASE}${p}`, { params });
  return data;
}

async function binanceSigned(method, p, params, userId) {
  const { apiKey, secretKey } = await getKeys(userId);
  const ts = Date.now();
  const query = new URLSearchParams({ ...params, timestamp: ts }).toString();
  const sig = sign(query, secretKey);
  const url = `${BINANCE_BASE}${p}?${query}&signature=${sig}`;
  const headers = { "X-MBX-APIKEY": apiKey };
  const { data } = method === "GET"
    ? await axios.get(url, { headers })
    : await axios.post(url, null, { headers });
  return data;
}

// ─── Auth Routes ──────────────────────────────
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role = "buyer" } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    const hash = await bcrypt.hash(password, 12);
    const status = role === "owner" ? "active" : "pending";
    const result = await run(
      "INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)",
      [name || "", email, hash, role, status]
    );
    const token = jwt.sign({ id: result.lastID, email, role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: result.lastID, name, email, role, status } });
  } catch (e) {
    if (e.message.includes("UNIQUE")) return res.status(409).json({ error: "Email already registered" });
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await get("SELECT * FROM users WHERE email = ?", [email]);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const user = await get("SELECT id, name, email, role, status FROM users WHERE id = ?", [req.user.id]);
  res.json(user);
});

// ─── API Key Routes ───────────────────────────
app.post("/api/keys", requireAuth, requireOwner, async (req, res) => {
  try {
    const { apiKey, secretKey } = req.body;
    if (!apiKey || !secretKey) return res.status(400).json({ error: "Both keys required" });
    await run(
      `INSERT INTO api_keys (user_id, api_key, secret_key) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET api_key=excluded.api_key, secret_key=excluded.secret_key`,
      [req.user.id, encrypt(apiKey), encrypt(secretKey)]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/keys/test", requireAuth, requireOwner, async (req, res) => {
  try {
    const data = await binanceSigned("GET", "/api/v3/account", {}, req.user.id);
    res.json({ success: true, canTrade: data.canTrade });
  } catch (e) {
    res.status(400).json({ success: false, error: e.response?.data?.msg || e.message });
  }
});

app.get("/api/keys/has", requireAuth, requireOwner, async (req, res) => {
  const row = await get("SELECT id FROM api_keys WHERE user_id = ?", [req.user.id]);
  res.json({ hasKeys: !!row });
});

// ─── Bot Config ───────────────────────────────
app.get("/api/config", requireAuth, requireOwner, async (req, res) => {
  let cfg = await get("SELECT * FROM bot_config WHERE user_id = ?", [req.user.id]);
  if (!cfg) {
    await run("INSERT INTO bot_config (user_id) VALUES (?)", [req.user.id]);
    cfg = await get("SELECT * FROM bot_config WHERE user_id = ?", [req.user.id]);
  }
  cfg.buy_rules = JSON.parse(cfg.buy_rules || "[]");
  cfg.payment_methods = JSON.parse(cfg.payment_methods || "[]");
  res.json(cfg);
});

app.put("/api/config", requireAuth, requireOwner, async (req, res) => {
  try {
    const { enabled, buy_rules, convert_target, convert_ratio, convert_timing,
      markup_pct, min_order, max_order, fiat_currency, p2p_auto, site_auto, payment_methods } = req.body;
    await run(`INSERT INTO bot_config (user_id, enabled, buy_rules, convert_target, convert_ratio,
      convert_timing, markup_pct, min_order, max_order, fiat_currency, p2p_auto, site_auto, payment_methods)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled, buy_rules=excluded.buy_rules,
      convert_target=excluded.convert_target, convert_ratio=excluded.convert_ratio,
      convert_timing=excluded.convert_timing, markup_pct=excluded.markup_pct,
      min_order=excluded.min_order, max_order=excluded.max_order, fiat_currency=excluded.fiat_currency,
      p2p_auto=excluded.p2p_auto, site_auto=excluded.site_auto, payment_methods=excluded.payment_methods`,
      [req.user.id, enabled ? 1 : 0, JSON.stringify(buy_rules || []), convert_target || "usdt",
       convert_ratio || 60, convert_timing || "immediate", markup_pct || 2.5, min_order || 50,
       max_order || 5000, fiat_currency || "USD", p2p_auto ? 1 : 0, site_auto ? 1 : 0,
       JSON.stringify(payment_methods || [])]);
    if (enabled) startBot(req.user.id);
    else stopBot(req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Price Routes ─────────────────────────────
app.get("/api/price/:symbol", async (req, res) => {
  try {
    const data = await binancePublic("/api/v3/ticker/price", { symbol: req.params.symbol + "USDT" });
    res.json(data);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/prices", async (req, res) => {
  try {
    const symbols = (req.query.coins || "BTC,ETH,SOL,BNB").split(",");
    const results = await Promise.all(
      symbols.map(s => binancePublic("/api/v3/ticker/price", { symbol: s + "USDT" }).catch(() => null))
    );
    const prices = {};
    results.forEach((r, i) => { if (r) prices[symbols[i]] = parseFloat(r.price); });
    res.json(prices);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ─── Balance ──────────────────────────────────
app.get("/api/balance", requireAuth, requireOwner, async (req, res) => {
  try {
    const data = await binanceSigned("GET", "/api/v3/account", {}, req.user.id);
    const balances = data.balances
      .map(b => ({ asset: b.asset, free: parseFloat(b.free), locked: parseFloat(b.locked) }))
      .filter(b => b.free + b.locked > 0);
    res.json({ balances });
  } catch (e) {
    res.status(400).json({ error: e.response?.data?.msg || e.message });
  }
});

// ─── Orders ───────────────────────────────────
app.post("/api/orders", requireAuth, async (req, res) => {
  try {
    const { coin, amount, method } = req.body;
    const cfg = await get("SELECT markup_pct FROM bot_config LIMIT 1");
    const rate = cfg ? (1 + (cfg.markup_pct || 2.5) / 100) : 1.025;
    const result = await run(
      "INSERT INTO orders (buyer_id, coin, amount, rate, method) VALUES (?, ?, ?, ?, ?)",
      [req.user.id, coin, amount, rate, method || "Bank Transfer"]
    );
    await logActivity(null, "SELL", `New order: ${amount} ${coin}`, `${amount} ${coin}`, `from @${req.user.email}`, "PENDING");
    res.json({ success: true, orderId: result.lastID, rate });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/orders", requireAuth, async (req, res) => {
  const orders = req.user.role === "owner"
    ? await all("SELECT o.*, u.name as buyer_name, u.email as buyer_email FROM orders o LEFT JOIN users u ON o.buyer_id = u.id ORDER BY o.created_at DESC")
    : await all("SELECT * FROM orders WHERE buyer_id = ? ORDER BY created_at DESC", [req.user.id]);
  res.json({ orders });
});

app.put("/api/orders/:id/status", requireAuth, requireOwner, async (req, res) => {
  await run("UPDATE orders SET status = ? WHERE id = ?", [req.body.status, req.params.id]);
  res.json({ success: true });
});

app.put("/api/orders/:id/paid", requireAuth, async (req, res) => {
  try {
    const order = await get("SELECT * FROM orders WHERE id = ? AND buyer_id = ?", [req.params.id, req.user.id]);
    if (!order) return res.status(404).json({ error: "Order not found" });
    await run("UPDATE orders SET status = 'paid' WHERE id = ?", [order.id]);
    const cfg = await get("SELECT site_auto FROM bot_config LIMIT 1");
    if (cfg?.site_auto) {
      await run("UPDATE orders SET status = 'released' WHERE id = ?", [order.id]);
      await logActivity(null, "SELL", `Auto-released ${order.coin}`, `${order.amount} ${order.coin}`, `to @${req.user.email}`, "COMPLETED");
    }
    res.json({ success: true, autoReleased: !!cfg?.site_auto });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Users ────────────────────────────────────
app.get("/api/users", requireAuth, requireOwner, async (req, res) => {
  const users = await all("SELECT id, name, email, role, status, created_at FROM users WHERE role = 'buyer' ORDER BY created_at DESC");
  const withVolume = await Promise.all(users.map(async u => {
    const vol = await get("SELECT COALESCE(SUM(amount), 0) as total FROM orders WHERE buyer_id = ? AND status='released'", [u.id]);
    return { ...u, volume: vol.total };
  }));
  res.json({ users: withVolume });
});

app.put("/api/users/:id/status", requireAuth, requireOwner, async (req, res) => {
  await run("UPDATE users SET status = ? WHERE id = ?", [req.body.status, req.params.id]);
  res.json({ success: true });
});

// ─── Activity ─────────────────────────────────
async function logActivity(userId, type, description, amount, price, status) {
  await run("INSERT INTO activity (user_id, type, description, amount, price, status) VALUES (?, ?, ?, ?, ?, ?)",
    [userId, type, description, amount, price, status]);
  broadcastActivity({ type, description, amount, price, status, time: new Date().toLocaleTimeString() });
}

app.get("/api/activity", requireAuth, requireOwner, async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const rows = await all("SELECT * FROM activity ORDER BY created_at DESC LIMIT ?", [limit]);
  res.json({ activity: rows });
});

// ─── Stats ────────────────────────────────────
app.get("/api/stats", requireAuth, requireOwner, async (req, res) => {
  const todayStart = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
  const buysToday = (await get("SELECT COUNT(*) as c FROM activity WHERE type='BUY' AND created_at > ?", [todayStart])).c;
  const convertsToday = (await get("SELECT COUNT(*) as c FROM activity WHERE type='CONVERT' AND created_at > ?", [todayStart])).c;
  const salesPending = (await get("SELECT COUNT(*) as c FROM orders WHERE status='pending'")).c;
  const salesTotal = (await get("SELECT COUNT(*) as c FROM orders WHERE status='released'")).c;
  const activeUsers = (await get("SELECT COUNT(*) as c FROM users WHERE role='buyer' AND status='active'")).c;
  const pendingUsers = (await get("SELECT COUNT(*) as c FROM users WHERE role='buyer' AND status='pending'")).c;
  res.json({ buysToday, convertsToday, salesPending, salesTotal, activeUsers, pendingUsers });
});

// ─── Trade Routes ─────────────────────────────
app.post("/api/trade/buy", requireAuth, requireOwner, async (req, res) => {
  try {
    const { symbol, quoteQty } = req.body;
    const order = await binanceSigned("POST", "/api/v3/order",
      { symbol, side: "BUY", type: "MARKET", quoteOrderQty: quoteQty }, req.user.id);
    await logActivity(req.user.id, "BUY", `Bought ${symbol}`,
      order.executedQty + " " + symbol.replace("USDT", ""),
      `@ $${parseFloat(order.fills?.[0]?.price || 0).toFixed(2)}`, "COMPLETED");
    res.json({ success: true, order });
  } catch (e) {
    res.status(400).json({ error: e.response?.data?.msg || e.message });
  }
});

// ─── Bot Toggle ───────────────────────────────
app.post("/api/bot/start", requireAuth, requireOwner, async (req, res) => {
  await run("UPDATE bot_config SET enabled = 1 WHERE user_id = ?", [req.user.id]);
  startBot(req.user.id);
  res.json({ running: true });
});

app.post("/api/bot/stop", requireAuth, requireOwner, async (req, res) => {
  await run("UPDATE bot_config SET enabled = 0 WHERE user_id = ?", [req.user.id]);
  stopBot(req.user.id);
  res.json({ running: false });
});

app.get("/api/bot/status", requireAuth, requireOwner, (req, res) => {
  res.json({ running: botIntervals.has(req.user.id) });
});

// ─── Bot Engine ───────────────────────────────
const botIntervals = new Map();

async function runBotCycle(userId) {
  try {
    const cfg = await get("SELECT * FROM bot_config WHERE user_id = ?", [userId]);
    if (!cfg || !cfg.enabled) return;
    const rules = JSON.parse(cfg.buy_rules || "[]").filter(r => r.enabled);
    if (!rules.length) return;
    const coins = [...new Set(rules.map(r => r.coin))];
    const results = await Promise.all(
      coins.map(c => binancePublic("/api/v3/ticker/price", { symbol: c + "USDT" }).catch(() => null))
    );
    const priceMap = {};
    results.forEach((r, i) => { if (r) priceMap[coins[i]] = parseFloat(r.price); });
    for (const rule of rules) {
      const price = priceMap[rule.coin];
      if (!price) continue;
      if (price >= parseFloat(rule.minPrice) && price <= parseFloat(rule.maxPrice)) {
        try {
          const order = await binanceSigned("POST", "/api/v3/order",
            { symbol: rule.coin + "USDT", side: "BUY", type: "MARKET", quoteOrderQty: parseFloat(rule.amount) }, userId);
          const qty = parseFloat(order.executedQty);
          await logActivity(userId, "BUY", `Auto-bought ${rule.coin}`, `${qty} ${rule.coin}`,
            `@ $${price.toFixed(2)}`, "COMPLETED");
          if (cfg.convert_timing === "immediate") await autoConvert(userId, cfg, rule.coin, qty);
        } catch (err) {
          await logActivity(userId, "BUY", `Buy failed: ${rule.coin}`, `$${rule.amount}`,
            err.response?.data?.msg || err.message, "FAILED");
        }
      }
    }
  } catch (e) {
    console.error("[BOT] Cycle error:", e.message);
  }
}

async function autoConvert(userId, cfg, fromAsset, amount) {
  const targets = cfg.convert_target === "both"
    ? [{ asset: "USDT", pct: cfg.convert_ratio / 100 }, { asset: "USDC", pct: 1 - cfg.convert_ratio / 100 }]
    : [{ asset: cfg.convert_target.toUpperCase(), pct: 1 }];
  for (const t of targets) {
    const portion = (amount * t.pct).toFixed(6);
    if (parseFloat(portion) <= 0) continue;
    try {
      const quote = await binanceSigned("POST", "/sapi/v1/convert/getQuote",
        { fromAsset, toAsset: t.asset, fromAmount: portion, walletType: "SPOT" }, userId);
      const result = await binanceSigned("POST", "/sapi/v1/convert/acceptQuote",
        { quoteId: quote.quoteId }, userId);
      await logActivity(userId, "CONVERT", `Converted ${fromAsset}→${t.asset}`,
        `${portion} ${fromAsset}`, `→ ${result.toAmount || "?"} ${t.asset}`, "COMPLETED");
    } catch (e) {
      await logActivity(userId, "CONVERT", `Convert failed ${fromAsset}→${t.asset}`,
        portion + " " + fromAsset, e.response?.data?.msg || e.message, "FAILED");
    }
  }
}

function startBot(userId) {
  stopBot(userId);
  const interval = setInterval(() => runBotCycle(userId), 15000);
  botIntervals.set(userId, interval);
  runBotCycle(userId);
  console.log(`[BOT] Started for user ${userId}`);
}

function stopBot(userId) {
  if (botIntervals.has(userId)) {
    clearInterval(botIntervals.get(userId));
    botIntervals.delete(userId);
    console.log(`[BOT] Stopped for user ${userId}`);
  }
}

// ─── WebSocket ────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
const clients = new Set();

wss.on("connection", (ws, req) => {
  const token = new URL(req.url, "http://localhost").searchParams.get("token");
  if (!token) { ws.close(); return; }
  try {
    ws.user = jwt.verify(token, JWT_SECRET);
    clients.add(ws);
    ws.send(JSON.stringify({ type: "connected" }));
    ws.on("close", () => clients.delete(ws));
  } catch { ws.close(); }
});

function broadcastActivity(data) {
  const msg = JSON.stringify({ type: "activity", data });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

// ─── Start ────────────────────────────────────
async function start() {
  await initDb();
  const bots = await all("SELECT user_id FROM bot_config WHERE enabled = 1");
  for (const row of bots) {
    const hasKeys = await get("SELECT id FROM api_keys WHERE user_id = ?", [row.user_id]);
    if (hasKeys) startBot(row.user_id);
  }
  server.listen(PORT, () => {
    console.log(`✓ AutoSwap running on port ${PORT}`);
    console.log(`✓ WebSocket at ws://localhost:${PORT}/ws`);
  });
}

start().catch(console.error);
