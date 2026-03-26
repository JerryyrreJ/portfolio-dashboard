"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { routing, type AppLocale } from "@/i18n/routing";

const localeLabels: Record<AppLocale, string> = {
  en: "English",
  "zh-CN": "中文",
};

export default function LanguageSwitcher() {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center rounded-lg border border-border bg-card p-0.5 shadow-sm">
      {routing.locales.map((nextLocale) => {
        const isActive = locale === nextLocale;

        return (
          <button
            key={nextLocale}
            type="button"
            onClick={() => {
              if (isActive || !pathname) return;

              startTransition(() => {
                document.cookie = `NEXT_LOCALE=${encodeURIComponent(nextLocale)}; Path=/; Max-Age=31536000; SameSite=Lax`;

                const queryString = searchParams.toString();
                const href = queryString ? `${pathname}?${queryString}` : pathname;

                router.replace(href);
                router.refresh();
              });
            }}
            disabled={isPending || isActive}
            className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
              isActive
                ? "bg-primary text-on-primary shadow-sm"
                : "text-secondary hover:text-primary"
            } disabled:cursor-default disabled:opacity-100`}
            aria-pressed={isActive}
          >
            {localeLabels[nextLocale]}
          </button>
        );
      })}
    </div>
  );
}
