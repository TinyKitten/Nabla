import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { getAppStoreSnapshot } from './appStore.js';
import { getGooglePlaySnapshot } from './googlePlay.js';
import { getGitHubFeedbackSnapshot } from './github.js';
import { aggregate } from './aggregate.js';
import { buildFeedback } from './feedback.js';
import { fetchLinearTasks } from './linear.js';
import { getSentryPerformanceSnapshot } from './sentry.js';
import { fetchWeatherSnapshot, isOpenWeatherConfigured } from './weather.js';
import type {
  FeedbackResponse,
  PerformanceResponse,
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
    unread: built.unread,
    hasMore: built.hasMore,
    sources: {
      github: github?.connected ?? false,
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
