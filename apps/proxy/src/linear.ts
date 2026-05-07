const LINEAR_GRAPHQL_URL = 'https://api.linear.app/graphql';
const FETCH_TIMEOUT_MS = 10_000;
const ISSUE_LIMIT = 50;

export interface LinearTask {
  id: string;
  identifier: string;
  text: string;
  url: string;
  priority: number;
  dueDate: string | null;
  stateName: string;
  stateType: string;
}

interface LinearIssuesResponse {
  data?: {
    issues: {
      nodes: {
        id: string;
        identifier: string;
        title: string;
        url: string;
        priority: number;
        dueDate: string | null;
        state: { name: string; type: string };
      }[];
    };
  };
  errors?: { message: string }[];
}

const QUERY = `query NablaOpenIssues($first: Int!) {
  issues(
    first: $first,
    filter: { state: { type: { in: ["unstarted", "started"] } } },
    orderBy: updatedAt
  ) {
    nodes {
      id
      identifier
      title
      url
      priority
      dueDate
      state { name type }
    }
  }
}`;

export async function fetchLinearTasks(): Promise<LinearTask[]> {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) throw new Error('LINEAR_API_KEY not set');
  const res = await fetch(LINEAR_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: apiKey,
    },
    body: JSON.stringify({ query: QUERY, variables: { first: ISSUE_LIMIT } }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Linear ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as LinearIssuesResponse;
  if (json.errors?.length) {
    throw new Error(`Linear errors: ${json.errors.map((e) => e.message).join('; ')}`);
  }
  const nodes = json.data?.issues.nodes ?? [];
  return nodes
    .map((n) => ({
      id: n.id,
      identifier: n.identifier,
      text: n.title,
      url: n.url,
      priority: n.priority,
      dueDate: n.dueDate,
      stateName: n.state.name,
      stateType: n.state.type,
    }))
    .sort((a, b) => {
      const ap = a.priority === 0 ? 99 : a.priority;
      const bp = b.priority === 0 ? 99 : b.priority;
      if (ap !== bp) return ap - bp;
      const ad = a.dueDate ? Date.parse(a.dueDate) : Number.POSITIVE_INFINITY;
      const bd = b.dueDate ? Date.parse(b.dueDate) : Number.POSITIVE_INFINITY;
      return ad - bd;
    });
}
