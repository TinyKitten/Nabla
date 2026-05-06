import { GoogleAuth } from 'google-auth-library';
import type { ReviewSample } from './types.js';

const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const PAGE_LIMIT = 100;
const MAX_PAGES = 5;
const SNAPSHOT_TTL_MS = 30 * 60 * 1000;

let cachedAuth: GoogleAuth | null = null;

function getAuth(): GoogleAuth {
  if (cachedAuth) return cachedAuth;
  const keyFile = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH;
  if (!keyFile) throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH not set');
  cachedAuth = new GoogleAuth({ keyFile, scopes: [SCOPE] });
  return cachedAuth;
}

interface PlayUserComment {
  starRating: number;
  text?: string;
  lastModified: { seconds: string };
  reviewerLanguage?: string;
}

interface PlayComment {
  userComment?: PlayUserComment;
}

interface PlayReview {
  reviewId: string;
  authorName?: string;
  comments: PlayComment[];
}

interface PlayReviewPage {
  reviews?: PlayReview[];
  tokenPagination?: { nextPageToken?: string };
}

export interface GooglePlaySnapshot {
  reviews: ReviewSample[];
}

async function fetchGooglePlay(): Promise<GooglePlaySnapshot> {
  const pkg = process.env.GOOGLE_PLAY_PACKAGE_NAME;
  if (!pkg) throw new Error('GOOGLE_PLAY_PACKAGE_NAME not set');
  const client = await getAuth().getClient();
  const reviews: ReviewSample[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({ maxResults: String(PAGE_LIMIT) });
    if (pageToken) params.set('token', pageToken);
    const url =
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/reviews?` +
      params.toString();
    const res = await client.request<PlayReviewPage>({ url });
    const json = res.data;
    for (const r of json.reviews ?? []) {
      const c = r.comments[0]?.userComment;
      if (!c) continue;
      reviews.push({
        rating: c.starRating,
        createdAt: Number(c.lastModified.seconds) * 1000,
        body: c.text,
        reviewer: r.authorName,
      });
    }
    pageToken = json.tokenPagination?.nextPageToken;
    if (!pageToken) break;
  }
  return { reviews };
}

let snapshotCache: { data: GooglePlaySnapshot; at: number } | null = null;
let snapshotInFlight: Promise<GooglePlaySnapshot> | null = null;

export async function getGooglePlaySnapshot(): Promise<GooglePlaySnapshot> {
  if (snapshotCache && Date.now() - snapshotCache.at < SNAPSHOT_TTL_MS) return snapshotCache.data;
  if (snapshotInFlight) return snapshotInFlight;
  snapshotInFlight = (async () => {
    try {
      const snap = await fetchGooglePlay();
      snapshotCache = { data: snap, at: Date.now() };
      return snap;
    } finally {
      snapshotInFlight = null;
    }
  })();
  return snapshotInFlight;
}
