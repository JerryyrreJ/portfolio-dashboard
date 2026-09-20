"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";

export default function AppShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Hook into scroll position
  const { scrollYProgress } = useScroll({
    target: containerRef,
    // Start animating when the top of the container hits the bottom of the viewport
    // Finish animating when the bottom of the container hits the bottom of the viewport (or slightly offset)
    offset: ["start end", "end 80%"],
  });

  // Map scroll progress to 3D transformations
  // The dashboard tilts up, scales up, and fades in as you scroll down
  const rotateX = useTransform(scrollYProgress, [0, 1], [25, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.85, 1]);
  const opacity = useTransform(scrollYProgress, [0, 1], [0.2, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [100, 0]);

  return (
    <section
      id="preview"
      ref={containerRef}
      className="relative w-full px-4 pt-16 pb-32 md:pb-48 md:pt-24 flex justify-center perspective-[2000px] overflow-hidden"
    >
      
      {/* Glow Effect behind the dashboard */}
      <motion.div
        style={{ opacity: scrollYProgress }}
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[50vh] w-[80vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[120px]"
      />

      <motion.div
        style={{
          rotateX,
          scale,
          opacity,
          y,
          transformStyle: "preserve-3d"
        }}
        className="relative w-full max-w-[1200px]"
      >
        <div className="mb-8 text-center">
          <p className="mb-3 inline-flex rounded-full border border-border bg-card/60 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-secondary backdrop-blur-xl">
            Product Preview
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl md:text-5xl">
            A workspace that stays readable
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] font-medium leading-relaxed text-secondary sm:text-[17px]">
            Portfolio review should feel calm and legible. Folio keeps the important numbers close and the decorative noise out of the way.
          </p>
        </div>

        {/* Outer Frame to give it a "Hardware" or "Window" feel */}
        <div className="rounded-[clamp(1rem,3vw,2rem)] border border-border/60 bg-card/40 p-2 shadow-[0_0_50px_rgba(0,0,0,0.1)] backdrop-blur-2xl ring-1 ring-white/10 dark:shadow-[0_0_80px_rgba(0,0,0,0.4)] sm:p-4">
          
          {/* Inner Window */}
          <div className="relative w-full overflow-hidden rounded-[clamp(0.5rem,2.5vw,1.5rem)] border border-border bg-page shadow-2xl">
            
            {/* macOS Style Window Controls (Optional details for realism) */}
            <div className="absolute top-0 left-0 right-0 z-10 flex h-10 w-full items-center gap-2 px-4 transition-opacity">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-border/80" />
                <div className="h-2.5 w-2.5 rounded-full bg-border/80" />
                <div className="h-2.5 w-2.5 rounded-full bg-border/80" />
              </div>
            </div>

            <div className="relative aspect-[16/10] w-full bg-element/50 sm:aspect-video">
              <Image
                src="/dashboard-preview.png"
                alt="Folio dashboard with portfolio totals, a performance chart, and holdings"
                fill
                priority
                className="object-cover object-top"
                sizes="(max-width: 1200px) 100vw, 1200px"
              />
            </div>
            
            {/* 
              Glass reflection overlay - creates a premium shine effect over the screenshot 
            */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 dark:from-white/5 md:opacity-100" />
            
          </div>
        </div>
      </motion.div>
    </section>
  );
}
