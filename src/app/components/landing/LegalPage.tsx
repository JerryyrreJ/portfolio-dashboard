import type { ReactNode } from "react";
import Header from "./Header";
import Footer from "./Footer";

type LegalPageProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export default function LegalPage({ title, description, children }: LegalPageProps) {
  return (
    <main className="min-h-screen bg-page text-primary selection:bg-primary selection:text-on-primary">
      <Header />
      <article className="mx-auto w-full max-w-3xl px-6 pb-20 pt-28 md:px-12 md:pb-28 md:pt-32">
        <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-secondary">
          Folio
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-primary md:text-5xl">
          {title}
        </h1>
        <p className="mt-4 text-[15px] font-medium leading-relaxed text-secondary md:text-[17px]">
          {description}
        </p>
        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-primary/80">
          {children}
        </div>
      </article>
      <Footer />
    </main>
  );
}
