import type { AppStoreSnapshot } from './appStore.js';
import type { ReviewSample, StoreRatingResponse } from './types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function buildTrend(reviews: ReviewSample[], fallback: number): number[] {
  const todayStart = startOfDay(Date.now());
  const buckets: { sum: number; count: number }[] = Array.from({ length: 7 }, () => ({
    sum: 0,
    count: 0,
  }));
  for (const r of reviews) {
    const dayStart = startOfDay(r.createdAt);
    const idx = 6 - Math.round((todayStart - dayStart) / DAY_MS);
    if (idx >= 0 && idx < 7) {
      buckets[idx].sum += r.rating;
      buckets[idx].count += 1;
    }
  }
  let lastKnown = fallback;
  return buckets.map((b) => {
    if (b.count > 0) {
      lastKnown = b.sum / b.count;
    }
    return Number(lastKnown.toFixed(2));
  });
}

function buildBreakdown(reviews: ReviewSample[]): number[] {
  const counts = [0, 0, 0, 0, 0];
  for (const r of reviews) {
    const idx = 5 - Math.max(1, Math.min(5, Math.round(r.rating)));
    counts[idx] += 1;
  }
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return [0, 0, 0, 0, 0];
  return counts.map((c) => Math.round((c / total) * 100));
}

function buildDelta(reviews: ReviewSample[]): string {
  const cutoff = Date.now() - 7 * DAY_MS;
  const recent = reviews.filter((r) => r.createdAt >= cutoff).length;
  return `+${recent} 今週`;
}

export function aggregate(snap: AppStoreSnapshot): StoreRatingResponse {
  return {
    stars: Number(snap.globalAverage.toFixed(1)),
    reviews: snap.globalCount,
    delta: buildDelta(snap.textReviews),
    trend: buildTrend(snap.textReviews, snap.globalAverage),
    breakdown: buildBreakdown(snap.textReviews),
    sources: { appStore: true },
  };
}
