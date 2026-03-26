export type HistoricalPricePoint = {
  date: string
  price: number
}

export function getPriceOnOrBefore(
  prices: HistoricalPricePoint[] | undefined,
  targetDate: string,
): number | null {
  if (!prices || prices.length === 0) return null

  let left = 0
  let right = prices.length - 1
  let candidateIndex = -1

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    const currentDate = prices[mid]?.date

    if (!currentDate) break

    if (currentDate <= targetDate) {
      candidateIndex = mid
      left = mid + 1
    } else {
      right = mid - 1
    }
  }

  return candidateIndex >= 0 ? prices[candidateIndex]?.price ?? null : null
}
