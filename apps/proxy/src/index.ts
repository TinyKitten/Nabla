import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { getAppStoreSnapshot } from './appStore.js';
import { getGooglePlaySnapshot } from './googlePlay.js';
import { getGitHubFeedbackSnapshot } from './github.js';
import { aggregate } from './aggregate.js';
import { buildFeedback } from './feedback.js';
import type { FeedbackResponse, StoreRatingResponse } from './types.js';

const PORT = Number(process.env.PROXY_PORT ?? 5174);

async function loadStoreRating(): Promise<StoreRatingResponse> {
  const snap = await getAppStoreSnapshot();
  return aggregate(snap);
}

async function loadFeedback(): Promise<FeedbackResponse> {
  const [github, appStore, googlePlay] = await Promise.all([
    getGitHubFeedbackSnapshot().catch((err) => {
      console.warn('[feedback] GitHub fetch failed:', err);
      return null;
    }),
    getAppStoreSnapshot().catch((err) => {
      console.warn('[feedback] App Store fetch failed:', err);
      return null;
    }),
    getGooglePlaySnapshot().catch((err) => {
      console.warn('[feedback] Google Play fetch failed:', err);
      return null;
    }),
  ]);
  const built = buildFeedback(github, appStore, googlePlay);
  return {
    items: built.items,
    hasMore: built.hasMore,
    sources: {
      github: github?.connected ?? false,
      appStore: appStore !== null,
      googlePlay: googlePlay !== null,
    },
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
  if (req.url === '/api/feedback') {
    try {
      const data = await loadFeedback();
      const anySource = data.sources.github || data.sources.appStore || data.sources.googlePlay;
      send(res, anySource ? 200 : 503, data);
    } catch (err) {
      console.error('[feedback]', err);
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
