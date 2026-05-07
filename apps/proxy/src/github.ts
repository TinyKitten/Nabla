import type { FeedbackEntrySnapshot } from './types.js';

const REPO = 'TrainLCD/Issues';
const FEEDBACK_LABEL = '🙏 Feedback';
const PER_PAGE = 100;
const FETCH_TIMEOUT_MS = 10_000;
const SNAPSHOT_TTL_MS = 5 * 60 * 1000;

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  created_at: string;
  pull_request?: unknown;
}

function extractGeminiSummary(body: string | null): string | null {
  if (!body) return null;
  const match = body.match(/##\s*Gemini[^\n]*\n([\s\S]*?)(?:\n##\s|$)/);
  if (!match) return null;
  const text = match[1].trim();
  return text.length > 0 ? text : null;
}

export interface GitHubFeedbackSnapshot {
  items: FeedbackEntrySnapshot[];
  hasMore: boolean;
  connected: boolean;
}

async function fetchGitHubFeedback(): Promise<GitHubFeedbackSnapshot> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return { items: [], hasMore: false, connected: false };
  }

  const url =
    `https://api.github.com/repos/${REPO}/issues` +
    `?state=open&labels=${encodeURIComponent(FEEDBACK_LABEL)}` +
    `&per_page=${PER_PAGE}&sort=created&direction=desc`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'nabla-proxy',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`GitHub Issues ${res.status}: ${await res.text()}`);
  }

  const hasMore = (res.headers.get('link') ?? '').includes('rel="next"');
  const issues = (await res.json()) as GitHubIssue[];
  const items: FeedbackEntrySnapshot[] = issues
    .filter((i) => !i.pull_request)
    .map((i) => {
      const summary = extractGeminiSummary(i.body);
      return {
        text: summary ?? i.title,
        author: '匿名',
        createdAt: Date.parse(i.created_at),
        stars: 0,
        source: 'github',
      };
    });

  return { items, hasMore, connected: true };
}

let snapshotCache: { data: GitHubFeedbackSnapshot; at: number } | null = null;
let snapshotInFlight: Promise<GitHubFeedbackSnapshot> | null = null;

export async function getGitHubFeedbackSnapshot(): Promise<GitHubFeedbackSnapshot> {
  if (snapshotCache && Date.now() - snapshotCache.at < SNAPSHOT_TTL_MS) return snapshotCache.data;
  if (snapshotInFlight) return snapshotInFlight;
  snapshotInFlight = (async () => {
    try {
      const snap = await fetchGitHubFeedback();
      snapshotCache = { data: snap, at: Date.now() };
      return snap;
    } finally {
      snapshotInFlight = null;
    }
  })();
  return snapshotInFlight;
}
