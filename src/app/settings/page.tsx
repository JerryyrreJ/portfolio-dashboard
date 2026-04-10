import SettingsClient from './SettingsClient';
import { createServerProfiler } from '@/lib/perf';
import prisma, { withRetry } from '@/lib/prisma';
import { getUser } from '@/lib/supabase-server';

export default async function SettingsPage() {
  const perf = createServerProfiler('settings/page');
  const user = await perf.time('supabase.getUser.page', () => getUser());
  const initialPortfolios = user
    ? await perf.time('portfolio.findMany', () => withRetry(() => prisma.portfolio.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          currency: true,
          preferences: true,
          settingsUpdatedAt: true,
        },
      })))
    : [];
  const serializedPortfolios = initialPortfolios.map((portfolio) => ({
    ...portfolio,
    settingsUpdatedAt: portfolio.settingsUpdatedAt?.toISOString() ?? null,
  }));

  perf.flush(user ? `user=${user.id} rows=${serializedPortfolios.length}` : 'guest');
  return (
    <SettingsClient
      initialUser={user}
      initialPortfolios={serializedPortfolios}
    />
  );
}
