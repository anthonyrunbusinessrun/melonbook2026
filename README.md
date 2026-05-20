# MelonOps — Raymon J Land Internal Operations System

Internal operations platform for Raymon J Land Watermelon Sales & Land Truck Brokers, Branford FL.

**Stack:** Next.js 14 App Router · TypeScript · PostgreSQL (Railway) · Airtable Bidirectional Sync

---

## Quick Start

```bash
git clone https://github.com/anthonyrunbusinessrun/melonbook2026
cd melonbook2026
npm install
cp .env.example .env.local  # fill in your values
npm run db:migrate
npm run db:seed
npm run dev
```

**Default Credentials (after seed):**
- admin@raymonjland.com / Admin2026! (Admin)
- accounting@raymonjland.com / Acctg2026! (Accounting)
- sales@raymonjland.com / Sales2026! (Sales/Logistics)

## Railway Deploy

```bash
railway up
railway run npm run db:migrate
railway run npm run db:seed
```

**Required env vars:** DATABASE_URL, AIRTABLE_API_KEY, AIRTABLE_BASE_ID=appmnU55C5f7A50U4, NEXTAUTH_SECRET, NEXTAUTH_URL

## AR Report Logic

Replicates the 2026 AR Spreadsheet.xlsx:
```
Total Invoiced = Invoiced + Invoice Credits
Balance Due = Total Invoiced + Unloading Fee + Adjustments - Amount Paid
```
Account 1152 = AR (invoiced), Account 1122 = Undeposited Funds (paid).
Export at `/api/ar/export` — matches legacy Excel layout.

## Sync Architecture

- **AT→PG:** Webhook + 15min scheduled sync, field hash change detection, latest-edit-wins conflicts
- **PG→AT:** Outbox trigger → background worker every 30s, exponential backoff, origin marker to prevent loops

See [docs/AIRTABLE_SCHEMA.md](./docs/AIRTABLE_SCHEMA.md) for full field inventory.
