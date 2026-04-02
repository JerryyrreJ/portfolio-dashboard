type TimedEntry = {
  label: string;
  durationMs: number;
};

function isPerfEnabled() {
  return process.env.ENABLE_SERVER_TIMING === '1';
}

function roundMs(value: number) {
  return Math.round(value * 10) / 10;
}

function formatSuffix(suffix?: string) {
  return suffix ? ` ${suffix}` : '';
}

export async function timeServerOperation<T>(
  label: string,
  operation: () => Promise<T>,
  suffix?: string
): Promise<T> {
  if (!isPerfEnabled()) {
    return operation();
  }

  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    const durationMs = roundMs(performance.now() - startedAt);
    console.info(`[Perf] ${label} ${durationMs}ms${formatSuffix(suffix)}`);
  }
}

export function createServerProfiler(scope: string, suffix?: string) {
  const enabled = isPerfEnabled();
  const startedAt = enabled ? performance.now() : 0;
  const entries: TimedEntry[] = [];

  return {
    async time<T>(label: string, operation: () => Promise<T>): Promise<T> {
      if (!enabled) {
        return operation();
      }

      const sectionStartedAt = performance.now();
      try {
        return await operation();
      } finally {
        entries.push({
          label,
          durationMs: roundMs(performance.now() - sectionStartedAt),
        });
      }
    },
    flush(extra?: string) {
      if (!enabled) return;

      const totalMs = roundMs(performance.now() - startedAt);
      const breakdown = entries.map((entry) => `${entry.label}=${entry.durationMs}ms`).join(' | ');
      console.info(
        `[Perf] ${scope} total=${totalMs}ms${formatSuffix(suffix)}${formatSuffix(extra)}${breakdown ? ` :: ${breakdown}` : ''}`
      );
    },
  };
}
