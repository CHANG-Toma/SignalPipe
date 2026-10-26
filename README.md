# SignalPipe

Personal TradingView → Tradovate webhook bridge (PickMyTrade alternative for a single user).

Receives TradingView alerts over HTTPS, maps message patterns (`buy 01`, `sell 01`, `close`…) to orders, and places them on Tradovate (`isAutomated: true`). Starts in **dry-run** mode.

## Stack

- Next.js 15 (App Router) + TypeScript
- PostgreSQL + Prisma
- NextAuth (credentials, single admin)
- Tailwind CSS
- Docker Compose (Postgres)

## Quick start (≈5 minutes)

### 1. Clone / open the project

```bash
cd SignalPipe
```

### 2. Environment

```bash
cp .env.example .env
```

Edit `.env` at least:

- `NEXTAUTH_SECRET` — long random string
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — your login
- `WEBHOOK_SECRET` — secret embedded in the TradingView webhook URL

### 3. Start Postgres

```bash
docker compose up -d
```

### 4. Install & migrate

```bash
npm install
npm run db:migrate
npm run db:seed
```

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Test a webhook with curl

Default mode is **dry-run**: parse + log, no order sent to Tradovate.

```bash
curl -X POST "http://localhost:3000/api/webhook/YOUR_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"buy 01\",\"symbol\":\"MNQ1!\",\"strategy\":{\"order\":{\"id\":\"test-001\",\"comment\":\"buy 01\"}}}"
```

Check **Logs** / **Overview** in the UI.

Sell example:

```bash
curl -X POST "http://localhost:3000/api/webhook/YOUR_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"sell 01\",\"strategy\":{\"order\":{\"id\":\"test-002\",\"comment\":\"sell 01\"}}}"
```

Unauthorized (wrong secret → 401):

```bash
curl -i -X POST "http://localhost:3000/api/webhook/wrong-secret" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"buy 01\"}"
```

## TradingView alert URL

```
https://YOUR_PUBLIC_HOST/api/webhook/YOUR_WEBHOOK_SECRET
```

Suggested JSON message body (customize in the alert dialog):

```json
{
  "message": "{{strategy.order.comment}}",
  "symbol": "{{ticker}}",
  "strategy": {
    "order": {
      "id": "{{strategy.order.id}}",
      "action": "{{strategy.order.action}}",
      "contracts": "{{strategy.order.contracts}}",
      "comment": "{{strategy.order.comment}}"
    }
  }
}
```

## Tradovate (demo → live)

1. Create API credentials in Tradovate (demo first).
2. Fill in `.env`:

   - `TRADOVATE_USERNAME` / `TRADOVATE_PASSWORD`
   - `TRADOVATE_CID` / `TRADOVATE_SEC` (if required by your app registration)
   - Account id / spec via Settings UI or `TRADOVATE_ACCOUNT_ID` / `TRADOVATE_ACCOUNT_SPEC`

3. In **Settings**:
   - Keep `tradovateEnv = demo`
   - Switch `tradingMode` from `dry-run` → `demo`
4. Only later: `tradingMode = live` + `tradovateEnv = live`

Official docs: [https://api.tradovate.com/](https://api.tradovate.com/)

Orders always send `isAutomated: true`.

## Safety

| Control | Behavior |
|--------|----------|
| `tradingMode=dry-run` | Parse + DB logs only |
| Kill switch | Ignores order routing |
| Rate limit | 60 req/min/IP on webhook |
| Secrets | Never shown in full in UI logs |

## npm scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` / `start` | Production build |
| `npm run db:migrate` | Prisma migrate (dev) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` | Admin user + default mappings |

## Deploy (VPS later)

Not automated in this repo. Outline for a typical VPS (e.g. OVH):

1. Reverse proxy (Caddy/Nginx) with HTTPS → `localhost:3000`
2. Postgres (Docker or managed)
3. `npm run build && npm start` (or PM2 / systemd)
4. Set production env vars (`NEXTAUTH_URL` = public HTTPS URL)
5. Point TradingView webhook to `https://your-domain/api/webhook/<secret>`

## Project layout

```
src/
  app/                 # UI + API routes
  components/          # Nav, KillSwitch, badges
  lib/                 # prisma, auth, settings, rate-limit
  modules/
    webhook/           # parse + idempotency
    tradovate/         # auth + placeorder client
    order/             # order router
prisma/                # schema + seed
```

## License

Private / personal use.
