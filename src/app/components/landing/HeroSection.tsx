"use client";

import { motion, type Variants } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PendingNavLink, { PendingLinkStatus } from "@/app/components/PendingNavLink";

const smoothEase = [0.16, 1, 0.3, 1] as const;

export default function HeroSection() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30, filter: "blur(12px)" },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: 0.8,
        ease: smoothEase,
      },
    },
  };

  return (
    <section className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-6 text-center md:px-12">
      {/* 
        Ambient Background Effects 
        These are strictly positioned and heavily blurred. Kept hardware accelerated.
      */}
      <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 0.15, scale: 1 }}
          transition={{ duration: 2.5, ease: "easeOut" }}
          className="absolute h-[50vh] w-[50vh] rounded-full bg-emerald-500 blur-[100px] md:h-[70vh] md:w-[70vh] md:blur-[140px]"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 0.1, scale: 1 }}
          transition={{ duration: 2.5, delay: 0.3, ease: "easeOut" }}
          className="absolute ml-[15vw] mt-[20vh] h-[40vh] w-[40vh] rounded-full bg-blue-500 blur-[100px] md:h-[60vh] md:w-[60vh]"
        />
      </div>

      {/* Core Content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex w-full max-w-4xl flex-col items-center justify-center"
      >
        {/* Subtle Pill */}
        <motion.div variants={itemVariants} className="mb-6 md:mb-10">
          <span className="inline-flex rounded-full border border-border bg-card/50 px-4 py-1.5 text-[11px] font-bold tracking-[0.2em] text-secondary shadow-sm backdrop-blur-xl">
            STOCKS • DIVIDENDS • TRANSACTIONS
          </span>
        </motion.div>

        {/* Hero Headline */}
        <motion.h1
          variants={itemVariants}
          className="max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight text-primary sm:text-6xl md:text-7xl lg:text-[88px]"
        >
          Track your portfolio <br className="hidden sm:block" />
          <span className="text-secondary">with less noise.</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={itemVariants}
          className="mt-6 max-w-2xl text-[17px] font-medium leading-relaxed text-secondary sm:text-[19px] md:mt-8"
        >
          Folio gives you a cleaner way to record trades, monitor dividend income, and understand true portfolio return without broker clutter.
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          variants={itemVariants}
          className="mt-10 flex w-full flex-col items-center justify-center gap-4 sm:w-auto sm:flex-row md:mt-12"
        >
          <PendingNavLink href="/app" className="w-full sm:w-auto" showIndicator={false}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-primary px-8 py-4 text-[15px] font-bold text-on-primary shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-all sm:w-auto"
            >
              <span className="relative z-10 flex items-center gap-2">
                Open Dashboard
                <PendingLinkStatus
                  pendingLabel="Opening..."
                  indicatorClassName="inline-flex items-center gap-1.5 text-on-primary/80"
                />
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
              {/* Subtle hover glare moving across the button */}
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 ease-in-out group-hover:translate-x-full dark:via-black/10" />
            </motion.button>
          </PendingNavLink>

          <Link href="/stock/AAPL" className="w-full sm:w-auto">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-transparent px-8 py-4 text-[15px] font-bold text-secondary transition-colors hover:bg-element hover:text-primary sm:w-auto"
            >
              Browse Public Stocks
            </motion.button>
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
