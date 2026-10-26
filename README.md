# SignalPipe

Personal TradingView → Tradovate automation bridge.

1. Link Tradovate account(s)
2. Map TradingView symbols → Tradovate contracts
3. Generate alert JSON + webhook URL
4. Paste into TradingView
5. Orders execute on Tradovate (`isAutomated: true`)

Default safety mode: **dry-run** (parse + log, no live orders).

## Stack

- Next.js 15 (App Router) + TypeScript
- PostgreSQL + Prisma
- NextAuth (single admin)
- Tailwind CSS
- Docker Compose (Postgres)

## Quick start

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — login with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Process (same every time)

1. **Accounts** — add Tradovate Account ID + Spec, set primary; map symbols (`MNQ1!` → front month)
2. Header — choose **Demo** or **Live**; keep `dry-run` until tested
3. **Generate alert** — Strategy or Indicator → exits (No SL/TP / Attach SL/TP) → accounts → Generate
4. Copy **Webhook URL** + **Alert JSON** into TradingView (Message = JSON only)
5. **Alerts log** — verify incoming webhooks and order attempts
6. **Pause** in the header to stop execution without deleting alerts

## Alert JSON fields

| Field | Role |
|--------|------|
| `data` | `buy` / `sell` / `close` (or `{{strategy.order.action}}`) |
| `quantity` | Contracts (or `{{strategy.order.contracts}}`) |
| `token` | Auth token (matches webhook secret) |
| `account_id` | Tradovate account |
| `multiple_accounts` | Extra accounts + multipliers |
| `reverse_order_close` | Flatten opposite / existing before entry |
| `pyramid` | Allow stacking same-direction positions |
| `same_direction_ignore` | Skip if already same side |
| `sl` / `tp` / `dollar_*` / `percentage_*` | Bracket levels via Tradovate OSO |
| `order_type` | `MKT` or `LMT` |

## Test webhook

```bash
curl -X POST "http://localhost:3000/api/webhook/YOUR_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"symbol\":\"MNQ1!\",\"data\":\"buy\",\"quantity\":1,\"risk_percentage\":0,\"token\":\"YOUR_WEBHOOK_SECRET\",\"account_id\":\"YOUR_ACCOUNT_ID\",\"reverse_order_close\":true,\"order_type\":\"MKT\",\"price\":21000,\"sl\":10,\"tp\":20}"
```

## Tradovate credentials

Add accounts in the **Accounts** UI with your Lucid username and password.
SignalPipe authenticates and imports account ID / spec automatically — nothing Tradovate-related belongs in `.env`.

Official API: [https://api.tradovate.com/](https://api.tradovate.com/)

## npm scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Dev server |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Admin + defaults |
| `npm run db:studio` | Prisma Studio |

## Deploy (VPS later)

HTTPS reverse proxy → app, Postgres, production env (`NEXTAUTH_URL` = public URL), TradingView webhook → that URL.
