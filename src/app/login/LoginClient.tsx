"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthPanel from "@/app/components/settings/AuthPanel";
import Footer from "@/app/components/landing/Footer";
import Header from "@/app/components/landing/Header";

export default function LoginClient() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-page text-primary selection:bg-primary selection:text-on-primary">
      <Header />
      <div className="mx-auto flex w-full max-w-md flex-col px-6 pb-20 pt-28 md:px-12 md:pb-28 md:pt-32">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm md:rounded-[32px] md:p-8">
          <AuthPanel onLogin={() => router.push("/app")} />
        </div>
        <p className="mt-6 text-center text-[13px] font-medium text-secondary">
          <Link href="/" className="transition-colors hover:text-primary">
            Back to home
          </Link>
        </p>
      </div>
      <Footer />
    </main>
  );
}
