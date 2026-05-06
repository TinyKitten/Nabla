import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';
import { APPLE_STOREFRONTS } from './storefronts.js';
import type { ReviewSample } from './types.js';

const TOKEN_TTL_SECONDS = 60 * 15;
const PAGE_LIMIT = 200;
const MAX_PAGES = 5;
const LOOKUP_CONCURRENCY = 10;
const ASC_FETCH_TIMEOUT_MS = 10_000;
const LOOKUP_FETCH_TIMEOUT_MS = 5_000;
const LOOKUP_BATCH_DELAY_MS = 3_500;

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

function loadPrivateKey(): string {
  const path = process.env.APP_STORE_CONNECT_PRIVATE_KEY_PATH;
  if (!path) throw new Error('APP_STORE_CONNECT_PRIVATE_KEY_PATH not set');
  return readFileSync(path, 'utf8');
}

function getToken(): string {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }
  const keyId = process.env.APP_STORE_CONNECT_KEY_ID;
  const issuerId = process.env.APP_STORE_CONNECT_ISSUER_ID;
  if (!keyId || !issuerId) {
    throw new Error('APP_STORE_CONNECT_KEY_ID / ISSUER_ID not set');
  }
  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    {
      iss: issuerId,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
      aud: 'appstoreconnect-v1',
    },
    loadPrivateKey(),
    { algorithm: 'ES256', header: { alg: 'ES256', kid: keyId, typ: 'JWT' } },
  );
  cachedToken = { token, expiresAt: (now + TOKEN_TTL_SECONDS) * 1000 };
  return token;
}

interface ReviewAttributes {
  rating: number;
  createdDate: string;
}

interface ReviewRecord {
  id: string;
  attributes: ReviewAttributes;
}

interface ReviewPage {
  data: ReviewRecord[];
  links?: { next?: string };
}

async function fetchTextReviews(appId: string): Promise<ReviewSample[]> {
  const token = getToken();
  const reviews: ReviewSample[] = [];
  let url: string | undefined =
    `https://api.appstoreconnect.apple.com/v1/apps/${appId}/customerReviews` +
    `?limit=${PAGE_LIMIT}&sort=-createdDate`;
  for (let page = 0; page < MAX_PAGES && url; page++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(ASC_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`App Store Connect ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as ReviewPage;
    for (const r of json.data) {
      reviews.push({
        rating: r.attributes.rating,
        createdAt: Date.parse(r.attributes.createdDate),
      });
    }
    url = json.links?.next;
  }
  return reviews;
}

interface LookupResult {
  userRatingCount?: number;
  averageUserRating?: number;
}

interface LookupResponse {
  resultCount: number;
  results: LookupResult[];
}

async function lookupOne(appId: string, country: string): Promise<LookupResult | null> {
  const url = `https://itunes.apple.com/lookup?id=${appId}&country=${country}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(LOOKUP_FETCH_TIMEOUT_MS) });
    if (!res.ok) {
      console.warn(`[itunes-lookup] ${country} HTTP ${res.status}`);
      return null;
    }
    const json = (await res.json()) as LookupResponse;
    return json.resultCount > 0 ? json.results[0] : null;
  } catch (err) {
    console.warn(
      `[itunes-lookup] ${country} ${err instanceof Error ? err.message : 'unknown'}`,
    );
    return null;
  }
}

async function fetchGlobalAggregate(appId: string): Promise<{ count: number; average: number }> {
  let totalCount = 0;
  let weightedStars = 0;
  for (let i = 0; i < APPLE_STOREFRONTS.length; i += LOOKUP_CONCURRENCY) {
    const batch = APPLE_STOREFRONTS.slice(i, i + LOOKUP_CONCURRENCY);
    const results = await Promise.all(batch.map((c) => lookupOne(appId, c)));
    for (const r of results) {
      const c = r?.userRatingCount ?? 0;
      const a = r?.averageUserRating ?? 0;
      if (c > 0) {
        totalCount += c;
        weightedStars += a * c;
      }
    }
    if (i + LOOKUP_CONCURRENCY < APPLE_STOREFRONTS.length) {
      await new Promise((r) => setTimeout(r, LOOKUP_BATCH_DELAY_MS));
    }
  }
  const average = totalCount > 0 ? weightedStars / totalCount : 0;
  return { count: totalCount, average };
}

export interface AppStoreSnapshot {
  globalCount: number;
  globalAverage: number;
  textReviews: ReviewSample[];
}

export async function fetchAppStore(): Promise<AppStoreSnapshot> {
  const appId = process.env.APP_STORE_CONNECT_APP_ID;
  if (!appId) throw new Error('APP_STORE_CONNECT_APP_ID not set');
  const [aggregate, textReviews] = await Promise.all([
    fetchGlobalAggregate(appId),
    fetchTextReviews(appId),
  ]);
  return {
    globalCount: aggregate.count,
    globalAverage: aggregate.average,
    textReviews,
  };
}
