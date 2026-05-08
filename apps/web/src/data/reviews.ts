import type { FeedbackEntry, FeedbackSource, ReviewsData } from '../types';
import { setToolConnected } from '../state/toolConnections';

const FETCH_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface ReviewEntrySnapshot {
  title?: string;
  text: string;
  author: string;
  createdAt: number;
  stars: number;
  source: FeedbackSource;
}

interface ReviewsResponse {
  items: ReviewEntrySnapshot[];
  sources: { appStore: boolean; googlePlay: boolean };
}

let cached: { data: ReviewsData; at: number } | null = null;
let inFlight: Promise<ReviewsData> | null = null;

function relativeTime(ts: number, now: number = Date.now()): string {
  const diff = now - ts;
  if (diff < 60_000) return 'たった今';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  if (ts >= startOfToday.getTime()) return '今日';
  const startOfYesterday = startOfToday.getTime() - 24 * 60 * 60 * 1000;
  if (ts >= startOfYesterday) return '昨日';
  const days = Math.floor((startOfToday.getTime() - ts) / (24 * 60 * 60 * 1000)) + 1;
  if (days < 7) return `${days}日前`;
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function toEntry(snap: ReviewEntrySnapshot): FeedbackEntry {
  return {
    stars: snap.stars,
    title: snap.title,
    text: snap.text,
    author: snap.author,
    when: relativeTime(snap.createdAt),
    source: snap.source,
  };
}

export function getCachedReviews(maxAgeMs = CACHE_TTL_MS): ReviewsData | null {
  if (!cached) return null;
  if (Date.now() - cached.at > maxAgeMs) return null;
  return cached.data;
}

export async function fetchReviews(opts?: { force?: boolean }): Promise<ReviewsData> {
  if (!opts?.force) {
    const fresh = getCachedReviews();
    if (fresh) return fresh;
  }
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch('/api/reviews', { signal: ctrl.signal });
      if (!res.ok) {
        setToolConnected('appStoreConnect', false);
        setToolConnected('googlePlayConsole', false);
        throw new Error(`reviews proxy ${res.status}`);
      }
      const json = (await res.json()) as ReviewsResponse;
      setToolConnected('appStoreConnect', json.sources.appStore);
      setToolConnected('googlePlayConsole', json.sources.googlePlay);
      const items = json.items.map(toEntry);
      const data: ReviewsData = { items };
      cached = { data, at: Date.now() };
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
