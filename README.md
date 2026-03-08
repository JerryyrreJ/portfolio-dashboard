# Portfolio Dashboard

A modern, high-performance stock portfolio management dashboard built with Next.js 15, TypeScript, and Prisma.

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- npm or pnpm

### Environment Setup
Create a `.env` file in the root:
```env
DATABASE_URL="file:./prisma/dev.db"
FINNHUB_API_KEY="your_api_key_here"
```

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

## 🛠️ Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **Database**: SQLite + Prisma ORM
- **Charts**: Recharts
- **API**: Finnhub Stock API

## 📦 Deployment
This project is ready to be deployed on **Vercel**. Ensure you add the `FINNHUB_API_KEY` and `DATABASE_URL` to your Vercel Environment Variables.

For production SQLite usage on Vercel, consider migrating to **Supabase (PostgreSQL)** or **Neon** as Vercel's filesystem is ephemeral.

## 📝 License
MIT
