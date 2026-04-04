import type { AbstractIntlMessages } from 'next-intl';
import { NextIntlClientProvider } from 'next-intl';

import DashboardClient from '@/app/DashboardClient';

type DashboardPageShellProps = {
  locale: string;
  messages: AbstractIntlMessages;
  dashboardProps: React.ComponentProps<typeof DashboardClient>;
};

export default function DashboardPageShell({
  locale,
  messages,
  dashboardProps,
}: DashboardPageShellProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <DashboardClient {...dashboardProps} />
    </NextIntlClientProvider>
  );
}
