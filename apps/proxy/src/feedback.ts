import type { AppStoreSnapshot } from './appStore.js';
import type { GitHubFeedbackSnapshot } from './github.js';
import type { GooglePlaySnapshot } from './googlePlay.js';
import type { FeedbackEntrySnapshot, ReviewSample } from './types.js';

const MAX_ITEMS = 50;

function reviewToEntry(
  r: ReviewSample,
  source: 'appStore' | 'googlePlay',
): FeedbackEntrySnapshot | null {
  const title = source === 'appStore' ? (r.title?.trim() ?? '') : '';
  const text = r.body?.trim() ?? '';
  if (!title && !text) return null;
  return {
    stars: Math.max(1, Math.min(5, Math.round(r.rating))),
    title: title || undefined,
    text: text || title,
    author: r.reviewer?.trim() || '匿名',
    createdAt: r.createdAt,
    source,
  };
}

export function buildFeedback(
  github: GitHubFeedbackSnapshot | null,
  appStore: AppStoreSnapshot | null,
  googlePlay: GooglePlaySnapshot | null,
): { items: FeedbackEntrySnapshot[]; unread: number; hasMore: boolean } {
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
  return {
    items: items.slice(0, MAX_ITEMS),
    unread: github?.items.length ?? 0,
    hasMore: github?.hasMore ?? false,
  };
}
