# ◈ AutoSwap — Deployment Guide
## Netlify (Frontend) + Render (Backend) + PWA Install

---

## STEP 1 — Push to GitHub

Create a GitHub repo and push your code:

```bash
git init
git add .
git commit -m "Initial AutoSwap build"
git remote add origin https://github.com/YOUR_USERNAME/autoswap.git
git push -u origin main
```

---

## STEP 2 — Deploy Backend on Render

1. Go to https://render.com → Sign in → **New → Web Service**
2. Connect your GitHub repo
3. Configure:
   | Field | Value |
   |---|---|
   | Root Directory | `backend` |
   | Build Command | `npm install` |
   | Start Command | `node server.js` |
   | Instance Type | Free |

4. Add these **Environment Variables** in Render dashboard:
   | Key | Value |
   |---|---|
   | `JWT_SECRET` | (click Generate — or paste a random 64-char string) |
   | `ALLOWED_ORIGINS` | `https://YOUR-APP.netlify.app` ← fill in after Step 3 |
   | `DB_PATH` | `./autoswap.db` |
   | `NODE_ENV` | `production` |

5. Click **Deploy** — wait ~2 minutes
6. Copy your backend URL: `https://autoswap-backend.onrender.com`

---

## STEP 3 — Deploy Frontend on Netlify

1. Go to https://netlify.com → **Add new site → Import from Git**
2. Connect your GitHub repo
3. Configure:
   | Field | Value |
   |---|---|
   | Base directory | `frontend` |
   | Build command | `npm install && npm run build` |
   | Publish directory | `frontend/build` |

4. Add **Environment Variable** in Netlify dashboard (Site Settings → Environment Variables):
   | Key | Value |
   |---|---|
   | `REACT_APP_API_URL` | `https://autoswap-backend.onrender.com` |

5. Click **Deploy site** — wait ~3 minutes
6. Note your Netlify URL: `https://autoswap-xyz.netlify.app`

---

## STEP 4 — Link them together

Go back to **Render dashboard → autoswap-backend → Environment**:
- Update `ALLOWED_ORIGINS` → `https://autoswap-xyz.netlify.app`
- Click **Save** (backend will redeploy automatically)

---

## STEP 5 — Install as App on Phone

### Android (Chrome)
1. Open your Netlify URL in Chrome
2. Tap the **⋮ menu** (top right)
3. Tap **"Add to Home screen"**
4. Tap **Add** — icon appears on home screen ✓

### iPhone (Safari)
1. Open your Netlify URL in **Safari** (must be Safari)
2. Tap the **Share button** (box with arrow)
3. Scroll down → tap **"Add to Home Screen"**
4. Tap **Add** — icon appears on home screen ✓

---

## STEP 6 — First Login

1. Open the app
2. Register with role **Platform Owner**
3. Go to **Binance API** tab → paste your API keys → Test
4. Set up **Auto-Buy rules**
5. Configure **Auto-Convert** (USDT/USDC split)
6. Set **Sell Config** (markup %, payment methods)
7. Hit **Start Bot** ✓

---

## Important Notes

### Render Free Tier — Spin Down
Render free instances sleep after 15 minutes of inactivity.
The bot will stop running when it sleeps. To keep it alive:
- Upgrade to Render Starter ($7/mo) — stays always on
- Or use a free uptime monitor like https://uptimerobot.com
  → Create a monitor pinging: `https://autoswap-backend.onrender.com/api/health`
  → Set interval: every 10 minutes — this prevents sleep

### Custom Domain (Optional)
- Netlify: Site Settings → Domain Management → Add custom domain
- Render: Settings → Custom Domains

---

## Architecture Summary

```
Your Phone (PWA)
      ↓  HTTPS
Netlify (React Frontend)
      ↓  HTTPS + WSS
Render (Node.js Backend)
      ↓  HTTPS
Binance API (trading)
      ↓
SQLite DB (on Render disk)
```
