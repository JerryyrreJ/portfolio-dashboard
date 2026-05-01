"use client";

import { useEffect, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import Link, { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

type PendingNavLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, "children"> & {
  children: ReactNode;
  pendingLabel?: string;
  showIndicator?: boolean;
  indicatorClassName?: string;
  contentClassName?: string;
};

function useDelayedPending(delayMs = 120) {
  const { pending } = useLinkStatus();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let timer: number | undefined;

    if (pending) {
      timer = window.setTimeout(() => setIsVisible(true), delayMs);
    } else if (isVisible) {
      timer = window.setTimeout(() => setIsVisible(false), 0);
    }

    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [delayMs, isVisible, pending]);

  return pending && isVisible;
}

export function PendingLinkStatus({
  pendingLabel,
  showIndicator = true,
  indicatorClassName,
}: {
  pendingLabel?: string;
  showIndicator?: boolean;
  indicatorClassName?: string;
}) {
  const isVisible = useDelayedPending();

  if (!isVisible || !showIndicator) {
    return null;
  }

  return (
    <span
      className={indicatorClassName ?? "inline-flex items-center gap-1.5 text-current/80"}
      aria-live="polite"
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {pendingLabel ? <span className="text-[11px] font-semibold">{pendingLabel}</span> : null}
    </span>
  );
}

export default function PendingNavLink({
  children,
  pendingLabel,
  showIndicator = true,
  indicatorClassName,
  contentClassName,
  ...props
}: PendingNavLinkProps) {
  return (
    <Link {...props}>
      <span className={contentClassName ?? "inline-flex items-center gap-2"}>
        {children}
        <PendingLinkStatus
          pendingLabel={pendingLabel}
          showIndicator={showIndicator}
          indicatorClassName={indicatorClassName}
        />
      </span>
    </Link>
  );
}
