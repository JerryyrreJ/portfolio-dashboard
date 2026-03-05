# Gemini Project Context: Portfolio Dashboard

## Project Overview

A Next.js-based stock portfolio management dashboard with real-time stock price tracking, position analysis, and transaction management.

**Key Technologies:**
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- SQLite + Prisma ORM
- Recharts (Charts)
- Finnhub API (Stock Data)

## Architecture

### Directory Structure
```
src/
├── app/                      # Next.js App Router
│   ├── api/                 # API Routes
│   │   ├── assets/         # Asset management APIs
│   │   └── transactions/   # Transaction CRUD APIs
│   ├── components/         # Reusable components
│   │   └── AddTransactionModal.tsx
│   ├── stock/[ticker]/     # Stock detail page
│   │   ├── page.tsx        # Server component
│   │   └── StockDetailClient.tsx
│   ├── transactions/       # Transaction history page
│   ├── page.tsx            # Dashboard (Home)
│   └── layout.tsx
├── lib/
│   └── finnhub.ts          # Finnhub API client
└── hooks/
    └── useStock.ts         # Stock data hooks
```

### Database Schema (Prisma)

```prisma
model Portfolio {
  id          String   @id @default(cuid())
  name        String
  currency    String   @default("USD")
  transactions Transaction[]
}

model Asset {
  id          String   @id @default(cuid())
  ticker      String   @unique
  name        String
  market      String
  type        String   @default("STOCK")
  currency    String   @default("USD")
  transactions Transaction[]
}

model Transaction {
  id          String   @id @default(cuid())
  portfolioId String
  assetId     String
  type        String   // "BUY" | "SELL"
  date        DateTime
  quantity    Float
  price       Float
  fee         Float    @default(0)
  portfolio   Portfolio @relation(fields: [portfolioId], references: [id])
  asset       Asset     @relation(fields: [assetId], references: [id])
}
```

## Key Features

### 1. Stock Detail Page (`/stock/[ticker]`)
- Real-time price display with change indicators
- Interactive price chart (time range: 1M/3M/6M/1Y/3Y/ALL)
- Position summary: current value, cost basis, total return, avg buy price
- Transaction history with delete functionality
- Uses Finnhub API for real-time and historical data

### 2. Dashboard (`/`)
- Portfolio overview with market value distribution
- Holdings grouped by market (NASDAQ/NYSE/OTC)
- Real-time P&L calculation
- Interactive area chart showing portfolio value over time

### 3. Transaction Management
- Add transactions (BUY/SELL) via modal
- Delete transactions with confirmation
- Transaction history page with filtering
- Automatic position recalculation after CRUD operations

## API Endpoints

### Assets
- `GET /api/assets` - List all assets
- `POST /api/assets` - Create new asset
- `GET /api/assets/lookup?ticker=X` - Lookup asset by ticker

### Transactions
- `GET /api/transactions` - List transactions (optionally filtered by portfolioId)
- `POST /api/transactions` - Create new transaction
- `DELETE /api/transactions/[id]` - Delete transaction

## Environment Variables

```env
DATABASE_URL=file:./prisma/dev.db
FINNHUB_API_KEY=your_finnhub_api_key
```

## Important Implementation Details

### Type Safety
- All IDs are strings (CUID) - not numbers
- Transaction type is strictly typed as `"BUY" | "SELL"`
- All API responses are typed

### Data Fetching
- Server components fetch data directly via Prisma
- Client components receive data as props
- Finnhub API is called server-side for real-time prices

### Error Handling
- API routes return proper error responses
- UI handles loading and error states
- Fallback prices used when API fails

### State Management
- React hooks for local state
- No global state management (Redux/Zustand) needed
- Real-time updates via page refresh or server-side revalidation

## Development Commands

```bash
# Development
npm run dev

# Build
npm run build

# Database
npx prisma migrate dev
npx prisma db seed
npx prisma studio
```

---

Generated with Claude Code
