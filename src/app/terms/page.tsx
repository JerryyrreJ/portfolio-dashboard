import type { Metadata } from "next";
import LegalPage from "../components/landing/LegalPage";
import { absoluteUrl, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for using Folio, a personal portfolio tracker provided as-is.",
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    title: "Terms of Service | Folio",
    description: "Terms for using Folio, a personal portfolio tracker provided as-is.",
    url: absoluteUrl("/terms"),
  },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      description="These terms cover personal use of Folio. They are written for a portfolio tracker, not a financial product."
    >
      <section className="space-y-3">
        <h2 className="text-[17px] font-bold tracking-tight text-primary">As-is use</h2>
        <p>
          Folio is provided as-is for personal portfolio tracking. You are responsible for the
          holdings, transactions, and other information you enter, and for any decisions you make
          with the numbers shown in the app.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[17px] font-bold tracking-tight text-primary">Not investment advice</h2>
        <p>
          Nothing in Folio is investment, tax, legal, or trading advice. Market prices, charts,
          returns, and other figures can be incomplete, delayed, or incorrect. Folio is not a
          broker, adviser, or exchange.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[17px] font-bold tracking-tight text-primary">No warranty</h2>
        <p>
          Folio makes no warranty that the service will be uninterrupted, error-free, or fit for a
          particular purpose. To the fullest extent allowed by law, Folio is not liable for losses
          arising from use of the product, missing data, or third-party market data.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[17px] font-bold tracking-tight text-primary">Changes</h2>
        <p>
          These terms may change as Folio evolves. Continued use after an update means you accept
          the revised terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[17px] font-bold tracking-tight text-primary">Contact</h2>
        <p>
          Questions about these terms can be sent to{" "}
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
