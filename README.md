# Folio

A personal portfolio tracker for holdings, transactions, dividends, and stock performance.

Live site: [https://folio.jerrylu.xyz](https://folio.jerrylu.xyz)

Public REST import (API keys, dry-run preview, bulk trades): [docs/api-transactions.md](docs/api-transactions.md).

## Getting Started

### Prerequisites
- Node.js 20+
- npm or pnpm

### Environment Setup
Copy `.env.example` to `.env` and fill in the keys you need:

```env
NEXT_PUBLIC_APP_URL="https://folio.jerrylu.xyz"
DATABASE_URL="file:./prisma/dev.db"
FINNHUB_API_KEY="your_api_key_here"
```

`NEXT_PUBLIC_APP_URL` is the canonical site origin used for metadata, Open Graph, sitemap, robots, and JSON-LD. Keep it pointed at `https://folio.jerrylu.xyz` in production.

### Installation
```bash
npm install
```

### Database Initialization
```bash
npx prisma migrate dev --name init
npx prisma db seed
```

### Development
```bash
npm run dev
```

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **Database**: SQLite + Prisma ORM
- **Charts**: Recharts
- **API**: Finnhub Stock API

## Deployment
This project is ready to be deployed on **Vercel**. Ensure you add `NEXT_PUBLIC_APP_URL`, `FINNHUB_API_KEY`, and `DATABASE_URL` to your environment variables.

For production SQLite usage on Vercel, consider migrating to **Supabase (PostgreSQL)** or **Neon** as Vercel's filesystem is ephemeral.

## License
MIT
