# ShopMate AI

**The shopping agent that cannot charge you.**

ShopMate turns a messy shopping brief into typed requirements, filters a verified catalog, explains the trade-offs, and waits for explicit human approval before a PayPal Sandbox capture. The model can recommend. It cannot set a price or move money.

Built for the PayPal agentic-commerce hackathon.

| Surface | URL | What it is |
| --- | --- | --- |
| Landing | `/` | Editorial home, demo briefs, both shopping paths |
| Workspace | `/app` | 24-product verified collection, decision canvas, PayPal Sandbox cart |
| Discover | `/discover` | Live Channel3 search, product details, variants, merchant offers |
| Cart | `/cart` | Checkout for the verified ShopMate catalog |

---

## Contents

- [Stack](#stack)
- [Quick start](#quick-start)
- [PayPal Sandbox](#paypal-sandbox)
- [Channel3 product data](#channel3-product-data)
- [Demo script](#demo-script)
- [Trust layer](#trust-layer)
- [API](#api)
- [Project structure](#project-structure)
- [Environment variables](#environment-variables)
- [Deploy](#deploy)
- [Troubleshooting](#troubleshooting)

---

## Stack

| Layer | Tech |
| --- | --- |
| Client | Vite, React 19, TypeScript, React Router, Framer Motion, Tailwind CSS v4 |
| Server | Node.js, Express, TypeScript, `tsx` |
| Payments | PayPal Orders v2 REST API, PayPal React SDK v6 (`@paypal/react-paypal-js`) |
| Product discovery | Verified ShopMate catalog plus live Channel3 (`@channel3/sdk`) |
| Optional AI | OpenAI or Anthropic for intent extraction; deterministic parser is the fallback |

---

## Quick start

```bash
npm run install:all
cp server/.env.example server/.env   # optional; simulated checkout works without keys
npm run dev
```

On Windows PowerShell, copy the env file with:

```powershell
Copy-Item server\.env.example server\.env
```

Then open [http://localhost:5173](http://localhost:5173). The API runs on [http://localhost:8787](http://localhost:8787). Vite proxies `/api` to the server.

### Production build

```bash
npm run build
npm start
```

If `client/dist` exists, Express serves it, so the built app is at [http://localhost:8787](http://localhost:8787).

`server/.env` is gitignored. Never commit it.

---

## PayPal Sandbox

Checkout works without credentials in **simulated sandbox** mode. For the real PayPal Orders v2 Sandbox flow, create a sandbox app and add credentials.

### 1. Create the sandbox app

1. Sign in at [developer.paypal.com/dashboard/applications](https://developer.paypal.com/dashboard/applications).
2. Keep the **Sandbox** toggle selected.
3. **Apps & Credentials → Sandbox → Create App**.
4. Choose **Merchant**, name it `ShopMate AI`, and create it.
5. Copy the **Client ID** and **Secret**.

### 2. Configure the server

Copy `server/.env.example` to `server/.env` and fill in:

```env
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_ENV=sandbox
CHANNEL3_API_KEY=
PORT=8787
```

- No quotes and no spaces around `=`.
- Use **Sandbox** credentials, not Live.
- The client only receives the public Client ID from `GET /api/config`. The secret stays on the server.

### 3. Restart the server

Env is read at startup. After editing `.env`, restart `npm run dev`. The log should show:

```text
PayPal: sandbox credentials loaded
```

`GET /api/config` should return `"paypalConfigured": true`.

### 4. Create a sandbox buyer

Merchant app credentials are not the buyer login.

1. In the PayPal dashboard, open **Sandbox → Accounts**.
2. Confirm a **Personal** account with a positive USD balance, or create one.
3. Use that account’s email and password in the PayPal approval popup.

The checkout uses the PayPal React SDK v6 with `environment="sandbox"`. Sandbox tests set `testBuyerCountry="US"`. Production uses `environment="production"` and does not set a test country.

Do **not** pay with the merchant account that owns the sandbox app. PayPal rejects self-payment with:

> This PayPal account is associated with the merchant you're trying to pay.

The popup is the human boundary. Nothing is captured until the buyer approves.

### Simulated fallback

If credentials are missing, invalid, or the sandbox is unavailable, the app stays usable:

- The checkout drawer shows **Simulated sandbox**.
- If credentials are configured, the drawer shows a **PayPal sandbox / Simulated** toggle.
- Simulated mode sends `x-shopmate-payment-mode: simulated` and still uses the strict `{ productIds, sessionId }` body.

---

## Channel3 product data

Add `CHANNEL3_API_KEY` to `server/.env`. The `/discover` page uses Channel3 agentic search for live products. Category shortcuts and free-text briefs both work. **Product details** run a fresh lookup: images, description, attributes, ratings, variants, and current merchant offers.

ShopMate keeps the two purchase paths separate:

- `/app` — verified collection and server-priced PayPal Orders v2 Sandbox checkout
- `/discover` — Channel3 products; retailer offers open the merchant site and never enter the ShopMate PayPal cart

The API key stays on the server. `GET /api/config` exposes only a configured flag. Restart after changing the key.

| Action | Route |
| --- | --- |
| Search | `POST /api/channel3/search` |
| Product / variant / offers | `POST /api/channel3/products/:productId` |

---

## Demo script

1. Open `/`.
2. Click a starter brief such as **Programming laptop** or **The two-item bundle**. The workspace opens preloaded and runs the agent pipeline.
3. Watch extract → filter → evaluate → ready for approval.
4. Inspect requirement pills. Remove one (for example the battery minimum) to re-filter.
5. Try **Cheaper**, **Lightest**, **Bundle demo**, **Compare table**, **Start over**.
6. Add a product, or **Add both** for a bundle.
7. In the checkout drawer, verify the server total and the audit strip.
8. Choose **PayPal sandbox** (if configured) and approve in the popup, or **Simulated** for the fallback.
9. The receipt shows Order ID, Capture ID, `COMPLETED` status, timestamp, payer, and warranty text.

### Demo briefs

- Programming laptop under $700, 16GB RAM, strong battery for VS Code
- Wireless headphones for studying under $100, top comfort & ANC
- Simple smartphone for my mother under $250, big battery & great camera
- Bundle: Programming laptop + ANC study headphones under $750 total

---

## Trust layer

The important boundary is between the browser and the server.

### 1. The browser never sends a price

`POST /api/orders/create` accepts only:

```json
{ "productIds": ["lap-001", "hp-001"], "sessionId": "sm_..." }
```

If the body contains `price`, `amount`, `total`, `currency`, or `unit_amount`, the server returns HTTP 400:

> Client-supplied pricing is rejected by the trust layer. Send productIds only; the server reads price_usd from catalog.json.

### 2. The server re-prices from the catalog

The server looks up every SKU in `server/data/catalog.json`, rejects unknown or out-of-stock products, recomputes the total, and sends that amount to PayPal. The response includes an audit object with `client_price_accepted: false`. After buyer approval, the server captures the order and verifies amount and currency against its own ledger.

### 3. PayPal must return COMPLETED

`POST /api/orders/capture` captures the order, requires `COMPLETED`, and checks captured amount and currency against the ledger. A mismatch withholds the receipt and returns HTTP 409. Captures use a stable PayPal request ID so retries do not double-capture. Orders persist in gitignored `server/data/transactions.json`; a repeated request returns the existing receipt with `already_captured: true`.

### 4. Human approval is explicit

The model cannot trigger a capture. The UI requires a click on the PayPal button or the simulated approval modal. The server records that approval on the receipt.

### 5. Recommendations are grounded

`server/services/catalogSearch.ts` filters and scores deterministically. Every “why we recommend it” line and “known compromise” comes from catalog fields. Optional LLM intent extraction is validated and clamped. Without an LLM key, the deterministic parser handles every demo prompt.

---

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/config` | Public client ID, PayPal mode, catalog stats, demo prompts |
| `POST` | `/api/query` | Natural-language brief → requirements, matches, pipeline meta |
| `POST` | `/api/search` | Typed requirements → matches |
| `POST` | `/api/refine` | Remove one constraint and re-filter |
| `POST` | `/api/orders/create` | `{ productIds, sessionId }` → server-priced PayPal order |
| `POST` | `/api/orders/capture` | `{ orderID }` → verified receipt |
| `GET` | `/api/orders/recent` | Recent receipts |
| `GET` | `/api/orders/:orderID/receipt` | Receipt lookup |
| `POST` | `/api/channel3/search` | Live Channel3 product search |
| `POST` | `/api/channel3/products/:productId` | Fresh product, variant, and offer lookup |

---

## Project structure

```text
.
├─ client/
│  ├─ public/                 # favicon, Apache .htaccess, Netlify _redirects
│  └─ src/
│     ├─ components/          # landing, workspace, cart
│     ├─ context/             # cart state
│     ├─ lib/                 # api, types, demo prompts
│     └─ pages/               # Landing, Workspace, Channel3Shop, CartPage
├─ server/
│  ├─ data/catalog.json       # 24 verified SKUs
│  ├─ routes/                 # agent, orders, channel3
│  ├─ services/               # pipeline, catalog search, PayPal, Channel3
│  ├─ .env.example
│  └─ index.ts
├─ netlify.toml               # SPA fallback for Netlify
├─ package.json
└─ README.md
```

---

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `PAYPAL_CLIENT_ID` | For real sandbox | Public sandbox app client ID |
| `PAYPAL_CLIENT_SECRET` | For real sandbox | Server-only secret |
| `PAYPAL_ENV` | No | `sandbox` (default) or `live` |
| `CHANNEL3_API_KEY` | For `/discover` | Server-only Channel3 key |
| `PORT` | No | Express port, default `8787` |
| `OPENAI_API_KEY` | No | Optional LLM intent extraction |
| `OPENAI_MODEL` | No | Default `gpt-4o-mini` |
| `ANTHROPIC_API_KEY` | No | Optional LLM intent extraction |
| `ANTHROPIC_MODEL` | No | Default `claude-3-5-haiku-latest` |

Do not set `PAYPAL_ENV=live` for the demo unless you intend real charges.

---

## Deploy

### Render (client + API, recommended)

Create a **Web Service** from this repo. Use these settings if you are not applying `render.yaml`:

| Setting | Value |
| --- | --- |
| Build | `npm run install:all && npm run build` |
| Start | `npm start` |
| `NPM_CONFIG_PRODUCTION` | `false` (installs Vite and React types needed to build) |

Also set `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV=sandbox`, and `CHANNEL3_API_KEY` in the Render dashboard. Leave `PORT` unset.

### Netlify (static client)

`netlify.toml` builds the Vite app and publishes `client/dist`. SPA routes (`/app`, `/discover`, `/cart`) rewrite to `index.html` via `[[redirects]]` and `client/public/_redirects`.

The Express API is not hosted by that Netlify site. Point the client at your API, or run `npm start` after `npm run build` so Express serves `client/dist` and `/api` together.

### Apache

`client/public/.htaccess` is copied into `client/dist` on build. Point the document root at `client/dist` so unknown paths fall back to `index.html`.

---

## Troubleshooting

**The PayPal button does not appear.**  
Check `server/.env`, restart the server, and confirm `GET /api/config` returns `"paypalConfigured": true` and a non-null `paypalClientId`.

**The PayPal popup opens but login fails.**  
Use a **Sandbox → Accounts → Personal** buyer, not your PayPal developer account.

**PayPal login succeeds but the review page says "PayPal isn't available at this time."**  
Confirm Sandbox client ID with `PAYPAL_ENV=sandbox`, and a separate Personal Sandbox buyer with a positive balance. PayPal also requires a Business account to test integrations outside the US. If it continues, check the PayPal issue/debug ID and the server `[PayPal]` diagnostic line.

**PayPal says "This PayPal account is associated with the merchant you're trying to pay."**  
You are logged in as the merchant that owns the sandbox app. Log out of `sandbox.paypal.com` and use a different Personal sandbox buyer.

**PayPal returns `invalid_client`.**  
Credentials are from the Live tab or have extra spaces. Re-copy Sandbox Client ID and Secret, then restart.

**The approval popup is blocked.**  
Allow popups for `localhost:5173`, or use Simulated to finish the demo.

**The server still says "simulated sandbox (no credentials)" after adding `.env`.**  
The file must be `server/.env` (next to `server/package.json`), and the server must be restarted.

**A receipt shows a `SIM-` order ID.**  
That was a simulated capture. Switch to **PayPal sandbox** and approve in the popup for a real sandbox order ID.

---

## Notes

- The catalog is local and deterministic. Prices are never generated by a model.
- Some product images are representative stand-ins; the footer notes this.
- `server/data/transactions.json` is a local demo ledger and is gitignored.
- If PayPal is unavailable, the simulated fallback still completes the demo.
- Licensed under MIT.
