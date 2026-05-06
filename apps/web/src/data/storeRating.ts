import type { StoreRatingData } from '../types';
import { setToolConnected } from '../state/toolConnections';

const FETCH_TIMEOUT_MS = 30_000;
const CACHE_TTL_MS = 30 * 60 * 1000;

interface StoreRatingResponse extends StoreRatingData {
  sources: { appStore: boolean };
}

let cached: { data: StoreRatingData; at: number } | null = null;
let inFlight: Promise<StoreRatingData> | null = null;

export function getCachedStoreRating(maxAgeMs = CACHE_TTL_MS): StoreRatingData | null {
  if (!cached) return null;
  if (Date.now() - cached.at > maxAgeMs) return null;
  return cached.data;
}

export async function fetchStoreRating(): Promise<StoreRatingData> {
  const fresh = getCachedStoreRating();
  if (fresh) return fresh;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch('/api/store-rating', { signal: ctrl.signal });
      if (!res.ok) {
        setToolConnected('appStoreConnect', false);
        throw new Error(`store-rating proxy ${res.status}`);
      }
      const { sources, ...data } = (await res.json()) as StoreRatingResponse;
      cached = { data, at: Date.now() };
      setToolConnected('appStoreConnect', sources.appStore);
      return data;
    } catch (err) {
      setToolConnected('appStoreConnect', false);
      throw err;
    } finally {
      clearTimeout(timer);
      inFlight = null;
    }
  })();
  return inFlight;
}
