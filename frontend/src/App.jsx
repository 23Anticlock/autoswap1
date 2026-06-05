import { useState, useEffect, useRef, useCallback } from "react";

// ─── API Base ─────────────────────────────────
// Dev: empty string (proxied via CRA to localhost:4000)
// Production: set REACT_APP_API_URL to your Render backend URL
const API = process.env.REACT_APP_API_URL || "";

async function apiFetch(path, opts = {}, token) {
  const res = await fetch(API + path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ─── Theme ────────────────────────────────────
const C = {
  bg: "#07090f", surface: "#0d1120", card: "#111827", border: "#1a2540",
  accent: "#f0b90b", accentDim: "#f0b90b18", green: "#0ecb81", greenDim: "#0ecb8118",
  red: "#f6465d", redDim: "#f6465d18", blue: "#3b82f6", blueDim: "#3b82f618",
  text: "#e2e8f4", muted: "#4a5a7a", mutedLight: "#7a8eae",
};

// ─── UI Atoms ─────────────────────────────────
const Tag = ({ c = C.accent, children }) => (
  <span style={{ background: c + "22", color: c, border: `1px solid ${c}33`, borderRadius: 3, padding: "2px 7px", fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>{children}</span>
);

const Pill = ({ active, onClick, children, small }) => (
  <button onClick={onClick} style={{ background: active ? C.accent : "transparent", color: active ? "#000" : C.mutedLight, border: `1px solid ${active ? C.accent : C.border}`, borderRadius: 4, padding: small ? "4px 10px" : "7px 16px", fontSize: small ? 11 : 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all .15s" }}>{children}</button>
);

const Btn = ({ onClick, children, variant = "primary", sm, disabled, loading, full }) => {
  const v = { primary: { bg: C.accent, c: "#000" }, danger: { bg: C.red, c: "#fff" }, ghost: { bg: "transparent", c: C.mutedLight, border: `1px solid ${C.border}` }, success: { bg: C.green, c: "#000" } }[variant];
  return (
    <button onClick={disabled || loading ? undefined : onClick} style={{ background: v.bg, color: v.c, border: v.border || "none", borderRadius: 5, fontFamily: "inherit", fontWeight: 700, fontSize: sm ? 11 : 13, padding: sm ? "5px 12px" : "10px 20px", cursor: disabled || loading ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1, transition: "opacity .15s, transform .1s", width: full ? "100%" : undefined, letterSpacing: 0.3 }}>
      {loading ? "..." : children}
    </button>
  );
};

const Input = ({ label, value, onChange, placeholder, type = "text", suffix, error, disabled }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    {label && <label style={{ color: C.muted, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>{label}</label>}
    <div style={{ display: "flex", alignItems: "center", background: C.surface, border: `1px solid ${error ? C.red : C.border}`, borderRadius: 6 }}>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, padding: "9px 12px", fontFamily: "inherit", fontSize: 13 }} />
      {suffix && <span style={{ padding: "0 12px", color: C.muted, fontSize: 12 }}>{suffix}</span>}
    </div>
    {error && <span style={{ color: C.red, fontSize: 11 }}>{error}</span>}
  </div>
);

const Select = ({ label, value, onChange, options }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    {label && <label style={{ color: C.muted, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>{label}</label>}
    <select value={value} onChange={e => onChange(e.target.value)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, padding: "9px 12px", fontFamily: "inherit", fontSize: 13, outline: "none", cursor: "pointer" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const Toggle = ({ value, onChange, label }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    {label && <span style={{ color: C.mutedLight, fontSize: 13 }}>{label}</span>}
    <div onClick={() => onChange(!value)} style={{ width: 38, height: 20, borderRadius: 10, background: value ? C.green : C.border, cursor: "pointer", position: "relative", transition: "background .2s" }}>
      <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: value ? 21 : 3, transition: "left .2s" }} />
    </div>
  </div>
);

const Card = ({ children, s = {}, glow }) => (
  <div style={{ background: C.card, border: `1px solid ${glow ? C.accent + "44" : C.border}`, borderRadius: 10, padding: 20, boxShadow: glow ? `0 0 30px ${C.accent}18` : "none", ...s }}>{children}</div>
);

const Stat = ({ label, value, sub, c = C.accent }) => (
  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 18px" }}>
    <div style={{ color: C.muted, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
    <div style={{ color: c, fontSize: 20, fontWeight: 800 }}>{value}</div>
    {sub && <div style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>{sub}</div>}
  </div>
);

const Divider = ({ label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0" }}>
    <div style={{ flex: 1, height: 1, background: C.border }} />
    {label && <span style={{ color: C.muted, fontSize: 10, letterSpacing: 1 }}>{label}</span>}
    <div style={{ flex: 1, height: 1, background: C.border }} />
  </div>
);

const Alert = ({ type, children }) => {
  const cl = { success: C.green, error: C.red, info: C.blue, warn: C.accent }[type] || C.mutedLight;
  return <div style={{ background: cl + "18", border: `1px solid ${cl}33`, borderRadius: 7, padding: "11px 14px", color: cl, fontSize: 12, lineHeight: 1.7 }}>{children}</div>;
};

// ─── Auth Screen ──────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "owner" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const set = k => v => setForm(f => ({ ...f, [k]: v }));

  async function submit() {
    setErr(""); setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const data = await apiFetch(endpoint, { method: "POST", body: form });
      localStorage.setItem("token", data.token);
      onAuth(data.user, data.token);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'IBM Plex Mono', monospace" }}>
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{ fontSize: 30, fontWeight: 900, color: C.accent, letterSpacing: -1 }}>◈ AUTOSWAP</div>
        <div style={{ color: C.muted, fontSize: 10, letterSpacing: 3, marginTop: 5 }}>BINANCE AUTOMATION ENGINE</div>
      </div>
      <Card s={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
          <Pill active={mode === "login"} onClick={() => { setMode("login"); setErr(""); }}>Login</Pill>
          <Pill active={mode === "register"} onClick={() => { setMode("register"); setErr(""); }}>Register</Pill>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          {mode === "register" && <Input label="Full Name" value={form.name} onChange={set("name")} placeholder="Your name" />}
          <Input label="Email" type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" />
          <Input label="Password" type="password" value={form.password} onChange={set("password")} placeholder="••••••••" />
          {mode === "register" && (
            <Select label="Account Type" value={form.role} onChange={set("role")} options={[
              { value: "owner", label: "Platform Owner — sell crypto" },
              { value: "buyer", label: "Buyer — purchase crypto" },
            ]} />
          )}
          {err && <Alert type="error">{err}</Alert>}
          <Btn onClick={submit} loading={loading} full>{mode === "login" ? "Sign In" : "Create Account"}</Btn>
        </div>
      </Card>
      <div style={{ color: C.muted, fontSize: 10, letterSpacing: 1, marginTop: 18 }}>BACKEND: localhost:4000</div>
    </div>
  );
}

// ─── Owner App ────────────────────────────────
function OwnerApp({ user, token, onLogout }) {
  const [tab, setTab] = useState("dashboard");
  const [botRunning, setBotRunning] = useState(false);
  const [liveActivity, setLiveActivity] = useState([]);
  const wsRef = useRef(null);

  // WebSocket live feed
  useEffect(() => {
    const wsBase = (process.env.REACT_APP_API_URL || "http://localhost:4000")
      .replace("https://", "wss://")
      .replace("http://", "ws://");
    const ws = new WebSocket(`${wsBase}/ws?token=${token}`);
    wsRef.current = ws;
    ws.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.type === "activity") setLiveActivity(prev => [msg.data, ...prev].slice(0, 50));
    };
    return () => ws.close();
  }, [token]);

  // Fetch bot status
  useEffect(() => {
    apiFetch("/api/bot/status", {}, token).then(d => setBotRunning(d.running)).catch(() => {});
  }, [token]);

  async function toggleBot() {
    try {
      const path = botRunning ? "/api/bot/stop" : "/api/bot/start";
      await apiFetch(path, { method: "POST" }, token);
      setBotRunning(!botRunning);
    } catch (e) { alert(e.message); }
  }

  const TABS = [
    { id: "dashboard", label: "Dashboard" },
    { id: "api", label: "Binance API" },
    { id: "autobuy", label: "Auto-Buy" },
    { id: "convert", label: "Auto-Convert" },
    { id: "sell", label: "Sell Config" },
    { id: "users", label: "Users" },
    { id: "activity", label: "Activity" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'IBM Plex Mono', monospace" }}>
      {/* Topbar */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "11px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: C.accent }}>◈ AUTOSWAP</div>
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? C.accentDim : "transparent", color: tab === t.id ? C.accent : C.muted, border: `1px solid ${tab === t.id ? C.accent + "44" : "transparent"}`, borderRadius: 4, padding: "4px 11px", fontSize: 11, fontFamily: "inherit", cursor: "pointer", fontWeight: 600 }}>{t.label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Tag c={botRunning ? C.green : C.red}>{botRunning ? "● LIVE" : "● PAUSED"}</Tag>
          <Btn variant={botRunning ? "danger" : "success"} sm onClick={toggleBot}>{botRunning ? "Stop Bot" : "Start Bot"}</Btn>
          <span style={{ color: C.muted, fontSize: 11 }}>{user.email}</span>
          <Btn sm variant="ghost" onClick={onLogout}>Logout</Btn>
        </div>
      </div>
      {/* Body */}
      <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        {tab === "dashboard" && <DashTab token={token} liveActivity={liveActivity} botRunning={botRunning} />}
        {tab === "api" && <ApiTab token={token} />}
        {tab === "autobuy" && <AutoBuyTab token={token} />}
        {tab === "convert" && <ConvertTab token={token} />}
        {tab === "sell" && <SellTab token={token} />}
        {tab === "users" && <UsersTab token={token} />}
        {tab === "activity" && <ActivityTabFull token={token} liveActivity={liveActivity} />}
      </div>
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────
function DashTab({ token, liveActivity, botRunning }) {
  const [stats, setStats] = useState(null);
  const [balances, setBalances] = useState([]);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    apiFetch("/api/stats", {}, token).then(setStats).catch(() => {});
    apiFetch("/api/balance", {}, token).then(d => setBalances(d.balances || [])).catch(() => {});
    apiFetch("/api/orders", {}, token).then(d => setOrders(d.orders || [])).catch(() => {});
  }, [token]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Overview</div>
          <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>Live automation engine status</div>
        </div>
        <Tag c={botRunning ? C.green : C.red}>{botRunning ? "BOT RUNNING" : "BOT STOPPED"}</Tag>
      </div>
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <Stat label="Auto-Buys Today" value={stats.buysToday} c={C.blue} />
          <Stat label="Conversions" value={stats.convertsToday} c={C.accent} />
          <Stat label="Pending Orders" value={stats.salesPending} c={C.accent} sub="Awaiting payment" />
          <Stat label="Completed Sales" value={stats.salesTotal} c={C.green} />
          <Stat label="Active Buyers" value={stats.activeUsers} c={C.green} />
          <Stat label="Pending Approval" value={stats.pendingUsers} c={C.mutedLight} />
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 13 }}>Wallet Balances</div>
          {balances.length === 0 && <div style={{ color: C.muted, fontSize: 12 }}>Connect API keys to see balances</div>}
          {balances.map(b => (
            <div key={b.asset} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}22`, fontSize: 12 }}>
              <span style={{ fontWeight: 700 }}>{b.asset}</span>
              <span style={{ color: C.accent }}>{b.free.toFixed(6)}</span>
            </div>
          ))}
        </Card>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 13 }}>Live Activity Feed</div>
          {liveActivity.length === 0 && <div style={{ color: C.muted, fontSize: 12 }}>No activity yet — start the bot</div>}
          {liveActivity.slice(0, 6).map((a, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.border}22`, fontSize: 11 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Tag c={{ BUY: C.green, SELL: C.red, CONVERT: C.blue, P2P: C.accent }[a.type] || C.accent}>{a.type}</Tag>
                <span style={{ color: C.mutedLight }}>{a.amount}</span>
              </div>
              <Tag c={a.status === "COMPLETED" ? C.green : a.status === "FAILED" ? C.red : C.accent}>{a.status}</Tag>
            </div>
          ))}
        </Card>
      </div>
      {/* Pending orders */}
      {orders.filter(o => o.status === "pending").length > 0 && (
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 13 }}>Pending Buyer Orders</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr>{["Buyer", "Coin", "Amount", "Method", "Status"].map(h => <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: C.muted, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
            <tbody>{orders.filter(o => o.status === "pending").map(o => (
              <tr key={o.id} style={{ borderTop: `1px solid ${C.border}22` }}>
                <td style={{ padding: "10px 12px" }}>{o.buyer_name || o.buyer_email || "–"}</td>
                <td style={{ padding: "10px 12px" }}><Tag c={C.accent}>{o.coin}</Tag></td>
                <td style={{ padding: "10px 12px", color: C.green, fontWeight: 700 }}>{o.amount}</td>
                <td style={{ padding: "10px 12px", color: C.muted }}>{o.method}</td>
                <td style={{ padding: "10px 12px" }}><Tag c={C.accent}>{o.status}</Tag></td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ─── API Keys Tab ─────────────────────────────
function ApiTab({ token }) {
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState(null);
  const [hasKeys, setHasKeys] = useState(false);

  useEffect(() => { apiFetch("/api/keys/has", {}, token).then(d => setHasKeys(d.hasKeys)).catch(() => {}); }, [token]);

  async function save() {
    if (!apiKey || !secretKey) return;
    setSaving(true); setMsg(null);
    try {
      await apiFetch("/api/keys", { method: "POST", body: { apiKey, secretKey } }, token);
      setMsg({ type: "success", text: "✓ API keys saved and encrypted." });
      setHasKeys(true); setApiKey(""); setSecretKey("");
    } catch (e) { setMsg({ type: "error", text: e.message }); }
    finally { setSaving(false); }
  }

  async function test() {
    setTesting(true); setMsg(null);
    try {
      const d = await apiFetch("/api/keys/test", {}, token);
      setMsg({ type: "success", text: `✓ Connected! Can trade: ${d.canTrade}. Spot balance readable.` });
    } catch (e) { setMsg({ type: "error", text: `✗ ${e.message}` }); }
    finally { setTesting(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 640 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Binance API Connection</div>
        <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>Your keys are AES-256 encrypted before storage. Enable Spot + Convert in Binance API settings.</div>
      </div>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {hasKeys && <Alert type="success">✓ API keys already saved. Enter new ones below to update.</Alert>}
          <Input label="API Key" value={apiKey} onChange={setApiKey} placeholder="Paste your Binance API Key" />
          <Input label="Secret Key" type="password" value={secretKey} onChange={setSecretKey} placeholder="Paste your Binance Secret Key" />
          <Alert type="info">
            Required Binance API permissions:<br />
            ✓ Enable Reading &nbsp; ✓ Enable Spot & Margin Trading &nbsp; ✓ Enable Convert<br />
            ✗ Do NOT enable withdrawals
          </Alert>
          {msg && <Alert type={msg.type}>{msg.text}</Alert>}
          <div style={{ display: "flex", gap: 10 }}>
            <Btn variant="ghost" onClick={test} loading={testing}>Test Connection</Btn>
            <Btn onClick={save} loading={saving} disabled={!apiKey || !secretKey}>Save Keys</Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Auto-Buy Tab ─────────────────────────────
const COINS = ["BTC","ETH","SOL","BNB","XRP","ADA","DOGE","AVAX","MATIC","DOT","LTC","LINK"];

function AutoBuyTab({ token }) {
  const [rules, setRules] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [prices, setPrices] = useState({});
  const [mode, setMode] = useState("range");

  useEffect(() => {
    apiFetch("/api/config", {}, token).then(d => { setRules(d.buy_rules || []); }).catch(() => {});
    apiFetch("/api/prices?coins=BTC,ETH,SOL,BNB,XRP", {}, token).then(setPrices).catch(() => {});
  }, [token]);

  function addRule() { setRules(r => [...r, { coin: "BTC", minPrice: "", maxPrice: "", amount: "", enabled: true }]); }
  function upd(i, k, v) { setRules(r => r.map((x, j) => j === i ? { ...x, [k]: v } : x)); }
  function del(i) { setRules(r => r.filter((_, j) => j !== i)); }

  async function save() {
    setSaving(true); setMsg(null);
    try {
      await apiFetch("/api/config", { method: "PUT", body: { buy_rules: rules } }, token);
      setMsg({ type: "success", text: "✓ Auto-buy rules saved." });
    } catch (e) { setMsg({ type: "error", text: e.message }); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 820 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Auto-Buy Rules</div>
        <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>Bot checks prices every 15s and buys when inside your range.</div>
      </div>
      {/* Live prices */}
      {Object.keys(prices).length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(prices).map(([coin, p]) => (
            <div key={coin} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 14px", fontSize: 12 }}>
              <span style={{ color: C.muted, marginRight: 6 }}>{coin}</span>
              <span style={{ color: C.accent, fontWeight: 700 }}>${p.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
      <Card>
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          <Pill active={mode === "range"} onClick={() => setMode("range")} small>Price Range</Pill>
          <Pill active={mode === "dip"} onClick={() => setMode("dip")} small>% Dip (coming soon)</Pill>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rules.map((rule, i) => (
            <div key={i} style={{ background: C.surface, border: `1px solid ${rule.enabled ? C.border : C.border + "44"}`, borderRadius: 8, padding: 14, opacity: rule.enabled ? 1 : 0.55 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select value={rule.coin} onChange={e => upd(i, "coin", e.target.value)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, color: C.accent, fontFamily: "inherit", fontWeight: 800, fontSize: 12, padding: "4px 8px", outline: "none" }}>
                    {COINS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {prices[rule.coin] && <span style={{ color: C.muted, fontSize: 11 }}>now ${prices[rule.coin]?.toLocaleString()}</span>}
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <Toggle value={rule.enabled} onChange={v => upd(i, "enabled", v)} />
                  <Btn variant="danger" sm onClick={() => del(i)}>✕</Btn>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <Input label="Min Price ($)" value={rule.minPrice} onChange={v => upd(i, "minPrice", v)} placeholder="60000" />
                <Input label="Max Price ($)" value={rule.maxPrice} onChange={v => upd(i, "maxPrice", v)} placeholder="70000" />
                <Input label="Buy Amount" value={rule.amount} onChange={v => upd(i, "amount", v)} placeholder="50" suffix="USDT" />
              </div>
            </div>
          ))}
          <Btn variant="ghost" onClick={addRule}>+ Add Rule</Btn>
        </div>
        {msg && <div style={{ marginTop: 12 }}><Alert type={msg.type}>{msg.text}</Alert></div>}
        <div style={{ marginTop: 16 }}><Btn onClick={save} loading={saving}>Save Rules</Btn></div>
      </Card>
    </div>
  );
}

// ─── Convert Tab ──────────────────────────────
function ConvertTab({ token }) {
  const [cfg, setCfg] = useState({ convert_target: "both", convert_ratio: 60, convert_timing: "immediate" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => { apiFetch("/api/config", {}, token).then(d => setCfg(c => ({ ...c, ...d }))).catch(() => {}); }, [token]);
  const set = k => v => setCfg(c => ({ ...c, [k]: v }));

  async function save() {
    setSaving(true); setMsg(null);
    try {
      await apiFetch("/api/config", { method: "PUT", body: cfg }, token);
      setMsg({ type: "success", text: "✓ Convert settings saved." });
    } catch (e) { setMsg({ type: "error", text: e.message }); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 640 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Auto-Convert Settings</div>
        <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>After each auto-buy, instantly convert to your stablecoin via Binance Convert API.</div>
      </div>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ color: C.muted, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Convert Target</div>
            <div style={{ display: "flex", gap: 8 }}>
              <Pill active={cfg.convert_target === "usdt"} onClick={() => set("convert_target")("usdt")} small>USDT Only</Pill>
              <Pill active={cfg.convert_target === "usdc"} onClick={() => set("convert_target")("usdc")} small>USDC Only</Pill>
              <Pill active={cfg.convert_target === "both"} onClick={() => set("convert_target")("both")} small>Split Both</Pill>
            </div>
          </div>
          {cfg.convert_target === "both" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: C.muted, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>USDT Split</span>
                <span style={{ color: C.accent, fontWeight: 800 }}>{cfg.convert_ratio}% USDT / {100 - cfg.convert_ratio}% USDC</span>
              </div>
              <input type="range" min={10} max={90} step={5} value={cfg.convert_ratio} onChange={e => set("convert_ratio")(parseInt(e.target.value))} style={{ width: "100%", accentColor: C.accent }} />
            </div>
          )}
          <Select label="Convert Timing" value={cfg.convert_timing} onChange={set("convert_timing")} options={[
            { value: "immediate", label: "Immediately after each buy" },
            { value: "batched", label: "Batch every hour" },
          ]} />
          <Alert type="info">
            Flow: Auto-buy executes on Spot → Binance Convert API called → crypto lands as USDT/USDC → ready for your buyers.
          </Alert>
          {msg && <Alert type={msg.type}>{msg.text}</Alert>}
          <Btn onClick={save} loading={saving}>Save Convert Settings</Btn>
        </div>
      </Card>
    </div>
  );
}

// ─── Sell Config Tab ──────────────────────────
function SellTab({ token }) {
  const [cfg, setCfg] = useState({ markup_pct: "2.5", min_order: "50", max_order: "5000", fiat_currency: "USD", p2p_auto: true, site_auto: true, payment_methods: ["Bank Transfer"] });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const ALL_METHODS = ["Bank Transfer", "USDT Wallet", "PayPal", "Cash App", "Wise", "Revolut"];

  useEffect(() => { apiFetch("/api/config", {}, token).then(d => setCfg(c => ({ ...c, ...d, p2p_auto: !!d.p2p_auto, site_auto: !!d.site_auto }))).catch(() => {}); }, [token]);
  const set = k => v => setCfg(c => ({ ...c, [k]: v }));
  const toggleMethod = m => setCfg(c => ({ ...c, payment_methods: c.payment_methods.includes(m) ? c.payment_methods.filter(x => x !== m) : [...c.payment_methods, m] }));

  async function save() {
    setSaving(true); setMsg(null);
    try {
      await apiFetch("/api/config", { method: "PUT", body: cfg }, token);
      setMsg({ type: "success", text: "✓ Sell settings saved." });
    } catch (e) { setMsg({ type: "error", text: e.message }); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 780 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Sell Configuration</div>
        <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>Set your pricing and auto-sell rules for P2P and platform orders.</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 13 }}>Pricing</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <Input label="Markup %" value={cfg.markup_pct} onChange={set("markup_pct")} suffix="%" placeholder="2.5" />
            <Input label="Min Order" value={cfg.min_order} onChange={set("min_order")} suffix="USDT" placeholder="50" />
            <Input label="Max Order" value={cfg.max_order} onChange={set("max_order")} suffix="USDT" placeholder="5000" />
            <Select label="Fiat Currency" value={cfg.fiat_currency} onChange={set("fiat_currency")} options={[
              { value: "USD", label: "USD — US Dollar" }, { value: "NGN", label: "NGN — Nigerian Naira" },
              { value: "GHS", label: "GHS — Ghanaian Cedi" }, { value: "KES", label: "KES — Kenyan Shilling" },
              { value: "GBP", label: "GBP — British Pound" }, { value: "EUR", label: "EUR — Euro" },
              { value: "ZAR", label: "ZAR — South African Rand" },
            ]} />
          </div>
        </Card>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 13 }}>Auto-Sell</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Toggle value={cfg.p2p_auto} onChange={set("p2p_auto")} label="Auto-accept Binance P2P orders" />
            <Toggle value={cfg.site_auto} onChange={set("site_auto")} label="Auto-release to platform buyers" />
            <Divider label="PAYMENT METHODS" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ALL_METHODS.map(m => (
                <button key={m} onClick={() => toggleMethod(m)} style={{ background: cfg.payment_methods?.includes(m) ? C.greenDim : C.surface, color: cfg.payment_methods?.includes(m) ? C.green : C.muted, border: `1px solid ${cfg.payment_methods?.includes(m) ? C.green : C.border}`, borderRadius: 4, padding: "5px 10px", fontSize: 11, fontFamily: "inherit", cursor: "pointer" }}>{m}</button>
              ))}
            </div>
          </div>
        </Card>
      </div>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      <Btn onClick={save} loading={saving}>Save Sell Configuration</Btn>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────
function UsersTab({ token }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const refresh = useCallback(() => { apiFetch("/api/users", {}, token).then(d => setUsers(d.users || [])).catch(() => {}); }, [token]);
  useEffect(() => { refresh(); }, [refresh]);

  async function updateStatus(id, status) {
    await apiFetch(`/api/users/${id}/status`, { method: "PUT", body: { status } }, token);
    refresh();
  }

  const filtered = users.filter(u => !search || u.email?.includes(search) || u.name?.includes(search));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Platform Buyers</div>
          <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>Manage users registered to buy from your platform</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Stat label="Total" value={users.length} c={C.text} />
          <Stat label="Active" value={users.filter(u => u.status === "active").length} c={C.green} />
          <Stat label="Pending" value={users.filter(u => u.status === "pending").length} c={C.accent} />
        </div>
      </div>
      <Input value={search} onChange={setSearch} placeholder="Search by email or name..." />
      <Card s={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: C.surface }}>{["Name", "Email", "Volume", "Joined", "Status", "Actions"].map(h => <th key={h} style={{ padding: "11px 16px", textAlign: "left", color: C.muted, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", borderBottom: `1px solid ${C.border}` }}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} style={{ borderBottom: `1px solid ${C.border}22` }}>
                <td style={{ padding: "11px 16px", fontWeight: 700 }}>{u.name || "—"}</td>
                <td style={{ padding: "11px 16px", color: C.muted, fontSize: 12 }}>{u.email}</td>
                <td style={{ padding: "11px 16px", color: C.green, fontWeight: 700 }}>{u.volume.toFixed(2)} USDT</td>
                <td style={{ padding: "11px 16px", color: C.muted, fontSize: 11 }}>{new Date(u.created_at * 1000).toLocaleDateString()}</td>
                <td style={{ padding: "11px 16px" }}><Tag c={u.status === "active" ? C.green : u.status === "blocked" ? C.red : C.accent}>{u.status}</Tag></td>
                <td style={{ padding: "11px 16px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {u.status === "pending" && <Btn sm variant="success" onClick={() => updateStatus(u.id, "active")}>Approve</Btn>}
                    {u.status === "active" && <Btn sm variant="danger" onClick={() => updateStatus(u.id, "blocked")}>Block</Btn>}
                    {u.status === "blocked" && <Btn sm variant="ghost" onClick={() => updateStatus(u.id, "active")}>Unblock</Btn>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Activity Tab ─────────────────────────────
function ActivityTabFull({ token, liveActivity }) {
  const [history, setHistory] = useState([]);
  useEffect(() => { apiFetch("/api/activity?limit=100", {}, token).then(d => setHistory(d.activity || [])).catch(() => {}); }, [token]);
  const all = [...liveActivity, ...history].slice(0, 80);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 780 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Activity Log</div>
        <div style={{ color: C.muted, fontSize: 11 }}>All bot actions, buys, converts, and sales</div>
      </div>
      <Card>
        {all.length === 0 && <div style={{ color: C.muted, fontSize: 12 }}>No activity yet</div>}
        {all.map((a, i) => {
          const typeColor = { BUY: C.green, SELL: C.red, CONVERT: C.blue, P2P: C.accent }[a.type] || C.accent;
          return (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${C.border}22`, fontSize: 12 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Tag c={typeColor}>{a.type}</Tag>
                <span style={{ color: C.text }}>{a.amount}</span>
                <span style={{ color: C.muted }}>{a.price}</span>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Tag c={a.status === "COMPLETED" ? C.green : a.status === "FAILED" ? C.red : C.accent}>{a.status}</Tag>
                <span style={{ color: C.muted, fontSize: 10 }}>{a.time || new Date(a.created_at * 1000).toLocaleTimeString()}</span>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ─── Buyer App ────────────────────────────────
function BuyerApp({ user, token, onLogout }) {
  const [coin, setCoin] = useState("USDT");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Bank Transfer");
  const [cfg, setCfg] = useState(null);
  const [myOrders, setMyOrders] = useState([]);
  const [ordering, setOrdering] = useState(false);
  const [msg, setMsg] = useState(null);
  const [tab, setTab] = useState("buy");

  useEffect(() => {
    apiFetch("/api/config", {}, token).then(setCfg).catch(() => {});
    apiFetch("/api/orders", {}, token).then(d => setMyOrders(d.orders || [])).catch(() => {});
  }, [token]);

  const markup = cfg?.markup_pct || 2.5;
  const youPay = amount ? (parseFloat(amount) * (1 + markup / 100)).toFixed(2) : "0.00";

  async function placeOrder() {
    if (!amount) return;
    setOrdering(true); setMsg(null);
    try {
      await apiFetch("/api/orders", { method: "POST", body: { coin, amount: parseFloat(amount), method } }, token);
      setMsg({ type: "success", text: `✓ Order placed for ${amount} ${coin}. Send payment via ${method} and crypto will be released automatically.` });
      setAmount("");
      apiFetch("/api/orders", {}, token).then(d => setMyOrders(d.orders || [])).catch(() => {});
    } catch (e) { setMsg({ type: "error", text: e.message }); }
    finally { setOrdering(false); }
  }

  async function markPaid(orderId) {
    try {
      const d = await apiFetch(`/api/orders/${orderId}/paid`, { method: "PUT" }, token);
      setMsg({ type: d.autoReleased ? "success" : "info", text: d.autoReleased ? "✓ Payment confirmed — crypto released!" : "✓ Payment marked. Awaiting manual release." });
      apiFetch("/api/orders", {}, token).then(d => setMyOrders(d.orders || [])).catch(() => {});
    } catch (e) { setMsg({ type: "error", text: e.message }); }
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'IBM Plex Mono', monospace" }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "11px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 17, fontWeight: 900, color: C.accent }}>◈ AUTOSWAP</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Pill active={tab === "buy"} onClick={() => setTab("buy")} small>Buy</Pill>
          <Pill active={tab === "orders"} onClick={() => setTab("orders")} small>My Orders</Pill>
          <span style={{ color: C.muted, fontSize: 11 }}>{user.name || user.email}</span>
          <Btn sm variant="ghost" onClick={onLogout}>Logout</Btn>
        </div>
      </div>
      <div style={{ maxWidth: 500, margin: "40px auto", padding: 20 }}>
        {tab === "buy" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>Buy Stablecoins</div>
              <div style={{ color: C.muted, fontSize: 11, marginTop: 5 }}>Instant USDT / USDC at competitive rates</div>
            </div>
            <Card>
              <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                <div>
                  <div style={{ color: C.muted, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Select Coin</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Pill active={coin === "USDT"} onClick={() => setCoin("USDT")}>USDT</Pill>
                    <Pill active={coin === "USDC"} onClick={() => setCoin("USDC")}>USDC</Pill>
                  </div>
                </div>
                <Input label={`Amount (${coin})`} value={amount} onChange={setAmount} placeholder="e.g. 500" type="number" suffix={coin} />
                <Select label="Payment Method" value={method} onChange={setMethod} options={
                  (cfg?.payment_methods || ["Bank Transfer"]).map(m => ({ value: m, label: m }))
                } />
                {amount && (
                  <div style={{ background: C.surface, borderRadius: 8, padding: 14 }}>
                    {[["You Receive", `${amount} ${coin}`], ["Rate", `Market +${markup}%`], ["You Pay (est.)", `$${youPay}`]].map(([l, v]) => (
                      <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12 }}>
                        <span style={{ color: C.muted }}>{l}</span>
                        <span style={{ color: l.includes("Pay") ? C.accent : C.text, fontWeight: l.includes("Pay") ? 800 : 400 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}
                {msg && <Alert type={msg.type}>{msg.text}</Alert>}
                <Btn onClick={placeOrder} loading={ordering} disabled={!amount} full>Place Order</Btn>
              </div>
            </Card>
          </>
        )}
        {tab === "orders" && (
          <>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>My Orders</div>
            {msg && <div style={{ marginBottom: 12 }}><Alert type={msg.type}>{msg.text}</Alert></div>}
            {myOrders.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>No orders yet.</div>}
            {myOrders.map(o => (
              <Card key={o.id} s={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", gap: 8 }}><Tag c={C.accent}>{o.coin}</Tag><Tag c={{ pending: C.accent, paid: C.blue, released: C.green, cancelled: C.red }[o.status] || C.muted}>{o.status}</Tag></div>
                  <span style={{ color: C.green, fontWeight: 800 }}>{o.amount} {o.coin}</span>
                </div>
                <div style={{ color: C.muted, fontSize: 11, marginBottom: o.status === "pending" ? 12 : 0 }}>
                  Method: {o.method} • Rate: +{((o.rate - 1) * 100).toFixed(1)}%
                </div>
                {o.status === "pending" && (
                  <Btn sm onClick={() => markPaid(o.id)}>I've Sent Payment</Btn>
                )}
                {o.status === "released" && (
                  <Alert type="success">✓ Crypto released to your wallet</Alert>
                )}
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────
export default function App() {
  const [auth, setAuth] = useState(() => {
    const t = localStorage.getItem("token");
    if (!t) return null;
    try {
      const payload = JSON.parse(atob(t.split(".")[1]));
      if (payload.exp * 1000 < Date.now()) { localStorage.removeItem("token"); return null; }
      return { token: t, user: { id: payload.id, email: payload.email, role: payload.role } };
    } catch { return null; }
  });

  function handleAuth(user, token) { setAuth({ user, token }); }
  function handleLogout() { localStorage.removeItem("token"); setAuth(null); }

  if (!auth) return <AuthScreen onAuth={handleAuth} />;
  if (auth.user.role === "buyer") return <BuyerApp user={auth.user} token={auth.token} onLogout={handleLogout} />;
  return <OwnerApp user={auth.user} token={auth.token} onLogout={handleLogout} />;
}
