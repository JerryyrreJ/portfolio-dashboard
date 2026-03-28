import Link from "next/link";
import { TrendingUp, Twitter, Github, Mail } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-border/40 bg-page px-6 py-12 md:py-16">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-10 md:flex-row md:items-end">
        
        {/* Brand & Copyright */}
        <div className="flex flex-col gap-6">
          <Link href="/" className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-on-primary">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
            <span className="text-[15px] font-bold tracking-tight text-primary">
              Folio
            </span>
          </Link>
          <p className="text-[13px] font-medium text-secondary max-w-xs leading-relaxed">
            The restrained workspace for monitoring holdings and turning market noise into clear financial signals.
          </p>
          <div className="flex gap-4 text-secondary mt-2">
            <a href="#" className="hover:text-primary transition-colors">
              <Twitter className="h-4 w-4" />
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              <Github className="h-4 w-4" />
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              <Mail className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Minimal Nav Links */}
        <div className="grid grid-cols-2 gap-12 sm:grid-cols-2 md:gap-24">
          <div className="flex flex-col gap-4">
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-primary">Platform</h4>
            <ul className="flex flex-col gap-3 text-[13px] font-medium text-secondary">
              <li><Link href="#features" className="hover:text-primary transition-colors">Features</Link></li>
              <li><Link href="/stock/AAPL" className="hover:text-primary transition-colors">Explore</Link></li>
              <li><Link href="/login" className="hover:text-primary transition-colors">Sign In</Link></li>
            </ul>
          </div>
          <div className="flex flex-col gap-4">
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-primary">Legal</h4>
            <ul className="flex flex-col gap-3 text-[13px] font-medium text-secondary">
              <li><Link href="#" className="hover:text-primary transition-colors">Privacy</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

      </div>

      {/* Bottom Copyright Bar */}
      <div className="mx-auto mt-16 max-w-6xl flex flex-col md:flex-row items-center justify-between border-t border-border/50 pt-8 gap-4">
        <p className="text-[12px] font-medium text-secondary">
          &copy; {currentYear} Folio Inc. All rights reserved.
        </p>
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[12px] font-medium text-secondary">All systems operational</span>
        </div>
      </div>
    </footer>
  );
}
