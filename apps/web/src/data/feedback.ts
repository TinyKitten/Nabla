import type { FeedbackData, FeedbackEntry } from '../types';
import { setToolConnected } from '../state/toolConnections';

const FETCH_TIMEOUT_MS = 30_000;
const CACHE_TTL_MS = 10 * 60 * 1000;

interface StoreReviewsResponse {
  items: FeedbackEntry[];
  sources: { appStore: boolean; googlePlay: boolean };
}

let cached: { data: FeedbackData; at: number } | null = null;
let inFlight: Promise<FeedbackData> | null = null;

export function getCachedFeedback(maxAgeMs = CACHE_TTL_MS): FeedbackData | null {
  if (!cached) return null;
  if (Date.now() - cached.at > maxAgeMs) return null;
  return cached.data;
}

export async function fetchFeedback(): Promise<FeedbackData> {
  const fresh = getCachedFeedback();
  if (fresh) return fresh;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch('/api/store-reviews', { signal: ctrl.signal });
      if (!res.ok) {
        setToolConnected('appStoreConnect', false);
        setToolConnected('googlePlayConsole', false);
        throw new Error(`store-reviews proxy ${res.status}`);
      }
      const { items, sources } = (await res.json()) as StoreReviewsResponse;
      const data: FeedbackData = { items, unread: items.length };
      cached = { data, at: Date.now() };
      setToolConnected('appStoreConnect', sources.appStore);
      setToolConnected('googlePlayConsole', sources.googlePlay);
      return data;
    } catch (err) {
      setToolConnected('appStoreConnect', false);
      setToolConnected('googlePlayConsole', false);
      throw err;
    } finally {
      clearTimeout(timer);
      inFlight = null;
    }
  })();
  return inFlight;
}
