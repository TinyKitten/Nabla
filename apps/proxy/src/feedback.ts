import type { AppStoreSnapshot } from './appStore.js';
import type { GooglePlaySnapshot } from './googlePlay.js';
import type { FeedbackEntry, FeedbackSource, ReviewSample } from './types.js';

const MAX_ITEMS = 50;
const MIN_MS = 60 * 1000;
const HOUR_MS = 60 * MIN_MS;
const DAY_MS = 24 * HOUR_MS;

function relativeWhen(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts);
  if (diff < HOUR_MS) {
    const m = Math.max(1, Math.round(diff / MIN_MS));
    return `${m}分前`;
  }
  if (diff < DAY_MS) return `${Math.round(diff / HOUR_MS)}時間前`;
  if (diff < 7 * DAY_MS) return `${Math.round(diff / DAY_MS)}日前`;
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function joinTitleBody(title?: string, body?: string): string {
  const t = title?.trim() ?? '';
  const b = body?.trim() ?? '';
  if (t && b) return `${t} — ${b}`;
  return t || b;
}

function toFeedbackEntry(r: ReviewSample, source: FeedbackSource): FeedbackEntry | null {
  const text = source === 'appStore' ? joinTitleBody(r.title, r.body) : (r.body?.trim() ?? '');
  if (!text) return null;
  return {
    stars: Math.max(1, Math.min(5, Math.round(r.rating))),
    text,
    author: r.reviewer?.trim() || '匿名',
    when: relativeWhen(r.createdAt),
    source,
  };
}

export function buildFeedback(
  appStore: AppStoreSnapshot | null,
  googlePlay: GooglePlaySnapshot | null,
): FeedbackEntry[] {
  const items: FeedbackEntry[] = [];
  const merged: { sample: ReviewSample; source: FeedbackSource }[] = [];
  if (appStore) {
    for (const r of appStore.textReviews) merged.push({ sample: r, source: 'appStore' });
  }
  if (googlePlay) {
    for (const r of googlePlay.reviews) merged.push({ sample: r, source: 'googlePlay' });
  }
  merged.sort((a, b) => b.sample.createdAt - a.sample.createdAt);
  for (const { sample, source } of merged) {
    const entry = toFeedbackEntry(sample, source);
    if (entry) items.push(entry);
    if (items.length >= MAX_ITEMS) break;
  }
  return items;
}
