import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { getAppStoreSnapshot } from './appStore.js';
import { getGooglePlaySnapshot } from './googlePlay.js';
import { aggregate } from './aggregate.js';
import { buildFeedback } from './feedback.js';
import type { StoreRatingResponse, StoreReviewsResponse } from './types.js';

const PORT = Number(process.env.PROXY_PORT ?? 5174);

async function loadStoreRating(): Promise<StoreRatingResponse> {
  const snap = await getAppStoreSnapshot();
  return aggregate(snap);
}

async function loadStoreReviews(): Promise<StoreReviewsResponse> {
  const [appStore, googlePlay] = await Promise.all([
    getAppStoreSnapshot().catch((err) => {
      console.warn('[store-reviews] App Store fetch failed:', err);
      return null;
    }),
    getGooglePlaySnapshot().catch((err) => {
      console.warn('[store-reviews] Google Play fetch failed:', err);
      return null;
    }),
  ]);
  return {
    items: buildFeedback(appStore, googlePlay),
    sources: { appStore: appStore !== null, googlePlay: googlePlay !== null },
  };
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') {
    send(res, 404, { error: 'not found' });
    return;
  }
  if (req.url === '/api/store-rating') {
    try {
      send(res, 200, await loadStoreRating());
    } catch (err) {
      console.error('[store-rating]', err);
      send(res, 503, { error: err instanceof Error ? err.message : 'unknown' });
    }
    return;
  }
  if (req.url === '/api/store-reviews') {
    try {
      const data = await loadStoreReviews();
      const status = data.sources.appStore || data.sources.googlePlay ? 200 : 503;
      send(res, status, data);
    } catch (err) {
      console.error('[store-reviews]', err);
      send(res, 503, { error: err instanceof Error ? err.message : 'unknown' });
    }
    return;
  }
  send(res, 404, { error: 'not found' });
}

createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error('[proxy] unhandled', err);
    if (!res.headersSent) send(res, 500, { error: 'internal' });
  });
}).listen(PORT, () => {
  console.log(`[proxy] listening on http://localhost:${PORT}`);
});
