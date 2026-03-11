import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient()
}

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prisma ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma

// Supabase 免费版数据库会休眠，唤醒时连接会被关闭（P1017）。
// 此函数在遇到连接类错误时自动重试，避免页面直接崩溃。
const RETRYABLE_CODES = new Set(['P1017', 'P1001', 'P1002', 'P1008', 'P1011'])

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1500
): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      const code: string | undefined = err?.code
      if (code && RETRYABLE_CODES.has(code) && attempt < retries) {
        await new Promise(res => setTimeout(res, delayMs * attempt))
        lastError = err
      } else {
        throw err
      }
    }
  }
  throw lastError
}
