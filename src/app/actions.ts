'use server'

import { revalidatePath } from 'next/cache'

import prisma from '@/lib/prisma'

export async function addTransaction(formData: FormData) {
  const portfolioName = formData.get('portfolioName') as string
  const ticker = (formData.get('ticker') as string).toUpperCase()
  const type = formData.get('type') as string
  const dateStr = formData.get('date') as string
  const quantity = parseFloat(formData.get('quantity') as string)
  const price = parseFloat(formData.get('price') as string)
  const fee = parseFloat(formData.get('fee') as string) || 0

  if (!ticker || !type || !dateStr || isNaN(quantity) || isNaN(price)) {
    throw new Error('Invalid form data')
  }

  // 1. 查找对应的 Portfolio
  const portfolio = await prisma.portfolio.findFirst({
    where: { name: portfolioName }
  })

  if (!portfolio) {
    throw new Error("Portfolio not found")
  }

  // 2. 查找 Asset (如果没有，则自动创建一个基础版本的 Asset，模拟真实股票搜索)
  let asset = await prisma.asset.findUnique({
    where: { ticker: ticker }
  })

  if (!asset) {
    asset = await prisma.asset.create({
      data: {
        ticker: ticker,
        name: `${ticker} (User Added)`,
        market: 'OTHER', // 默认分配给 OTHER，如果是正式版可以对接外部 API 补全
        type: 'STOCK'
      }
    })
  }

  // 3. 写入新的 Transaction 记录
  await prisma.transaction.create({
    data: {
      portfolioId: portfolio.id,
      assetId: asset.id,
      type: type,
      date: new Date(dateStr),
      quantity: quantity,
      price: price,
      fee: fee,
      currency: 'USD'
    }
  })

  // 4. 通知 Next.js 重新获取并计算首页的数据 (热更新)
  revalidatePath('/')
}
