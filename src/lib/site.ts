export const siteConfig = {
  name: "Folio",
  shortName: "Folio",
  url: "https://folio.jerrylu.app",
  description:
    "Folio is a portfolio tracker for monitoring holdings, transactions, dividends, and stock performance in one place.",
  locale: "en_US",
  organizationName: "Folio",
};

export function absoluteUrl(path: string) {
  return new URL(path, siteConfig.url).toString();
}

export function getSiteJsonLd() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${siteConfig.url}/#website`,
      name: siteConfig.name,
      url: siteConfig.url,
      description: siteConfig.description,
      inLanguage: "en",
      publisher: {
        "@id": `${siteConfig.url}/#organization`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${siteConfig.url}/#organization`,
      name: siteConfig.organizationName,
      url: siteConfig.url,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/icon"),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "@id": `${siteConfig.url}/#application`,
      name: siteConfig.name,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      url: siteConfig.url,
      description: siteConfig.description,
      publisher: {
        "@id": `${siteConfig.url}/#organization`,
      },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  ];
}

export function getHomePageJsonLd() {
  const pageUrl = siteConfig.url;

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${pageUrl}/#webpage`,
      url: pageUrl,
      name: `${siteConfig.name} Portfolio Tracker`,
      description: siteConfig.description,
      inLanguage: "en",
      isPartOf: {
        "@id": `${siteConfig.url}/#website`,
      },
      about: {
        "@id": `${siteConfig.url}/#application`,
      },
      breadcrumb: {
        "@id": `${pageUrl}/#breadcrumb`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "@id": `${pageUrl}/#breadcrumb`,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: pageUrl,
        },
      ],
    },
  ];
}

type StockPageJsonLdInput = {
  ticker: string;
  name: string;
  description: string;
  exchange?: string | null;
  issuerUrl?: string | null;
};

export function getStockPageJsonLd({
  ticker,
  name,
  description,
  exchange,
  issuerUrl,
}: StockPageJsonLdInput) {
  const pageUrl = absoluteUrl(`/stock/${encodeURIComponent(ticker)}`);
  const issuerId = `${pageUrl}#issuer`;

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${pageUrl}#webpage`,
      url: pageUrl,
      name: `${name} (${ticker}) Stock Overview`,
      description,
      inLanguage: "en",
      isPartOf: {
        "@id": `${siteConfig.url}/#website`,
      },
      about: {
        "@id": issuerId,
      },
      breadcrumb: {
        "@id": `${pageUrl}#breadcrumb`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "@id": `${pageUrl}#breadcrumb`,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: siteConfig.url,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: `${name} (${ticker})`,
          item: pageUrl,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": issuerId,
      name,
      ...(issuerUrl ? { url: issuerUrl } : {}),
      ...(exchange ? { description: `Listed on ${exchange}` } : {}),
      identifier: ticker,
    },
  ];
}
