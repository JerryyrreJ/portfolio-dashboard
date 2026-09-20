import type { Metadata } from "next";
import LegalPage from "../components/landing/LegalPage";
import { absoluteUrl, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Folio handles personal portfolio data, market quotes, and contact information.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Privacy | Folio",
    description: "How Folio handles personal portfolio data, market quotes, and contact information.",
    url: absoluteUrl("/privacy"),
  },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      description="Folio is a personal portfolio tracker. This page explains what may be stored when you use the product."
    >
      <section className="space-y-3">
        <h2 className="text-[17px] font-bold tracking-tight text-primary">What Folio is</h2>
        <p>
          Folio helps you record holdings, transactions, dividends, and performance for your own
          portfolios. It is not a brokerage, bank, or public company product.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[17px] font-bold tracking-tight text-primary">Data that may be stored</h2>
        <p>Depending on how you use Folio, the following data may be stored:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Portfolio names, currencies, and display preferences.</li>
          <li>Transaction history such as buys, sells, fees, quantities, and dates.</li>
          <li>Holdings derived from those transactions, including cost basis and dividend records.</li>
          <li>Account details if you sign in, such as an email address used for authentication and sync.</li>
          <li>Local-only data on your device if you use Folio without signing in.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-[17px] font-bold tracking-tight text-primary">How that data is used</h2>
        <p>
          Stored data is used to show your portfolios, calculate returns, sync across devices when
          you sign in, and keep the product working. Folio does not sell your data.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[17px] font-bold tracking-tight text-primary">Market data</h2>
        <p>
          Folio may request quotes, company profiles, logos, and price history from third-party
          market data APIs as needed to display current prices and charts. Those providers process
          the ticker symbols and related requests required to return that information.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[17px] font-bold tracking-tight text-primary">Contact</h2>
        <p>
          Questions about this privacy page can be sent to{" "}
          <a
            href={`mailto:${siteConfig.contactEmail}`}
            className="font-semibold text-primary underline underline-offset-4"
          >
            {siteConfig.contactEmail}
          </a>
          .
        </p>
      </section>
    </LegalPage>
  );
}
