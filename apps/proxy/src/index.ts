import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { fetchAppStoreReviews } from './appStore.js';
import { fetchGooglePlayReviews } from './googlePlay.js';
import { aggregate } from './aggregate.js';
import type { StoreRatingResponse, StoreSnapshot } from './types.js';

const PORT = Number(process.env.PROXY_PORT ?? 5174);
const CACHE_TTL_MS = 5 * 60 * 1000;

let cached: { data: StoreRatingResponse; at: number } | null = null;
let inFlight: Promise<StoreRatingResponse> | null = null;

async function loadStoreRating(): Promise<StoreRatingResponse> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const settled = await Promise.allSettled<StoreSnapshot>([
      fetchAppStoreReviews(),
      fetchGooglePlayReviews(),
    ]);
    const ok: StoreSnapshot[] = [];
    for (const r of settled) {
      if (r.status === 'fulfilled') {
        ok.push(r.value);
      } else {
        console.error('[store-rating] source failed:', r.reason);
      }
    }
    if (ok.length === 0) throw new Error('all store-rating sources failed');
    const data = aggregate(ok);
    cached = { data, at: Date.now() };
    return data;
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET' || req.url !== '/api/store-rating') {
    send(res, 404, { error: 'not found' });
    return;
  }
  try {
    const data = await loadStoreRating();
    send(res, 200, data);
  } catch (err) {
    console.error('[store-rating]', err);
    send(res, 503, { error: err instanceof Error ? err.message : 'unknown' });
  }
}

createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error('[proxy] unhandled', err);
    if (!res.headersSent) send(res, 500, { error: 'internal' });
  });
}).listen(PORT, () => {
  console.log(`[proxy] listening on http://localhost:${PORT}`);
});
