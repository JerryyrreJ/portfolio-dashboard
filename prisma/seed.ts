import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log(`Start seeding ...`)

  // 1. Create Portfolio
  const portfolio = await prisma.portfolio.create({
    data: {
      name: 'IBKR Account',
      currency: 'USD',
    },
  })

  console.log(`Created Portfolio: ${portfolio.name}`)

  // 2. Create Assets
  const amd = await prisma.asset.create({
    data: { ticker: 'AMD', name: 'Advanced Micro Devices Inc.', market: 'NASDAQ', type: 'STOCK' }
  })
  
  const goog = await prisma.asset.create({
    data: { ticker: 'GOOG', name: 'Alphabet Inc - Ordinary Shares - Class C', market: 'NASDAQ', type: 'STOCK' }
  })

  const ewy = await prisma.asset.create({
    data: { ticker: 'EWY', name: 'iShares MSCI South Korea ETF', market: 'NYSE', type: 'ETF' }
  })

  const xiacy = await prisma.asset.create({
    data: { ticker: 'XIACY', name: 'Xiaomi Corporation - ADR', market: 'OTC', type: 'STOCK' }
  })

  console.log(`Created Assets: ${amd.ticker}, ${goog.ticker}, ${ewy.ticker}, ${xiacy.ticker}`)

  // 3. Create Transactions (simulate historical buys)
  // AMD: 1 share
  await prisma.transaction.create({
    data: {
      portfolioId: portfolio.id, assetId: amd.id, type: 'BUY',
      date: new Date('2025-10-18T10:00:00Z'), quantity: 1, price: 214.48, fee: 1.00
    }
  })

  // GOOG: 0.3402 shares
  await prisma.transaction.create({
    data: {
      portfolioId: portfolio.id, assetId: goog.id, type: 'BUY',
      date: new Date('2025-11-15T10:00:00Z'), quantity: 0.3402, price: 300.00, fee: 0.50
    }
  })

  // EWY: 1 share
  await prisma.transaction.create({
    data: {
      portfolioId: portfolio.id, assetId: ewy.id, type: 'BUY',
      date: new Date('2025-12-10T10:00:00Z'), quantity: 1, price: 140.35, fee: 1.00
    }
  })

  // XIACY: 3 shares
  await prisma.transaction.create({
    data: {
      portfolioId: portfolio.id, assetId: xiacy.id, type: 'BUY',
      date: new Date('2026-01-20T10:00:00Z'), quantity: 3, price: 29.78, fee: 1.00
    }
  })

  console.log(`Created Transactions for Portfolio.`)
  console.log(`Seeding finished.`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })