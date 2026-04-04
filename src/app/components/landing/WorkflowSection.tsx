"use client";

import { motion } from "framer-motion";

const workflowSteps = [
  {
    step: "01",
    title: "Record trades cleanly",
    description: "Log buys, sells, fees, and notes without importing a noisy broker interface or giving up control of your history.",
  },
  {
    step: "02",
    title: "Review dividends and reinvestment",
    description: "Surface pending dividend events, confirm cash payouts, or convert them into reinvested shares when that matches how the income was used.",
  },
  {
    step: "03",
    title: "See net return clearly",
    description: "Understand the effect of fees, dividends, realized gains, and current holdings in one place instead of stitching the answer together yourself.",
  },
];

export default function WorkflowSection() {
  return (
    <section id="workflow" className="relative w-full bg-page px-6 py-24 md:px-12 md:py-48">
      {/* 
        This is the absolute core of the sticky effect.
        By setting the parent flex container and giving the left column a 'sticky' 
        position with a 'top' value, it stays anchored while the right column's tall 
        content continues to scroll past it.
      */}
      <div className="mx-auto flex max-w-6xl flex-col gap-16 md:flex-row md:items-start md:gap-24">
        
        {/* Left Column: Fixed / Sticky Title */}
        {/* 'top-32' or 'top-40' keeps it pinned just below the header */}
        <div className="flex-1 md:sticky md:top-48 md:h-fit">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <span className="mb-4 inline-block rounded-full border border-border bg-element px-3 py-1 text-[11px] font-bold tracking-wider text-secondary uppercase">
              How it works
            </span>
            <h2 className="text-4xl font-bold tracking-tight text-primary md:text-5xl lg:text-6xl">
              From trade entry <br />
              <span className="text-secondary">to actual return.</span>
            </h2>
            <p className="mt-6 max-w-sm text-lg font-medium text-secondary">
              A simple workflow for investors who want a reliable record first and a cleaner performance view second.
            </p>
          </motion.div>
        </div>

        {/* Right Column: Scrolling Cards (The Waterfall) */}
        {/* We give it large padding/margins between items so the user has to scroll */}
        <div className="flex flex-1 flex-col gap-24 md:gap-40 md:pt-24 pb-32">
          {workflowSteps.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, margin: "-20%" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex flex-col gap-6 rounded-3xl border border-border bg-card p-8 shadow-sm lg:p-12 hover:border-border/80 transition-colors group"
            >
              {/* Number indicator */}
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-element border border-border text-sm font-bold text-secondary group-hover:text-primary transition-colors">
                {item.step}
              </div>
              
              <div className="space-y-4">
                <h3 className="text-2xl font-bold tracking-tight text-primary">
                  {item.title}
                </h3>
                <p className="text-base font-medium leading-relaxed text-secondary">
                  {item.description}
                </p>
              </div>

              {/* Abstract decorative graphic representing the step */}
              <div className="mt-8 h-48 w-full rounded-2xl bg-element/50 border border-border/50 flex overflow-hidden">
                {/* Just a placeholder wireframe inside the box to look premium */}
                <div className="w-full h-full opacity-20 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
