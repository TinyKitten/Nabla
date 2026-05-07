const SENTRY_BASE = 'https://sentry.io/api/0';
const FETCH_TIMEOUT_MS = 10_000;
const SNAPSHOT_TTL_MS = 5 * 60 * 1000;

export interface SentryPerformanceSnapshot {
  crashFree: number;
  delta: string;
  coldStart: number;
  sparkline: number[];
  sessions: number;
  anr: number;
  connected: boolean;
}

interface SentrySessionsResponse {
  groups: {
    by: Record<string, string>;
    totals: Record<string, number>;
    series: Record<string, number[]>;
  }[];
  intervals: string[];
}

interface SentryEventsResponse {
  data: Record<string, number | string | null>[];
}

interface SentryProjectResponse {
  id: string;
}

let projectIdCache: { slug: string; id: string } | null = null;

async function resolveProjectId(org: string, slug: string, token: string): Promise<string> {
  if (projectIdCache && projectIdCache.slug === slug) return projectIdCache.id;
  const res = await fetch(`${SENTRY_BASE}/projects/${org}/${slug}/`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Sentry project lookup ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as SentryProjectResponse;
  projectIdCache = { slug, id: json.id };
  return json.id;
}

async function callSentry<T>(path: string, params: URLSearchParams, token: string): Promise<T> {
  const res = await fetch(`${SENTRY_BASE}${path}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Sentry ${path} ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

function fetchSessions(org: string, projectId: string, token: string) {
  const params = new URLSearchParams({
    project: projectId,
    statsPeriod: '7d',
    interval: '1d',
  });
  params.append('field', 'crash_free_rate(session)');
  params.append('field', 'sum(session)');
  return callSentry<SentrySessionsResponse>(
    `/organizations/${org}/sessions/`,
    params,
    token,
  );
}

function fetchAbnormalSessions(org: string, projectId: string, token: string) {
  const params = new URLSearchParams({
    project: projectId,
    statsPeriod: '24h',
    interval: '1h',
    query: 'session.status:abnormal',
  });
  params.append('field', 'sum(session)');
  return callSentry<SentrySessionsResponse>(
    `/organizations/${org}/sessions/`,
    params,
    token,
  );
}

function fetchTotalSessions24h(org: string, projectId: string, token: string) {
  const params = new URLSearchParams({
    project: projectId,
    statsPeriod: '24h',
    interval: '1h',
  });
  params.append('field', 'sum(session)');
  return callSentry<SentrySessionsResponse>(
    `/organizations/${org}/sessions/`,
    params,
    token,
  );
}

function fetchColdStart(org: string, projectId: string, token: string) {
  const params = new URLSearchParams({
    project: projectId,
    statsPeriod: '24h',
    dataset: 'metrics',
  });
  params.append('field', 'avg(measurements.app_start_cold)');
  return callSentry<SentryEventsResponse>(
    `/organizations/${org}/events/`,
    params,
    token,
  );
}

function formatDelta(currentRate: number, previousRate: number): string {
  const diff = currentRate - previousRate;
  const pct = diff * 100;
  const sign = pct >= 0 ? '+' : '−';
  return `${sign}${Math.abs(pct).toFixed(2)}%`;
}

async function fetchSentryPerformance(): Promise<SentryPerformanceSnapshot> {
  const org = process.env.SENTRY_ORG_SLUG;
  const projectSlug = process.env.SENTRY_PROJECT_SLUG;
  const token = process.env.SENTRY_AUTH_TOKEN;
  if (!org || !projectSlug || !token) {
    throw new Error('SENTRY_ORG_SLUG / SENTRY_PROJECT_SLUG / SENTRY_AUTH_TOKEN not set');
  }
  const projectId = await resolveProjectId(org, projectSlug, token);
  const [sessions, abnormal, total24h, coldStart] = await Promise.all([
    fetchSessions(org, projectId, token),
    fetchAbnormalSessions(org, projectId, token),
    fetchTotalSessions24h(org, projectId, token),
    fetchColdStart(org, projectId, token),
  ]);

  const group = sessions.groups[0];
  if (!group) {
    throw new Error('Sentry sessions response had no groups');
  }
  const crashSeries = group.series['crash_free_rate(session)'] ?? [];
  const sessionSeries = group.series['sum(session)'] ?? [];
  const latestRate = crashSeries.length > 0 ? crashSeries[crashSeries.length - 1] : 0;
  const previousRate = crashSeries.length > 1 ? crashSeries[crashSeries.length - 2] : latestRate;
  const sparkline = crashSeries.map((v) => Number((v * 100).toFixed(2)));
  const sessionsLatest = sessionSeries.length > 0 ? sessionSeries[sessionSeries.length - 1] : 0;

  let anrPercent = 0;
  const abnormalCount = abnormal.groups[0]?.totals['sum(session)'] ?? 0;
  const totalCount = total24h.groups[0]?.totals['sum(session)'] ?? 0;
  if (totalCount > 0) {
    anrPercent = (abnormalCount / totalCount) * 100;
  }

  let coldStartSec = 0;
  const ms = coldStart.data[0]?.['avg(measurements.app_start_cold)'];
  if (typeof ms === 'number' && Number.isFinite(ms)) {
    coldStartSec = ms / 1000;
  }

  return {
    crashFree: Number((latestRate * 100).toFixed(2)),
    delta: formatDelta(latestRate, previousRate),
    coldStart: Number(coldStartSec.toFixed(2)),
    sparkline,
    sessions: Math.round(sessionsLatest),
    anr: Number(anrPercent.toFixed(2)),
    connected: true,
  };
}

let snapshotCache: { data: SentryPerformanceSnapshot; at: number } | null = null;
let snapshotInFlight: Promise<SentryPerformanceSnapshot> | null = null;

export async function getSentryPerformanceSnapshot(): Promise<SentryPerformanceSnapshot | null> {
  if (snapshotCache && Date.now() - snapshotCache.at < SNAPSHOT_TTL_MS) return snapshotCache.data;
  if (!snapshotInFlight) {
    snapshotInFlight = (async () => {
      try {
        const snap = await fetchSentryPerformance();
        snapshotCache = { data: snap, at: Date.now() };
        return snap;
      } finally {
        snapshotInFlight = null;
      }
    })();
  }
  try {
    return await snapshotInFlight;
  } catch (err) {
    console.warn(
      '[performance] Sentry fetch failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
