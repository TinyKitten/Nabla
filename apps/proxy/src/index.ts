import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { fetchAppStore } from './appStore.js';
import { aggregate } from './aggregate.js';
import { fetchGitHubFeedback } from './github.js';
import type { FeedbackResponse, StoreRatingResponse } from './types.js';

const PORT = Number(process.env.PROXY_PORT ?? 5174);
const STORE_RATING_TTL_MS = 30 * 60 * 1000;
const FEEDBACK_TTL_MS = 5 * 60 * 1000;

let cachedStoreRating: { data: StoreRatingResponse; at: number } | null = null;
let storeRatingInFlight: Promise<StoreRatingResponse> | null = null;

let cachedFeedback: { data: FeedbackResponse; at: number } | null = null;
let feedbackInFlight: Promise<FeedbackResponse> | null = null;

async function loadStoreRating(): Promise<StoreRatingResponse> {
  if (cachedStoreRating && Date.now() - cachedStoreRating.at < STORE_RATING_TTL_MS) {
    return cachedStoreRating.data;
  }
  if (storeRatingInFlight) return storeRatingInFlight;
  storeRatingInFlight = (async () => {
    const snap = await fetchAppStore();
    const data = aggregate(snap);
    cachedStoreRating = { data, at: Date.now() };
    return data;
  })();
  try {
    return await storeRatingInFlight;
  } finally {
    storeRatingInFlight = null;
  }
}

async function loadFeedback(): Promise<FeedbackResponse> {
  if (cachedFeedback && Date.now() - cachedFeedback.at < FEEDBACK_TTL_MS) {
    return cachedFeedback.data;
  }
  if (feedbackInFlight) return feedbackInFlight;
  feedbackInFlight = (async () => {
    const snap = await fetchGitHubFeedback();
    const data: FeedbackResponse = {
      items: snap.items,
      hasMore: snap.hasMore,
      sources: { github: snap.connected },
    };
    cachedFeedback = { data, at: Date.now() };
    return data;
  })();
  try {
    return await feedbackInFlight;
  } finally {
    feedbackInFlight = null;
  }
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
      send(res, 200, await loadFeedback());
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
