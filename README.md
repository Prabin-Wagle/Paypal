# ShopMate AI

**The shopping agent that cannot charge you.**

ShopMate AI turns a messy shopping brief into typed requirements, filters a verified
catalog, explains the trade-offs, and waits for an explicit human approval before a
PayPal Sandbox capture. The model can recommend; it cannot set a price or move money.

Built for the PayPal agentic-commerce hackathon.

---

## Stack

| Layer | Tech |
|---|---|
| Client | Vite, React 19, TypeScript, React Router, Framer Motion, Tailwind CSS v4, lucide-react |
| Server | Node.js, Express, TypeScript, `tsx` |
| Payments | PayPal Orders v2 REST API, PayPal React SDK v6 (`@paypal/react-paypal-js/sdk-v6`) |
| Product discovery | ShopMate verified catalog plus a separate live Channel3 page (`@channel3/sdk`) |
| Optional AI | OpenAI or Anthropic for intent extraction; deterministic parser is the fallback |

The app has three surfaces:

- `/` — editorial landing page with clickable demo briefs and both shopping paths.
- `/app` — ShopMate's 24-product verified collection, decision canvas, and PayPal Sandbox cart.
- `/discover` — separate live Channel3 product search, details, variants, and merchant offers.

---

## Quick start

```powershell
cd E:\paypal
npm run install:all
npm run dev
```

Open <http://localhost:5173>.

The server runs on <http://localhost:8787>. Vite proxies `/api` to it.

### Production build

```powershell
npm run build
npm start
```

The Express server serves `client/dist` when it exists, so the built app is available at
<http://localhost:8787>.

---

## PayPal Sandbox setup

The checkout works without credentials in **simulated sandbox** mode. To use the real
PayPal Orders v2 Sandbox flow, create a sandbox app and add its credentials.

### 1. Create the sandbox app

1. Sign in at <https://developer.paypal.com/dashboard/applications>.
2. Make sure the **Sandbox** toggle is selected.
3. **Apps & Credentials → Sandbox → Create App**.
4. Choose **Merchant**, name it `ShopMate AI`, and create it.
5. Copy the **Client ID** and **Secret** (Secret is behind **Show**).

### 2. Add the server env file

Create `server/.env`:

```env
PAYPAL_CLIENT_ID=AXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PAYPAL_CLIENT_SECRET=ELxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PAYPAL_ENV=sandbox
CHANNEL3_API_KEY=your-channel3-api-key
PORT=8787
```

Notes:

- No quotes and no spaces around `=`.
- Use **Sandbox** credentials, not Live.
- The client only receives the public Client ID from `GET /api/config`. The secret stays
  on the Express server.
- `server/.env` is gitignored. Never commit it or ship it in a submission zip.

### 3. Restart the server

The env file is read at startup, so restart `npm run dev` after editing it. The server
log should show:

```text
PayPal: sandbox credentials loaded
```

`GET /api/config` should return `"paypalConfigured": true`.

### 4. Create a sandbox buyer

The merchant app credentials are not the buyer login. In the PayPal dashboard:

1. **Sandbox → Accounts**.
2. Confirm there is a **Personal** account with a positive USD balance, or create one.
3. Use that account's email and password when the PayPal approval popup opens.

The checkout uses the PayPal React SDK v6 with `environment="sandbox"`; Sandbox tests
set `testBuyerCountry="US"` using the v6 API. Production uses `environment="production"`
and does not set a test country. PayPal's REST setup guide says a PayPal Business account
is required to test integrations outside the US, so matching app credentials alone may
not be enough for an account registered elsewhere.

Do **not** use the merchant account that owns the sandbox app as the buyer. PayPal
rejects self-payment with:

> This PayPal account is associated with the merchant you're trying to pay.

The popup is the real human boundary. Nothing is captured until the buyer approves.

---

## Channel3 product data and live offers

Add `CHANNEL3_API_KEY` to `server/.env`. The standalone `/discover` page uses Channel3
agentic search for live laptops, headphones, and smartphones. Category shortcuts start
useful searches, and free-text queries accept another product brief. Each result has a
**Product details** view backed by a fresh Channel3 lookup. It shows product images,
description, category, key features, structured attributes, ratings, variant options, and
current merchant offers. Selecting a different variant can refresh the offer list.

ShopMate keeps the two purchase paths on separate pages. The existing `/app` verified
collection and server-priced PayPal Orders v2 Sandbox checkout remain intact. Channel3
products live on `/discover`; retailer offers open the merchant site, and their prices never
enter the ShopMate PayPal cart or capture request.

The API key stays on the Express server. `GET /api/config` exposes only a configured
status flag, never the key. Restart the server after changing it; the startup log also
reports status without printing the value. Search requests use `POST /api/channel3/search`;
fresh product and variant detail lookups use `POST /api/channel3/products/:productId`.

### Simulated fallback

If credentials are missing, invalid, or the sandbox is unavailable, the app stays usable:

- The checkout drawer shows **Simulated sandbox**.
- If credentials are configured, the drawer shows a **PayPal sandbox / Simulated** toggle.
- Simulated mode uses the header `x-shopmate-payment-mode: simulated`, so the strict
  `{ productIds, sessionId }` request body contract is preserved.

---

## Demo script

1. Open `/`.
2. Click a starter brief — for example **Programming laptop** or **The two-item bundle**.
   The app opens preloaded and runs the agent pipeline automatically.
3. Watch the four-step pipeline: extract → filter → evaluate → ready for approval.
4. Inspect the extracted requirement pills. Remove one (for example the battery minimum)
   to see the server re-filter the catalog.
5. Try the quick pivots: **Cheaper**, **Lightest**, **Bundle demo**, **Compare table**,
   **Start over**.
6. Add a product or **Add both** for a bundle.
7. In the sticky checkout drawer, verify the server total and the audit strip.
8. Choose **PayPal sandbox** (if configured) and approve in the PayPal popup, or choose
   **Simulated** to exercise the fallback.
9. The receipt shows the Order ID, Capture ID, `COMPLETED` status, timestamp, payer,
   quick-start tips, and warranty text.

### Demo briefs

- Programming laptop under $700, 16GB RAM, strong battery for VS Code
- Wireless headphones for studying under $100, top comfort & ANC
- Simple smartphone for my mother under $250, big battery & great camera
- Bundle: Programming laptop + ANC study headphones under $750 total

---

## The trust layer

The important boundary is between the browser and the server.

### 1. The browser never sends a price

`POST /api/orders/create` accepts only:

```json
{ "productIds": ["lap-001", "hp-001"], "sessionId": "sm_..." }
```

If the body contains `price`, `amount`, `total`, `currency`, or `unit_amount`, the server
returns HTTP 400:

> Client-supplied pricing is rejected by the trust layer. Send productIds only; the
> server reads price_usd from catalog.json.

### 2. The server re-prices from the catalog

The server looks up every SKU in `server/data/catalog.json`, rejects unknown or
out-of-stock products, recomputes the total, and sends that amount to PayPal. The
response includes an audit object showing the source and `client_price_accepted: false`.
The v6 payment component receives the server-created `orderId`; after buyer approval,
the server captures the order and verifies its completed amount and currency against its
own ledger.

### 3. PayPal must return COMPLETED

`POST /api/orders/capture` captures the PayPal order, verifies the returned status is
`COMPLETED`, and verifies the captured amount and currency match the server's ledger
entry. A mismatch withholds the receipt and returns HTTP 409. Captures use a stable
PayPal request ID so retries do not create duplicate captures. Orders and receipts are
persisted in the gitignored `server/data/transactions.json`; a repeated request returns
the existing receipt with `already_captured: true`.

### 4. Human approval is explicit

The model cannot trigger a capture. The UI requires a click on the PayPal button or the
simulated approval modal. The server also records the approval in the receipt audit
trail.

### 5. Recommendations are grounded

`server/services/catalogSearch.ts` performs deterministic filtering and scoring. Every
"why we recommend it" line and "known compromise" comes from catalog fields. Optional
LLM intent extraction is validated and clamped; if no key is configured, the
deterministic parser handles every demo prompt.

---

## API

| Method | Route | Purpose |
|---|---|---|
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
| `POST` | `/api/channel3/products/:productId` | Fresh product details, variant, and offer lookup |

---

## Project structure

```text
E:\paypal
├─ client/
│  ├─ public/products/          # 24 local product images
│  └─ src/
│     ├─ components/landing/    # Brand, PromptStarter, PreviewCard, TrustLayer, Architecture
│     ├─ components/workspace/  # AgentPanel, ProductCard, SpecTable, CheckoutDrawer, ReceiptView
│     ├─ lib/                   # api, types, format, demo prompts, specs
│     ├─ pages/                 # Landing, Workspace, Channel3Shop, CartPage
│     └─ index.css              # design tokens and all layout/responsive styles
├─ server/
│  ├─ data/catalog.json         # 24 verified SKUs
│  ├─ routes/                   # agent, orders
│  ├─ services/                 # agentPipeline, catalogSearch, intent, recommendation,
│  │                            # paypalClient, transactionStore
│  ├─ .env.example
│  └─ index.ts
├─ .gitignore
├─ package.json
└─ README.md
```

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `PAYPAL_CLIENT_ID` | For real sandbox | Public sandbox app client ID |
| `PAYPAL_CLIENT_SECRET` | For real sandbox | Server-only secret |
| `PAYPAL_ENV` | No | `sandbox` (default) or `live` |
| `PORT` | No | Express port, default `8787` |
| `OPENAI_API_KEY` | No | Optional LLM intent extraction |
| `OPENAI_MODEL` | No | Default `gpt-4o-mini` |
| `ANTHROPIC_API_KEY` | No | Optional LLM intent extraction |
| `ANTHROPIC_MODEL` | No | Default `claude-3-5-haiku-latest` |

Do not set `PAYPAL_ENV=live` for the demo unless you intend real charges.

---

## Troubleshooting

**The PayPal button does not appear.**
Check `server/.env`, restart the server, and confirm `GET /api/config` returns
`"paypalConfigured": true` and a non-null `paypalClientId`.

**The PayPal popup opens but login fails.**
Use a **Sandbox → Accounts → Personal** buyer, not your PayPal developer account.

**PayPal login succeeds but the review page says "PayPal isn't available at this time."**
Confirm the app is using the Sandbox client ID with `PAYPAL_ENV=sandbox`, and use a
separate Personal Sandbox buyer with a positive balance. The checkout initializes the
v6 SDK for Sandbox and sets its documented `testBuyerCountry` option to `US`. PayPal
also says a Business account is required to test integrations outside the US. If the
error continues, check the displayed PayPal issue/debug ID and the server's `[PayPal]`
diagnostic line; the ID can be supplied to PayPal support. Matching Client ID and Secret
do not override Sandbox account or regional restrictions.

**PayPal says "This PayPal account is associated with the merchant you're trying to pay."**
You are logged in with the merchant account that owns the sandbox app. Log out of
`sandbox.paypal.com`, then log in with a different **Sandbox → Accounts → Personal**
buyer. The buyer must not be the merchant account.

**PayPal returns `invalid_client`.**
The credentials are from the Live tab or contain extra spaces. Re-copy the Sandbox
Client ID and Secret and restart.

**The approval popup is blocked.**
Allow popups for `localhost:5173`, or use the Simulated toggle to finish the demo.

**The server says "simulated sandbox (no credentials)" after adding `.env`.**
The env file is in the wrong directory or the server was not restarted. It must be
`E:\paypal\server\.env`.

**A receipt shows a `SIM-` order ID.**
That was a simulated capture. Switch the checkout toggle to **PayPal sandbox** and
approve through the PayPal popup for a real sandbox order and capture ID.

---

## Notes

- The catalog is local and deterministic. Prices are never generated by a model.
- Some product images are representative stand-ins for the catalog items; the footer
  notes this.
- `server/data/transactions.json` is a local demo ledger and is gitignored.
- The app is designed to keep working if PayPal is unavailable: the simulated fallback
  is always available.
#   P a y p a l  
 