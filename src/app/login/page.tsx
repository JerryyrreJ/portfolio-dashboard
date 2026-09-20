import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { needsMfaStepUp } from "@/lib/mfa";
import { getMfaAssuranceLevel, getUser } from "@/lib/supabase-server";
import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to Folio to sync your portfolios across devices.",
  alternates: {
    canonical: "/login",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function LoginPage() {
  const user = await getUser().catch(() => null);
  if (user) {
    const aal = await getMfaAssuranceLevel();
    if (!needsMfaStepUp(aal)) {
      redirect("/app");
    }
  }

  return <LoginClient />;
}
