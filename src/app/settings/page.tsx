import SettingsClient from './SettingsClient';
import { getUser } from '@/lib/supabase-server';

export default async function SettingsPage() {
  const user = await getUser();

  return (
    <SettingsClient
      initialUser={user}
      initialPortfolios={[]}
    />
  );
}
