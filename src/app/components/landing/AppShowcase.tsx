"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";

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
    <section ref={containerRef} className="relative w-full px-4 pt-16 pb-32 md:pb-48 md:pt-24 flex justify-center perspective-[2000px] overflow-hidden">
      
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

            {/* Application Screenshot */}
            {/* 
              This aspect-video forces a 16:9 ratio. 
              Replace the 'src' with the absolute path to your actual application screenshot (e.g. /dashboard-preview.png)
            */}
            <div className="relative aspect-[16/10] w-full sm:aspect-video bg-element/50 flex items-center justify-center">
              
              {/* === PLACEHOLDER CONTENT : Remove when you add your real Image === */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-secondary/60 opacity-80 backdrop-blur-sm">
                <div className="border border-dashed border-border/80 rounded-2xl p-10 flex flex-col items-center">
                  <svg className="w-12 h-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="font-medium text-sm">Please place your 1:1 Dashboard Screenshot here</p>
                  <p className="text-xs mt-1">Suggested resolution: 2560x1600 (16:10 or 16:9)</p>
                  <code className="mt-4 px-2 py-1 bg-black/20 rounded text-[11px] font-mono">
                    src="/dashboard-preview.png"
                  </code>
                </div>
              </div>
              {/* ============================================================= */}

              {/* 
                Uncomment this and add your image into the public/ folder:
                <Image 
                  src="/dashboard-preview.webp" 
                  alt="Folio App Interface"
                  fill
                  priority
                  className="object-cover object-top"
                  sizes="(max-width: 1200px) 100vw, 1200px"
                /> 
              */}
              
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
