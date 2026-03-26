import { absoluteUrl, getHomePageJsonLd, siteConfig } from "@/lib/site";
import type { Metadata } from "next";
import HeroSection from "./components/landing/HeroSection";

export const metadata: Metadata = {
  title: "Portfolio Tracker for Stocks, Dividends, and Transactions",
  description: siteConfig.description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${siteConfig.name} Portfolio Tracker`,
    description: siteConfig.description,
    url: siteConfig.url,
    images: [
      {
        url: absoluteUrl("/icon"),
        width: 512,
        height: 512,
        alt: `${siteConfig.name} app icon`,
      },
    ],
  },
};

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-page text-primary selection:bg-primary selection:text-on-primary">
      <HeroSection />
    </main>
  );
}
