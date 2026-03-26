import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { isAppLocale, routing } from "./routing";

function resolveAcceptLanguageLocale(acceptLanguage: string | null) {
  if (!acceptLanguage) return undefined;

  const candidates = acceptLanguage
    .split(",")
    .map((part) => part.split(";")[0]?.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    if (isAppLocale(candidate)) return candidate;

    const baseLanguage = candidate.split("-")[0];
    if (baseLanguage === "zh") return "zh-CN";
    if (baseLanguage === "en") return "en";
  }

  return undefined;
}

export default getRequestConfig(async ({ locale }) => {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const headerLocale = resolveAcceptLanguageLocale(
    headerStore.get("accept-language")
  );
  const candidate = locale ?? cookieLocale ?? headerLocale;
  const requestLocaleValue = isAppLocale(candidate) ? candidate : routing.defaultLocale;

  return {
    locale: requestLocaleValue,
    messages: (await import(`../../messages/${requestLocaleValue}.json`)).default,
  };
});
