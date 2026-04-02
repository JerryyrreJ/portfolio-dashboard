import type { Portfolio, Transaction } from '@prisma/client'
import prisma, { withRetry } from '@/lib/prisma'

export type PersonalDataState = 'ready' | 'loading' | 'unavailable' | 'empty' | 'guest'

export interface PositionTransaction {
  id: string
  date: string
  type: string
  quantity: number
  price: number
  fee: number
  portfolioName: string
}

export interface PersonalPositionPayload {
  personalDataState: PersonalDataState
  totalQty: number
  currentValue: number
  costBasis: number
  totalReturn: number
  totalReturnPercent: number
  totalDividend: number
  avgBuyPrice: number
  totalFees: number
  transactions: PositionTransaction[]
  portfolioId: string
  portfolioName: string
}

type StockTransaction = Transaction & { portfolio: Portfolio }

type PositionSummary = {
  totalQty: number
  totalCost: number
  totalFees: number
  totalDividend: number
  transactions: PositionTransaction[]
}

export function createEmptyPersonalPosition(
  state: PersonalDataState,
  context?: { portfolioId?: string; portfolioName?: string }
): PersonalPositionPayload {
  return {
    personalDataState: state,
    totalQty: 0,
    currentValue: 0,
    costBasis: 0,
    totalReturn: 0,
    totalReturnPercent: 0,
    totalDividend: 0,
    avgBuyPrice: 0,
    totalFees: 0,
    transactions: [],
    portfolioId: context?.portfolioId ?? '',
    portfolioName: context?.portfolioName ?? '',
  }
}

export function buildPositionSummary(transactions: StockTransaction[]): PositionSummary {
  return transactions.reduce<PositionSummary>(
    (summary, transaction) => {
      let nextQty = summary.totalQty
      let nextCost = summary.totalCost
      let nextDividend = summary.totalDividend

      if (transaction.type === 'BUY') {
        nextQty += transaction.quantity
        nextCost += transaction.price * transaction.quantity + transaction.fee
      } else if (transaction.type === 'SELL') {
        if (nextQty > 0) {
          const avgCost = nextCost / nextQty
          nextCost -= avgCost * transaction.quantity
        }
        nextQty -= transaction.quantity
      } else if (transaction.type === 'DIVIDEND') {
        nextDividend += transaction.price * transaction.quantity
      }

      return {
        totalQty: nextQty,
        totalCost: nextCost,
        totalFees: summary.totalFees + transaction.fee,
        totalDividend: nextDividend,
        transactions: [
          ...summary.transactions,
          {
            id: transaction.id,
            date: transaction.date.toISOString(),
            type: transaction.type,
            quantity: transaction.quantity,
            price: transaction.price,
            fee: transaction.fee,
            portfolioName: transaction.portfolio.name,
          },
        ],
      }
    },
    {
      totalQty: 0,
      totalCost: 0,
      totalFees: 0,
      totalDividend: 0,
      transactions: [],
    }
  )
}

export async function getDefaultPortfolioContext(userId: string, pid?: string) {
  const portfolio = pid
    ? await withRetry(() => prisma.portfolio.findFirst({ where: { id: pid, userId } }))
    : await withRetry(() => prisma.portfolio.findFirst({ where: { userId } }))

  return {
    portfolioId: portfolio?.id ?? '',
    portfolioName: portfolio?.name ?? '',
  }
}

export async function loadPersonalStockPosition(
  userId: string,
  ticker: string,
  currentPrice: number,
  pid?: string
): Promise<PersonalPositionPayload> {
  const [asset, defaultPortfolio] = await Promise.all([
    withRetry(() => prisma.asset.findUnique({
      where: { ticker },
      include: {
        transactions: {
          where: { portfolio: { userId } },
          include: { portfolio: true },
          orderBy: { date: 'desc' },
        },
      },
    })),
    getDefaultPortfolioContext(userId, pid),
  ])

  if (!asset) {
    return createEmptyPersonalPosition('empty', defaultPortfolio)
  }

  const chronoTransactions = [...asset.transactions].reverse()
  const positionSummary = buildPositionSummary(chronoTransactions)
  const { totalQty, totalCost, totalFees, totalDividend, transactions } = positionSummary
  const currentValue = currentPrice * totalQty
  const costBasis = totalCost
  const capitalGain = currentValue - costBasis
  const totalReturn = capitalGain + totalDividend
  const totalReturnPercent = costBasis > 0 ? (totalReturn / costBasis) * 100 : 0
  const avgBuyPrice = totalQty > 0 ? costBasis / totalQty : 0

  const portfolioContext = asset.transactions.length > 0
    ? {
        portfolioId: asset.transactions[0].portfolioId,
        portfolioName: asset.transactions[0].portfolio.name,
      }
    : defaultPortfolio

  return {
    personalDataState: transactions.length > 0 ? 'ready' : 'empty',
    totalQty,
    currentValue,
    costBasis,
    totalReturn,
    totalReturnPercent,
    totalDividend,
    avgBuyPrice,
    totalFees,
    transactions,
    portfolioId: portfolioContext.portfolioId,
    portfolioName: portfolioContext.portfolioName,
  }
}
