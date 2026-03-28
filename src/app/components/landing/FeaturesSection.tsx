"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { LineChart, Lock, Layers, ZapOff, Percent } from "lucide-react";

const features = [
  {
    title: "Absolute Privacy",
    description: "Zero server tracking by default. Build a local portfolio entirely stored on your own device.",
    icon: Lock,
    colSpan: "md:col-span-2",
  },
  {
    title: "Unified Portfolios",
    description: "Manage multiple brokerage accounts. Combine them instantly for a holistic overview of your net worth.",
    icon: Layers,
    colSpan: "md:col-span-1",
  },
  {
    title: "True Returns",
    description: "Accurate cost basis calculations supporting both FIFO and Average Cost. Dividends are automatically factored in.",
    icon: Percent,
    colSpan: "md:col-span-1",
  },
  {
    title: "Focused on US Equities",
    description: "Built for clarity, not anxiety. Reliable delayed pricing drops the noise of real-time trading so you can focus on long-term signals.",
    icon: ZapOff,
    colSpan: "md:col-span-2",
  },
];

// Card component implementing the premium mouse-follow glow effect
function FeatureCard({ feature }: { feature: typeof features[0] }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      className={`group relative flex w-full flex-col rounded-3xl border border-border bg-card p-8 shadow-sm transition-all hover:shadow-md overflow-hidden`}
    >
      {/* Dynamic Hover Glow */}
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              400px circle at ${mouseX}px ${mouseY}px,
              rgba(16, 185, 129, 0.1),
              transparent 80%
            )
          `,
        }}
      />
      {/* Subtle Border Glow */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              300px circle at ${mouseX}px ${mouseY}px,
              rgba(255, 255, 255, 0.05),
              transparent 80%
            )
          `,
          maskImage: "linear-gradient(black, black) content-box content-box, linear-gradient(black, black)",
          maskComposite: "exclude",
          padding: "1px",
        }}
      />

      <div className="relative z-10 flex flex-col justify-between gap-12">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-element/50 border border-border shadow-sm group-hover:bg-element transition-colors">
          <feature.icon className="h-5 w-5 text-primary group-hover:scale-110 transition-transform duration-300" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold tracking-tight text-primary">
            {feature.title}
          </h3>
          <p className="text-[15px] leading-relaxed text-secondary font-medium">
            {feature.description}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function FeaturesSection() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null; // Prevent hydration issues with motion values

  return (
    <section id="features" className="relative w-full px-6 py-24 md:py-32 flex justify-center bg-page">
      <div className="w-full max-w-6xl">
        <div className="mb-16 md:mb-24 md:pl-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h2 className="text-4xl font-bold tracking-tight text-primary md:text-5xl lg:text-6xl max-w-2xl">
              Engineered for signal.<br />
              <span className="text-secondary">Stripped of noise.</span>
            </h2>
            <p className="mt-6 max-w-xl text-lg font-medium text-secondary">
              Folio strips away the clutter of traditional brokerages to give you an uninterrupted, beautiful view of your true financial standing.
            </p>
          </motion.div>
        </div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.15 },
            },
          }}
          className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6"
        >
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              variants={{
                hidden: { opacity: 0, scale: 0.95, y: 20 },
                visible: {
                  opacity: 1,
                  scale: 1,
                  y: 0,
                  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
                },
              }}
              className={`${feature.colSpan} flex`}
            >
              <FeatureCard feature={feature} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
