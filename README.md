# ◈ AutoSwap — Binance Automation Platform

A full-stack platform to automate your Binance trading:
- Auto-buy crypto when price hits your range
- Auto-convert to USDT / USDC via Binance Convert
- Accept platform buyer orders and auto-release
- Real-time WebSocket activity feed
- User management (approve/block buyers)

---

## Project Structure

```
autoswap/
├── backend/
│   ├── server.js          ← Express API + bot engine
│   ├── package.json
│   └── .env               ← Your config (edit this)
└── frontend/
    ├── src/
    │   ├── App.jsx         ← Full React UI
    │   └── index.js
    ├── public/
    │   └── index.html
    └── package.json
```

---

## Setup (Step by Step)

### Prerequisites
- Node.js 18+ (https://nodejs.org)
- A Binance account with API access

---

### 1. Backend

```bash
cd autoswap/backend
npm install
```

Edit `.env`:
```
PORT=4000
JWT_SECRET=pick_a_long_random_string_here
```

Start the server:
```bash
node server.js
# or for auto-restart during dev:
npx nodemon server.js
```

You should see:
```
✓ AutoSwap server running on http://localhost:4000
✓ WebSocket available at ws://localhost:4000/ws
```

---

### 2. Frontend

```bash
cd autoswap/frontend
npm install
npm start
```

Opens at http://localhost:3000

---

### 3. Binance API Setup

1. Go to https://www.binance.com/en/my/settings/api-management
2. Create a new API key
3. Enable these permissions ONLY:
   - ✅ Enable Reading
   - ✅ Enable Spot & Margin Trading
   - ✅ Enable Convert
   - ❌ DO NOT enable withdrawals
4. (Recommended) Restrict to your server's IP
5. Paste keys into the **Binance API** tab in the dashboard

---

### 4. First-Time Owner Setup

1. Open http://localhost:3000
2. Register with role **Platform Owner**
3. Go to **Binance API** tab → enter your API keys → Test Connection
4. Go to **Auto-Buy** tab → add buy rules (coin, price range, amount)
5. Go to **Auto-Convert** → choose USDT / USDC split
6. Go to **Sell Config** → set your markup % and payment methods
7. Press **Start Bot** in the top bar

---

### 5. Buyer Flow

1. A buyer visits your site and registers (role: Buyer)
2. You approve them in the **Users** tab
3. They log in, place an order (USDT / USDC amount)
4. They send payment via the chosen method
5. They click "I've Sent Payment" — if **Auto-release** is on, crypto is released instantly
6. You can also manually release from the **Dashboard**

---

## Key Bot Behaviors

| Event | Action |
|---|---|
| Coin price enters range | Auto-buy via Binance Spot Market order |
| After buy | Auto-convert to USDT/USDC via Binance Convert |
| Buyer sends payment | Auto-release USDT/USDC (if enabled) |
| P2P order arrives | (Binance P2P API is limited — see note below) |

---

## P2P Note

Binance does **not** have a fully public P2P REST API. The current platform handles orders placed through **your own site** (buyers sign up and order directly). For Binance P2P auto-accept, you would need to apply for Binance P2P Merchant API access separately at https://p2p.binance.com/en/merchant.

---

## Deployment (Production)

For a live server, deploy the backend on:
- **Railway** (railway.app) — easiest
- **Render** (render.com) — free tier available
- **VPS** (DigitalOcean, Hetzner) — most control

Set environment variables on your host instead of `.env`.

For the frontend, build and deploy to:
```bash
cd frontend && npm run build
# Deploy the /build folder to Netlify, Vercel, or your VPS
```

Update the API URL in `App.jsx` line 4:
```js
const API = "https://your-backend-url.com";
```

---

## Security Reminders

- Never enable Binance withdrawal permissions on your API key
- Restrict your API key to your server's IP in Binance settings
- Change `JWT_SECRET` in `.env` to a long random string
- Run behind HTTPS in production (use Nginx + Let's Encrypt)

---

## License
MIT — build freely, deploy responsibly.
