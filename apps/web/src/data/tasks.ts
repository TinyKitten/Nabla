import type { TaskEntry, TasksData } from '../types';
import { setToolConnected } from '../state/toolConnections';

const FETCH_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 60 * 1000;
const STORAGE_KEY = 'nabla.tasks.v1';

interface LinearTaskItem {
  id: string;
  identifier: string;
  text: string;
  url: string;
  priority: number;
  dueDate: string | null;
  stateName: string;
  stateType: string;
}

interface TasksApiResponse {
  items: LinearTaskItem[];
  sources: { linear: boolean };
}

interface LocalTaskRecord {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

interface PersistedState {
  localTasks: LocalTaskRecord[];
  linearOverrides: Record<string, boolean>;
}

const EMPTY_STATE: PersistedState = { localTasks: [], linearOverrides: {} };

function readState(): PersistedState {
  if (typeof localStorage === 'undefined') return { ...EMPTY_STATE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_STATE };
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      localTasks: Array.isArray(parsed.localTasks) ? parsed.localTasks : [],
      linearOverrides:
        parsed.linearOverrides && typeof parsed.linearOverrides === 'object'
          ? parsed.linearOverrides
          : {},
    };
  } catch {
    return { ...EMPTY_STATE };
  }
}

function writeState(state: PersistedState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable / quota — fall through silently
  }
}

let cached: { data: TasksData; at: number } | null = null;
let inFlight: Promise<TasksData> | null = null;

function buildSnapshot(linear: LinearTaskItem[], state: PersistedState): TasksData {
  const fromLinear: TaskEntry[] = linear.map((it) => ({
    id: 'linear:' + it.id,
    text: it.identifier ? `${it.identifier} ${it.text}` : it.text,
    done: state.linearOverrides[it.id] ?? false,
    source: 'linear',
    identifier: it.identifier,
    url: it.url,
  }));
  const fromLocal: TaskEntry[] = state.localTasks
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((t) => ({
      id: 'local:' + t.id,
      text: t.text,
      done: t.done,
      source: 'local',
    }));
  return { items: [...fromLinear, ...fromLocal] };
}

export function getCachedTasks(maxAgeMs = CACHE_TTL_MS): TasksData | null {
  if (!cached) return null;
  if (Date.now() - cached.at > maxAgeMs) return null;
  return cached.data;
}

export async function fetchTasks(): Promise<TasksData> {
  const fresh = getCachedTasks();
  if (fresh) return fresh;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let linear: LinearTaskItem[] = [];
    let linearConnected = false;
    let fetchOk = false;
    try {
      const res = await fetch('/api/tasks', { signal: ctrl.signal });
      if (res.ok) {
        const json = (await res.json()) as TasksApiResponse;
        linear = json.items;
        linearConnected = json.sources.linear;
        fetchOk = true;
      }
    } catch {
      linearConnected = false;
    } finally {
      clearTimeout(timer);
    }
    setToolConnected('linear', linearConnected);
    const data = buildSnapshot(linear, readState());
    if (fetchOk) cached = { data, at: Date.now() };
    inFlight = null;
    return data;
  })();
  return inFlight;
}

export const TASKS_CHANGED_EVENT = 'nabla-tasks-changed';

function invalidate(): void {
  cached = null;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TASKS_CHANGED_EVENT));
  }
}

export function toggleTaskDone(entryId: string): void {
  const state = readState();
  if (entryId.startsWith('linear:')) {
    const linearId = entryId.slice('linear:'.length);
    const next = !(state.linearOverrides[linearId] ?? false);
    state.linearOverrides = { ...state.linearOverrides, [linearId]: next };
  } else if (entryId.startsWith('local:')) {
    const localId = entryId.slice('local:'.length);
    state.localTasks = state.localTasks.map((t) =>
      t.id === localId ? { ...t, done: !t.done } : t,
    );
  } else {
    return;
  }
  writeState(state);
  invalidate();
}

export function addLocalTask(text: string): TaskEntry | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const state = readState();
  const record: LocalTaskRecord = {
    id: Math.random().toString(36).slice(2, 10),
    text: trimmed,
    done: false,
    createdAt: Date.now(),
  };
  state.localTasks = [...state.localTasks, record];
  writeState(state);
  invalidate();
  return {
    id: 'local:' + record.id,
    text: record.text,
    done: false,
    source: 'local',
  };
}
