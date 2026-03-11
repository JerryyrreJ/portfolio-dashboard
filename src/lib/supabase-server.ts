import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
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
  const supabase = await createSupabaseServerClient()

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      return user
    } catch (err: any) {
      const isNetworkError = err?.message?.includes('fetch failed') ||
        err?.cause?.code === 'ECONNREFUSED' ||
        err?.cause?.code === 'ECONNRESET' ||
        err?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        err?.__isAuthError === true
      if (isNetworkError && attempt < 3) {
        await new Promise(res => setTimeout(res, 1500 * attempt))
      } else {
        console.warn('getUser failed after retries:', err?.message)
        return null
      }
    }
  }
  return null
}
