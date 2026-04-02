import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createServerProfiler } from '@/lib/perf'
import { getUser } from '@/lib/supabase-server'
import { createEmptyPersonalPosition, loadPersonalStockPosition } from '@/lib/stock-personal-data'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await context.params
  const decodedTicker = decodeURIComponent(ticker).toUpperCase()
  const pid = request.nextUrl.searchParams.get('pid') ?? undefined
  const perf = createServerProfiler('api/assets.position.GET', `ticker=${decodedTicker}${pid ? ` pid=${pid}` : ''}`)

  try {
    const user = await perf.time('getUser', () => getUser())
    if (!user) {
      perf.flush('guest')
      return NextResponse.json(createEmptyPersonalPosition('guest'))
    }

    const asset = await perf.time('asset.findUnique', () => prisma.asset.findUnique({
      where: { ticker: decodedTicker },
      select: { lastPrice: true },
    }))

    if (!asset) {
      perf.flush(`user=${user.id} asset=missing`)
      return NextResponse.json(createEmptyPersonalPosition('empty'))
    }

    const position = await perf.time('loadPersonalStockPosition', () => loadPersonalStockPosition(
      user.id,
      decodedTicker,
      asset.lastPrice || 0,
      pid
    ))

    perf.flush(`user=${user.id} state=${position.personalDataState} tx=${position.transactions.length}`)
    return NextResponse.json(position)
  } catch (error) {
    console.error(`Failed to load personal stock position for ${decodedTicker}:`, error)
    perf.flush('error')
    return NextResponse.json(createEmptyPersonalPosition('unavailable'), { status: 500 })
  }
}
