import type { FeedbackData, FeedbackEntry, FeedbackSource } from '../types';
import { setToolConnected } from '../state/toolConnections';

const FETCH_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface FeedbackEntrySnapshot {
  text: string;
  author: string;
  createdAt: number;
  stars: number;
  source: FeedbackSource;
}

interface FeedbackResponse {
  items: FeedbackEntrySnapshot[];
  unread: number;
  hasMore: boolean;
  sources: { github: boolean; appStore: boolean; googlePlay: boolean };
}

let cached: { data: FeedbackData; at: number } | null = null;
let inFlight: Promise<FeedbackData> | null = null;

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

function toEntry(snap: FeedbackEntrySnapshot): FeedbackEntry {
  return {
    stars: snap.stars,
    text: snap.text,
    author: snap.author,
    when: relativeTime(snap.createdAt),
    source: snap.source,
  };
}

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
      const res = await fetch('/api/feedback', { signal: ctrl.signal });
      if (!res.ok) {
        setToolConnected('github', false);
        setToolConnected('appStoreConnect', false);
        setToolConnected('googlePlayConsole', false);
        throw new Error(`feedback proxy ${res.status}`);
      }
      const json = (await res.json()) as FeedbackResponse;
      setToolConnected('github', json.sources.github);
      setToolConnected('appStoreConnect', json.sources.appStore);
      setToolConnected('googlePlayConsole', json.sources.googlePlay);
      const items = json.items.map(toEntry);
      const data: FeedbackData = { items, unread: json.unread, hasMore: json.hasMore };
      cached = { data, at: Date.now() };
      return data;
    } catch (err) {
      setToolConnected('github', false);
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
