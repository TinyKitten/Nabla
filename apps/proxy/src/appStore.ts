import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';
import type { ReviewSample, StoreSnapshot } from './types.js';

const TOKEN_TTL_SECONDS = 60 * 15;
const PAGE_LIMIT = 200;
const MAX_PAGES = 5;

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

export async function fetchAppStoreReviews(): Promise<StoreSnapshot> {
  const appId = process.env.APP_STORE_CONNECT_APP_ID;
  if (!appId) throw new Error('APP_STORE_CONNECT_APP_ID not set');
  const token = getToken();
  const reviews: ReviewSample[] = [];
  let url: string | undefined =
    `https://api.appstoreconnect.apple.com/v1/apps/${appId}/customerReviews` +
    `?limit=${PAGE_LIMIT}&sort=-createdDate`;
  for (let page = 0; page < MAX_PAGES && url; page++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
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
  return { source: 'appStore', reviews };
}
