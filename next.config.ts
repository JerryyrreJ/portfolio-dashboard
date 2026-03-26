import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.finnhub.io',
      },
      {
        protocol: 'https',
        hostname: '**.twelvedata.com',
      },
      {
        protocol: 'https',
        // 允许任意 https 来源的 logo（各数据源 CDN 地址不固定）
        hostname: '**',
      },
    ],
  },
};

export default withNextIntl(nextConfig);
