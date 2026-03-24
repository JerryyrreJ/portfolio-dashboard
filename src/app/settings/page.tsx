import SettingsClient from './SettingsClient';
import prisma, { withRetry } from '@/lib/prisma';
import { getUser } from '@/lib/supabase-server';

export default async function SettingsPage() {
  const user = await getUser();

  let initialPortfolios: any[] = [];

  if (user) {
    initialPortfolios = await withRetry(() => prisma.portfolio.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    }));

    if (initialPortfolios.length === 0) {
      const created = await withRetry(() => prisma.portfolio.create({
        data: { userId: user.id, name: 'My Portfolio' },
      }));
      initialPortfolios = [created];
    }
  }

  return (
    <SettingsClient
      initialUser={user}
      initialPortfolios={initialPortfolios}
    />
  );
}
