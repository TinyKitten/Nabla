import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { getAppStoreSnapshot } from './appStore.js';
import { getGooglePlaySnapshot } from './googlePlay.js';
import { getGitHubFeedbackSnapshot } from './github.js';
import { aggregate } from './aggregate.js';
import { buildFeedback, buildReviews } from './feedback.js';
import { fetchLinearTasks } from './linear.js';
import { getSentryPerformanceSnapshot } from './sentry.js';
import { fetchWeatherSnapshot, isOpenWeatherConfigured } from './weather.js';
import type {
  FeedbackResponse,
  PerformanceResponse,
  ReviewsResponse,
  StoreRatingResponse,
  TasksResponse,
  WeatherResponse,
} from './types.js';

const PORT = Number(process.env.PROXY_PORT ?? 5174);
const TASKS_TTL_MS = 60 * 1000;
const WEATHER_TTL_MS = 5 * 60 * 1000;

let cachedTasks: { data: TasksResponse; at: number } | null = null;
let tasksInFlight: Promise<TasksResponse> | null = null;

const weatherCache = new Map<string, { data: WeatherResponse; at: number }>();
const weatherInFlight = new Map<string, Promise<WeatherResponse>>();

async function loadStoreRating(): Promise<StoreRatingResponse> {
  const snap = await getAppStoreSnapshot();
  return aggregate(snap);
}

async function loadFeedback(): Promise<FeedbackResponse> {
  const github = await getGitHubFeedbackSnapshot().catch((err) => {
    console.warn('[feedback] GitHub fetch failed:', err);
    return null;
  });
  const built = buildFeedback(github);
  return {
    items: built.items,
    unread: built.unread,
    hasMore: built.hasMore,
    sources: { github: github?.connected ?? false },
  };
}

async function loadReviews(): Promise<ReviewsResponse> {
  const [appStore, googlePlay] = await Promise.all([
    getAppStoreSnapshot().catch((err) => {
      console.warn('[reviews] App Store fetch failed:', err);
      return null;
    }),
    getGooglePlaySnapshot().catch((err) => {
      console.warn('[reviews] Google Play fetch failed:', err);
      return null;
    }),
  ]);
  const built = buildReviews(appStore, googlePlay);
  return {
    items: built.items,
    sources: {
      appStore: appStore !== null,
      googlePlay: googlePlay !== null,
    },
  };
}

async function loadPerformance(): Promise<PerformanceResponse> {
  const snap = await getSentryPerformanceSnapshot();
  if (!snap) {
    return {
      crashFree: 0,
      delta: '',
      coldStart: 0,
      sparkline: [],
      sessions: 0,
      anr: 0,
      sources: { sentry: false },
    };
  }
  return {
    crashFree: snap.crashFree,
    delta: snap.delta,
    coldStart: snap.coldStart,
    sparkline: snap.sparkline,
    sessions: snap.sessions,
    anr: snap.anr,
    sources: { sentry: snap.connected },
  };
}

async function loadTasks(): Promise<TasksResponse> {
  if (cachedTasks && Date.now() - cachedTasks.at < TASKS_TTL_MS) return cachedTasks.data;
  if (tasksInFlight) return tasksInFlight;
  tasksInFlight = (async () => {
    try {
      const items = await fetchLinearTasks();
      const data: TasksResponse = { items, sources: { linear: true } };
      cachedTasks = { data, at: Date.now() };
      return data;
    } catch (err) {
      const data: TasksResponse = { items: [], sources: { linear: false } };
      console.warn('[tasks] linear fetch failed:', err instanceof Error ? err.message : err);
      return data;
    }
  })();
  try {
    return await tasksInFlight;
  } finally {
    tasksInFlight = null;
  }
}

function parseCoord(value: string | null, min: number, max: number): number | null {
  if (value == null || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

async function loadWeather(lat: number, lon: number): Promise<WeatherResponse> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const cached = weatherCache.get(key);
  if (cached) {
    if (Date.now() - cached.at < WEATHER_TTL_MS) return cached.data;
    weatherCache.delete(key);
  }
  const existing = weatherInFlight.get(key);
  if (existing) return existing;
  const promise = (async () => {
    try {
      const data = await fetchWeatherSnapshot(lat, lon);
      weatherCache.set(key, { data, at: Date.now() });
      return data;
    } finally {
      weatherInFlight.delete(key);
    }
  })();
  weatherInFlight.set(key, promise);
  return promise;
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

const GITHUB_IMAGE_FETCH_TIMEOUT_MS = 15_000;

function isAllowedGitHubHost(hostname: string): boolean {
  return hostname === 'github.com' || hostname.endsWith('.githubusercontent.com');
}

async function streamGitHubImage(res: ServerResponse, raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    send(res, 400, { error: 'invalid url' });
    return;
  }
  if (url.protocol !== 'https:' || !isAllowedGitHubHost(url.hostname)) {
    send(res, 400, { error: 'host not allowed' });
    return;
  }
  const headers: Record<string, string> = { 'User-Agent': 'nabla-proxy' };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  let upstream: Response;
  try {
    const signal = AbortSignal.timeout(GITHUB_IMAGE_FETCH_TIMEOUT_MS);
    const MAX_REDIRECTS = 5;
    let current = url;
    let hops = 0;
    while (true) {
      const r = await fetch(current.toString(), { headers, redirect: 'manual', signal });
      if (r.status < 300 || r.status >= 400) {
        upstream = r;
        break;
      }
      const loc = r.headers.get('location');
      if (!loc) {
        upstream = r;
        break;
      }
      if (++hops > MAX_REDIRECTS) {
        send(res, 502, { error: 'too many redirects' });
        return;
      }
      let next: URL;
      try {
        next = new URL(loc, current);
      } catch {
        send(res, 502, { error: 'invalid redirect target' });
        return;
      }
      if (next.protocol !== 'https:' || !isAllowedGitHubHost(next.hostname)) {
        send(res, 400, { error: 'redirect to disallowed host' });
        return;
      }
      current = next;
    }
  } catch (err) {
    console.warn('[github-image] fetch failed:', err instanceof Error ? err.message : err);
    send(res, 502, { error: 'upstream fetch failed' });
    return;
  }
  if (!upstream.ok || !upstream.body) {
    send(res, upstream.status, { error: 'upstream error' });
    return;
  }
  const ct = upstream.headers.get('content-type') ?? 'application/octet-stream';
  if (!ct.startsWith('image/')) {
    send(res, 415, { error: 'not an image' });
    return;
  }
  res.writeHead(200, {
    'content-type': ct,
    'cache-control': 'private, max-age=300',
  });
  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) res.write(value);
    }
  } finally {
    res.end();
  }
}

const OPENCLAW_FETCH_TIMEOUT_MS = 120_000;

async function streamOpenClawChat(req: IncomingMessage, res: ServerResponse) {
  const baseUrl = process.env.OPENCLAW_GATEWAY_URL;
  const token = process.env.OPENCLAW_GATEWAY_TOKEN;
  if (!baseUrl || !token) {
    send(res, 503, { error: 'OPENCLAW_GATEWAY_URL / OPENCLAW_GATEWAY_TOKEN not configured' });
    return;
  }
  const chunks: Buffer[] = [];
  let total = 0;
  const MAX_BODY = 1_000_000;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    total += buf.length;
    if (total > MAX_BODY) {
      send(res, 413, { error: 'request body too large' });
      return;
    }
    chunks.push(buf);
  }
  const body = Buffer.concat(chunks).toString('utf8');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), OPENCLAW_FETCH_TIMEOUT_MS);
  req.on('close', () => ctrl.abort());
  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body,
      signal: ctrl.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    console.warn('[chat] upstream fetch failed:', err instanceof Error ? err.message : err);
    if (!res.headersSent) send(res, 502, { error: 'upstream fetch failed' });
    return;
  }
  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    clearTimeout(timer);
    if (!res.headersSent) {
      res.writeHead(upstream.status, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'upstream error', status: upstream.status, body: text.slice(0, 1000) }));
    }
    return;
  }
  res.writeHead(200, {
    'content-type': upstream.headers.get('content-type') ?? 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    'x-accel-buffering': 'no',
    connection: 'keep-alive',
  });
  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value && !res.write(value)) {
        await new Promise<void>((resolve) => res.once('drain', resolve));
      }
    }
  } catch (err) {
    console.warn('[chat] stream relay failed:', err instanceof Error ? err.message : err);
  } finally {
    clearTimeout(timer);
    res.end();
  }
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'POST' && req.url === '/api/chat') {
    await streamOpenClawChat(req, res);
    return;
  }
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
      send(res, data.sources.github ? 200 : 503, data);
    } catch (err) {
      console.error('[feedback]', err);
      send(res, 503, { error: err instanceof Error ? err.message : 'unknown' });
    }
    return;
  }
  if (req.url === '/api/reviews') {
    try {
      const data = await loadReviews();
      const anySource = data.sources.appStore || data.sources.googlePlay;
      send(res, anySource ? 200 : 503, data);
    } catch (err) {
      console.error('[reviews]', err);
      send(res, 503, { error: err instanceof Error ? err.message : 'unknown' });
    }
    return;
  }
  if (req.url === '/api/performance') {
    try {
      const data = await loadPerformance();
      send(res, data.sources.sentry ? 200 : 503, data);
    } catch (err) {
      console.error('[performance]', err);
      send(res, 503, { error: err instanceof Error ? err.message : 'unknown' });
    }
    return;
  }
  if (req.url === '/api/tasks') {
    send(res, 200, await loadTasks());
    return;
  }
  const url = req.url ? new URL(req.url, 'http://localhost') : null;
  if (url?.pathname === '/api/github-image') {
    const raw = url.searchParams.get('url');
    if (!raw) {
      send(res, 400, { error: 'url query param is required' });
      return;
    }
    await streamGitHubImage(res, raw);
    return;
  }
  if (url?.pathname === '/api/weather') {
    const lat = parseCoord(url.searchParams.get('lat'), -90, 90);
    const lon = parseCoord(url.searchParams.get('lon'), -180, 180);
    if (lat == null || lon == null) {
      send(res, 400, { error: 'lat / lon query params are required' });
      return;
    }
    if (!isOpenWeatherConfigured()) {
      send(res, 503, {
        error: 'OPENWEATHER_API_KEY not configured',
        sources: { openWeather: false },
      });
      return;
    }
    try {
      send(res, 200, await loadWeather(lat, lon));
    } catch (err) {
      console.error('[weather]', err);
      send(res, 503, {
        error: err instanceof Error ? err.message : 'unknown',
        sources: { openWeather: false },
      });
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
