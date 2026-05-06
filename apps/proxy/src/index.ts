import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { fetchAppStore } from './appStore.js';
import { aggregate } from './aggregate.js';
import { fetchLinearTasks } from './linear.js';
import type { StoreRatingResponse, TasksResponse } from './types.js';

const PORT = Number(process.env.PROXY_PORT ?? 5174);
const CACHE_TTL_MS = 30 * 60 * 1000;
const TASKS_CACHE_TTL_MS = 60 * 1000;

let cached: { data: StoreRatingResponse; at: number } | null = null;
let inFlight: Promise<StoreRatingResponse> | null = null;
let cachedTasks: { data: TasksResponse; at: number } | null = null;
let tasksInFlight: Promise<TasksResponse> | null = null;

async function loadStoreRating(): Promise<StoreRatingResponse> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const snap = await fetchAppStore();
    const data = aggregate(snap);
    cached = { data, at: Date.now() };
    return data;
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

async function loadTasks(): Promise<TasksResponse> {
  if (cachedTasks && Date.now() - cachedTasks.at < TASKS_CACHE_TTL_MS) return cachedTasks.data;
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
      const data = await loadStoreRating();
      send(res, 200, data);
    } catch (err) {
      console.error('[store-rating]', err);
      send(res, 503, { error: err instanceof Error ? err.message : 'unknown' });
    }
    return;
  }
  if (req.url === '/api/tasks') {
    const data = await loadTasks();
    send(res, 200, data);
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
