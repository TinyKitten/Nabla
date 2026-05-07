import type { AppStoreSnapshot } from './appStore.js';
import type { GitHubFeedbackSnapshot } from './github.js';
import type { GooglePlaySnapshot } from './googlePlay.js';
import type { FeedbackEntrySnapshot, ReviewSample } from './types.js';

const MAX_ITEMS = 50;

function joinTitleBody(title?: string, body?: string): string {
  const t = title?.trim() ?? '';
  const b = body?.trim() ?? '';
  if (t && b) return `${t} — ${b}`;
  return t || b;
}

function reviewToEntry(
  r: ReviewSample,
  source: 'appStore' | 'googlePlay',
): FeedbackEntrySnapshot | null {
  const text = source === 'appStore' ? joinTitleBody(r.title, r.body) : (r.body?.trim() ?? '');
  if (!text) return null;
  return {
    stars: Math.max(1, Math.min(5, Math.round(r.rating))),
    text,
    author: r.reviewer?.trim() || '匿名',
    createdAt: r.createdAt,
    source,
  };
}

export function buildFeedback(
  github: GitHubFeedbackSnapshot | null,
  appStore: AppStoreSnapshot | null,
  googlePlay: GooglePlaySnapshot | null,
): { items: FeedbackEntrySnapshot[]; hasMore: boolean } {
  const items: FeedbackEntrySnapshot[] = [];
  if (github) items.push(...github.items);
  if (appStore) {
    for (const r of appStore.textReviews) {
      const e = reviewToEntry(r, 'appStore');
      if (e) items.push(e);
    }
  }
  if (googlePlay) {
    for (const r of googlePlay.reviews) {
      const e = reviewToEntry(r, 'googlePlay');
      if (e) items.push(e);
    }
  }
  items.sort((a, b) => b.createdAt - a.createdAt);
  const truncated = items.length > MAX_ITEMS;
  const hasMore = truncated || (github?.hasMore ?? false);
  return { items: items.slice(0, MAX_ITEMS), hasMore };
}
