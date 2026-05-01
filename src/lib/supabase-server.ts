import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createServerProfiler } from '@/lib/perf'

interface NetworkLikeError {
  message?: string
  cause?: { code?: string }
  __isAuthError?: boolean
}

type ServerProfilerLike = {
  time<T>(label: string, operation: () => Promise<T>): Promise<T>
}

export async function createSupabaseServerClient(profiler?: ServerProfilerLike) {
  const cookieStore = profiler
    ? await profiler.time('cookies', () => cookies())
    : await cookies()

  return profiler
    ? profiler.time('createServerClient', async () => createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Called from a Server Component — safe to ignore
            }
          },
        },
      }
    ))
    : createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Called from a Server Component — safe to ignore
            }
          },
        },
      }
    )
}

export async function getUser() {
  return getUserWithOptions();
}

export async function getUserWithOptions(options?: {
  retries?: number;
  delayMs?: number;
}) {
  const perf = createServerProfiler('supabase.getUser')
  const retries = Math.max(1, options?.retries ?? 3)
  const delayMs = options?.delayMs ?? 1500
  try {
    const supabase = await createSupabaseServerClient(perf)

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const { data: { user } } = await perf.time(`auth.getUser#${attempt}`, () => supabase.auth.getUser())
        perf.flush(`result=${user ? 'user' : 'null'} attempt=${attempt}`)
        return user
      } catch (err: unknown) {
        const error = err as NetworkLikeError
        const isNetworkError = error.message?.includes('fetch failed') ||
          error.cause?.code === 'ECONNREFUSED' ||
          error.cause?.code === 'ECONNRESET' ||
          error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
          error.__isAuthError === true
        if (isNetworkError && attempt < retries) {
          const retryDelayMs = delayMs * attempt
          await perf.time(`retryDelay#${attempt}`, () => new Promise<void>(res => setTimeout(res, retryDelayMs)))
        } else {
          console.warn('getUser failed after retries:', error.message)
          perf.flush(`result=error attempt=${attempt}`)
          return null
        }
      }
    }
    perf.flush(`result=null attempts=${retries}`)
    return null
  } catch (error) {
    perf.flush('result=throw')
    throw error
  }
}
