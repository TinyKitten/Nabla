import type { ReviewSample, StoreRatingResponse, StoreSnapshot } from './types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function buildTrend(reviews: ReviewSample[]): number[] {
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
  let lastKnown = 0;
  let total = 0;
  let totalCount = 0;
  for (const r of reviews) {
    total += r.rating;
    totalCount += 1;
  }
  if (totalCount > 0) lastKnown = total / totalCount;
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

export function aggregate(snapshots: StoreSnapshot[]): StoreRatingResponse {
  const all = snapshots.flatMap((s) => s.reviews);
  const reviews = all.length;
  const stars =
    reviews === 0
      ? 0
      : Number((all.reduce((a, r) => a + r.rating, 0) / reviews).toFixed(1));
  return {
    stars,
    reviews,
    delta: buildDelta(all),
    trend: buildTrend(all),
    breakdown: buildBreakdown(all),
    sources: {
      appStore: snapshots.some((s) => s.source === 'appStore'),
      googlePlay: snapshots.some((s) => s.source === 'googlePlay'),
    },
  };
}
