import type { PerformanceData } from '../types';
import { setToolConnected } from '../state/toolConnections';

const FETCH_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface PerformanceResponse extends PerformanceData {
  sources: { sentry: boolean };
}

let cached: { data: PerformanceData; at: number } | null = null;
let inFlight: Promise<PerformanceData> | null = null;

export function getCachedPerformance(maxAgeMs = CACHE_TTL_MS): PerformanceData | null {
  if (!cached) return null;
  if (Date.now() - cached.at > maxAgeMs) return null;
  return cached.data;
}

export async function fetchPerformance(opts?: { force?: boolean }): Promise<PerformanceData> {
  if (!opts?.force) {
    const fresh = getCachedPerformance();
    if (fresh) return fresh;
  }
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch('/api/performance', { signal: ctrl.signal });
      if (!res.ok) {
        setToolConnected('sentry', false);
        throw new Error(`performance proxy ${res.status}`);
      }
      const { sources, ...data } = (await res.json()) as PerformanceResponse;
      cached = { data, at: Date.now() };
      setToolConnected('sentry', sources.sentry);
      return data;
    } catch (err) {
      setToolConnected('sentry', false);
      throw err;
    } finally {
      clearTimeout(timer);
      inFlight = null;
    }
  })();
  return inFlight;
}
