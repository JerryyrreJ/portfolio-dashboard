"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { TrendingUp, ChevronDown } from "lucide-react";

export default function Header() {
  return (
    <header className="fixed top-0 z-50 w-full transition-all duration-300">
      {/* Background with blur, no harsh border for seamless feel */}
      <div className="absolute inset-0 bg-page/60 backdrop-blur-xl" />
      
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-6 md:px-12">
        {/* Left: Brand Identity & Links (Fey style left-alignment) */}
        <div className="flex items-center gap-10 md:gap-14">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="bg-primary text-on-primary p-1 rounded-md shadow-sm transition-transform group-hover:scale-105">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-[17px] font-bold tracking-tight text-primary">
              Folio
            </span>
          </Link>

          {/* Navigation Links nestled closely to the logo */}
          <nav className="hidden md:block">
            <ul className="flex items-center gap-8 text-[13px] font-medium text-secondary">
              <li>
                <Link href="#features" className="flex items-center gap-1 transition-colors hover:text-primary">
                  Features
                  <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                </Link>
              </li>
              <li>
                <Link href="/stock/AAPL" className="transition-colors hover:text-primary">
                  Explore
                </Link>
              </li>
              <li>
                <Link href="#workflow" className="transition-colors hover:text-primary">
                  Workflow
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        {/* Right: Authentication / Action */}
        <div className="flex items-center gap-5">
          <Link
            href="/login"
            className="hidden text-[13px] font-bold text-secondary transition-colors hover:text-primary sm:block"
          >
            Sign In
          </Link>
          <Link href="/app">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="rounded-full bg-primary px-5 py-2.5 text-[13px] font-bold tracking-wide text-on-primary shadow-[0_1px_3px_rgba(0,0,0,0.3)] hover:opacity-90 transition-opacity"
            >
              Open Dashboard
            </motion.button>
          </Link>
        </div>
      </div>
    </header>
  );
}
