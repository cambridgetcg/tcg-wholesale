# TCG Wholesale — Price Feed & Order System

Wholesale ordering system for UK streamer clients. Sources cards from CardRush Japan (and alternatives), applies landing cost markup, and presents a GBP price feed for clients to order from.

## Business Flow

```
CardRush (JPY prices) → Landing Cost Calculator → GBP Price Feed → Client Orders
                                                                        ↓
                                          Stock Check (CardRush/alt) ← Admin Review
                                                                        ↓
                                                              Quote Confirmation → Payment → Fulfil
```

## Core Features

### 1. Price Feed
- Card number + name + GBP price (marked up from JPY source)
- Landing cost formula: `(JPY price × JPY/GBP rate) + shipping allocation + customs duty + margin`
- Searchable by card number, set, name
- Updated periodically from source

### 2. Client Ordering
- Client browses price feed
- Selects cards + quantities
- Submits order request (not a purchase — a quote request)

### 3. Admin: Stock Check & Quote
- Admin receives order request
- Checks stock on CardRush / alternatives
- Confirms availability + final quote (prices may shift)
- Sends quote to client

### 4. Payment & Fulfilment
- Client pays confirmed quote
- Admin places order with source
- Tracks shipment from Japan → UK
- Notifies client on arrival, arranges delivery

## Tech Stack

- **Frontend:** Next.js (simple, fast, SSR for SEO)
- **Backend:** Next.js API routes
- **Database:** SQLite (Drizzle ORM) — lightweight, no infra cost
- **Price Source:** CardRush scraper (with fallback to manual CSV upload)
- **FX Rate:** Bank of England or exchangerate.host API
- **Auth:** Simple invite-only (streamer clients get a link)
- **Hosting:** Vercel (free tier is plenty for this scale)

## Directory Structure

```
tcg-wholesale/
├── src/
│   ├── app/              # Next.js app router
│   │   ├── page.tsx      # Price feed (public or auth-gated)
│   │   ├── order/        # Order submission
│   │   ├── admin/        # Admin dashboard
│   │   └── api/          # API routes
│   ├── lib/
│   │   ├── pricing.ts    # Landing cost calculator
│   │   ├── scraper.ts    # CardRush price fetcher
│   │   ├── fx.ts         # JPY→GBP exchange rate
│   │   └── db.ts         # Database (Drizzle + SQLite)
│   └── components/       # UI components
├── drizzle/              # DB migrations
├── data/                 # Manual price CSV uploads (fallback)
├── .env.local            # API keys, FX source, margin config
└── package.json
```

## Landing Cost Formula

```
base_jpy       = CardRush price (JPY)
fx_rate        = JPY/GBP spot rate
base_gbp       = base_jpy × fx_rate
shipping       = per-card allocation from bulk shipping cost
customs        = base_gbp × duty_rate (if applicable)
margin         = base_gbp × margin_pct
final_gbp      = base_gbp + shipping + customs + margin
```

Config variables (in .env or admin panel):
- `MARGIN_PCT` — default markup percentage
- `SHIPPING_PER_CARD` — allocated shipping cost per card
- `CUSTOMS_DUTY_RATE` — import duty rate (0% for most TCG under £135?)
- `FX_BUFFER` — extra % on FX rate to absorb volatility
