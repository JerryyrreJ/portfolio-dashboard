import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient()
}

type PrismaClientInstance = ReturnType<typeof prismaClientSingleton>

const REQUIRED_DELEGATES = [
  'portfolio',
  'asset',
  'assetPriceHistory',
  'indexPriceHistory',
  'transaction',
  'pendingDividend',
  'rateLimitCounter',
] as const satisfies readonly (keyof PrismaClientInstance)[]

function hasRequiredDelegates(client: PrismaClientInstance) {
  return REQUIRED_DELEGATES.every((delegate) => typeof client[delegate]?.findMany === 'function')
}

declare global {
  var prisma: undefined | PrismaClientInstance
}

const cachedPrisma = globalThis.prisma
const prisma = cachedPrisma && hasRequiredDelegates(cachedPrisma)
  ? cachedPrisma
  : prismaClientSingleton()

if (cachedPrisma && prisma !== cachedPrisma) {
  console.warn('[Prisma] Recreated PrismaClient because the cached dev singleton was generated from an older schema.')
}

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma

// Supabase 免费版数据库会休眠，唤醒时连接会被关闭（P1017）。
// 此函数在遇到连接类错误时自动重试，避免页面直接崩溃。
const RETRYABLE_CODES = new Set(['P1017', 'P1001', 'P1002', 'P1008', 'P1011', 'P2024'])

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 5,
  delayMs = 1500
): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const prismaError = err as { code?: string; message?: string }
      const code: string | undefined = prismaError.code
      const message: string = prismaError.message || ''
      const isRetryableError = (code && RETRYABLE_CODES.has(code)) || 
                                message.includes('Can\'t reach database server') ||
                                message.includes('Connection closed') ||
                                message.includes('fetch failed')

      if (isRetryableError && attempt < retries) {
        console.warn(`[Prisma Retry] Attempt ${attempt} failed with ${code || 'network error'}, retrying in ${delayMs * attempt}ms...`)
        await new Promise(res => setTimeout(res, delayMs * attempt))
        lastError = err
      } else {
        throw err
      }
    }
  }
  throw lastError
}
