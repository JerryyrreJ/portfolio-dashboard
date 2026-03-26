import type { MetadataRoute } from "next";
import prisma, { withRetry } from "@/lib/prisma";
import { siteConfig } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: MetadataRoute.Sitemap = [
    {
      url: siteConfig.url,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  try {
    const assets = await withRetry(() =>
      prisma.asset.findMany({
        select: {
          ticker: true,
          historyLastUpdated: true,
          lastPriceUpdated: true,
        },
        orderBy: { ticker: "asc" },
      })
    );

    return routes.concat(
      assets.map((asset) => ({
        url: `${siteConfig.url}/stock/${encodeURIComponent(asset.ticker)}`,
        lastModified:
          asset.lastPriceUpdated ?? asset.historyLastUpdated ?? new Date(),
        changeFrequency: "daily",
        priority: 0.8,
      }))
    );
  } catch (error) {
    console.error("Failed to build sitemap from assets:", error);
    return routes;
  }
}
