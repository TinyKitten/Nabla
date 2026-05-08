import { useCallback, useRef, useState } from 'react';
import { fetchWeather, getCachedWeather } from '../data/weather';
import { fetchStoreRating, getCachedStoreRating } from '../data/storeRating';
import { fetchFeedback, getCachedFeedback } from '../data/feedback';
import { fetchPerformance, getCachedPerformance } from '../data/performance';
import { addLocalTask, fetchTasks, getCachedTasks } from '../data/tasks';
import { WEEKDAYS_JP, type FeedbackEntry, type Message, type ToolCall, type WidgetType } from '../types';

interface QuickReply {
  tools: ToolCall[];
  text: string | (() => Promise<string>);
  widget?: WidgetType;
}

async function weatherReply(): Promise<string> {
  try {
    const w = getCachedWeather() ?? (await fetchWeather());
    return `${w.location}は現在 ${w.temp}°、${w.cond}です。体感は ${w.feels}° で、降水確率は ${w.precip}%。`;
  } catch {
    return '天気情報を取得できませんでした。OpenWeather の接続設定を確認してください。';
  }
}

async function ratingReply(): Promise<string> {
  try {
    const r = getCachedStoreRating() ?? (await fetchStoreRating());
    return `TrainLCD の App Store 評価は **★${r.stars}**(${r.reviews.toLocaleString()} 件)です。テキストレビューは${r.delta}追加されました。`;
  } catch {
    return 'App Store 評価を取得できませんでした。App Store Connect の接続設定を確認してください。';
  }
}

async function tasksReply(): Promise<string> {
  try {
    const t = getCachedTasks() ?? (await fetchTasks());
    const open = t.items.filter((i) => !i.done);
    if (open.length === 0) {
      return '未完了のタスクはありません。お疲れさまでした。';
    }
    const linearOpen = open.filter((i) => i.source === 'linear').length;
    const localOpen = open.filter((i) => i.source === 'local').length;
    const breakdownParts: string[] = [];
    if (linearOpen) breakdownParts.push(`Linear ${linearOpen} 件`);
    if (localOpen) breakdownParts.push(`ローカル ${localOpen} 件`);
    const breakdown = breakdownParts.join(' / ');
    const samples = open.slice(0, 3).map((i) => `「${i.text.slice(0, 40)}」`).join('、');
    return `未完了のタスクは ${open.length} 件です(${breakdown})。${samples} など。「タスク追加 X」で新しいタスクを追加できます。`;
  } catch {
    return 'タスク情報を取得できませんでした。Linear の接続設定を確認してください。';
  }
}

async function perfReply(): Promise<string> {
  try {
    const p = getCachedPerformance() ?? (await fetchPerformance());
    const deltaSuffix = p.delta ? `(直近比 ${p.delta})` : '';
    return `直近 24h のクラッシュフリー率は **${p.crashFree.toFixed(2)}%** ${deltaSuffix}、コールドスタートは平均 ${p.coldStart.toFixed(2)} 秒、ANR は ${p.anr.toFixed(2)}% です(${p.sessions.toLocaleString()} セッション)。`;
  } catch {
    return 'パフォーマンス情報を取得できませんでした。Sentry の接続設定を確認してください。';
  }
}

async function clockReply(): Promise<string> {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const wd = WEEKDAYS_JP[now.getDay()];
  return `現在は **${hh}:${mm}**、${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 (${wd}) です。`;
}

async function feedbackReply(): Promise<string> {
  try {
    const f = getCachedFeedback() ?? (await fetchFeedback());
    if (f.items.length === 0) {
      return '新着のレビューもしくはフィードバックはありません。';
    }
    const ios = f.items.filter((i) => i.source === 'appStore').length;
    const android = f.items.filter((i) => i.source === 'googlePlay').length;
    const issues = f.items.filter((i) => i.source === 'github').length;
    const samples = f.items.slice(0, 3).map((i) => `「${i.text.slice(0, 40)}」`).join('、');
    const reviewParts: string[] = [];
    if (ios) reviewParts.push(`iOS ${ios} 件`);
    if (android) reviewParts.push(`Android ${android} 件`);
    const segments: string[] = [];
    if (reviewParts.length) segments.push(`レビュー ${reviewParts.join(' / ')}`);
    if (issues) segments.push(`GitHub フィードバック ${issues} 件`);
    const breakdown = segments.join('、');
    return `直近の新着は ${f.items.length} 件です(${breakdown})。${samples} など。Issue 化したいものがあれば教えてください。`;
  } catch {
    return 'レビューもしくはフィードバックを取得できませんでした。App Store Connect / Google Play Console / GitHub の接続設定を確認してください。';
  }
}

export const QUICK_REPLIES: Record<string, QuickReply> = {
  weather: {
    tools: [{ name: 'get_weather', label: '天気を取得中', icon: 'globe' }],
    text: weatherReply,
    widget: 'weather',
  },
  rating: {
    tools: [{ name: 'fetch_appstore', label: 'App Store から取得中', icon: 'star' }],
    text: ratingReply,
    widget: 'storeRating',
  },
  feedback: {
    tools: [{ name: 'fetch_reviews', label: 'レビューを取得中', icon: 'history' }],
    text: feedbackReply,
    widget: 'feedback',
  },
  perf: {
    tools: [{ name: 'fetch_metrics', label: 'パフォーマンス指標を取得中', icon: 'sparkle' }],
    text: perfReply,
    widget: 'performance',
  },
  tasks: {
    tools: [{ name: 'fetch_tasks', label: 'タスクを取得中', icon: 'check-square' }],
    text: tasksReply,
    widget: 'tasks',
  },
  clock: {
    tools: [],
    text: clockReply,
    widget: 'clock',
  },
  addWidget: {
    tools: [],
    text: 'どんなウィジェットを追加しますか？よく使われるのは以下です:\n\n- **天気** — 現在地の気温と天気\n- **App Store 評価** — App Store の星評価とトレンド\n- **新着レビュー** — 直近のユーザーレビュー\n- **パフォーマンス** — クラッシュフリー率と起動時間\n- **タスク** — 進行中のタスク一覧\n- **日時** — 現在の日付と時刻\n\n名前を教えていただくか、「天気を追加して」のようにお伝えください。',
  },
};

function detectIntent(text: string): keyof typeof QUICK_REPLIES | null {
  const t = text.toLowerCase();
  if (/ウィジェットを追加|ウィジェット追加|widget add|add widget/.test(t)) return 'addWidget';
  if (/天気|weather|気温|雨/.test(t)) return 'weather';
  if (/評価|レーティング|星|rating|store/.test(t)) return 'rating';
  if (/フィードバック|レビュー|feedback|review|声/.test(t)) return 'feedback';
  if (/パフォーマンス|クラッシュ|起動|perf|crash/.test(t)) return 'perf';
  if (/タスク|todo|task/.test(t)) return 'tasks';
  if (/時間|時刻|日時|日付|今何時/.test(t) || /\b(clock|time|date)\b/.test(t))
    return 'clock';
  return null;
}

const TASK_ADD_PATTERNS: RegExp[] = [
  /^タスク追加[:: ]\s*(.+)$/,
  /^タスクに追加[:: ]\s*(.+)$/,
  /^(.+?)をタスクに追加(?:して)?$/,
  /^todo[:: ]\s*(.+)$/i,
  /^add task[:: ]\s*(.+)$/i,
];

function detectTaskAdd(text: string): string | null {
  for (const re of TASK_ADD_PATTERNS) {
    const m = text.match(re);
    if (m && m[1].trim()) return m[1].trim();
  }
  return null;
}

export function useChat(initialMessages: Message[] = []) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const streamRef = useRef<string | null>(null);

  const send = useCallback(
    async (textArg?: string) => {
      const text = (textArg ?? input).trim();
      if (!text || streaming) return;

      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const userMsg: Message = { id: 'u' + Date.now(), role: 'user', text, time };
      const aiId = 'a' + Date.now();
      const aiMsg: Message = {
        id: aiId,
        role: 'ai',
        text: '',
        time,
        streaming: true,
        tools: [],
      };

      setMessages((prev) => [...prev, userMsg, aiMsg]);
      setInput('');
      setStreaming(true);
      streamRef.current = aiId;

      const taskAddText = detectTaskAdd(text);
      const intent = taskAddText ? null : detectIntent(text);
      const canned = intent ? QUICK_REPLIES[intent] : null;

      try {
        let reply = '';
        let widget: WidgetType | undefined;
        let tools: ToolCall[] = [];

        if (taskAddText) {
          tools = [{ name: 'add_task', label: 'タスクを追加中', icon: 'check-square', status: 'running' }];
          setMessages((prev) =>
            prev.map((m) => (m.id === aiId ? { ...m, tools: [...tools] } : m)),
          );
          await new Promise((r) => setTimeout(r, 350));
          if (streamRef.current !== aiId) {
            setMessages((prev) =>
              prev.map((m) => (m.id === aiId ? { ...m, tools: [] } : m)),
            );
            return;
          }
          const added = addLocalTask(taskAddText);
          tools[0].status = 'done';
          reply = added
            ? `「${added.text}」をタスクに追加しました。完了したらチェックを入れてください。`
            : 'タスクの内容が空でした。もう一度お試しください。';
          widget = 'tasks';
        } else if (canned) {
          const replyPromise: Promise<string> =
            typeof canned.text === 'function' ? canned.text() : Promise.resolve(canned.text);
          for (let idx = 0; idx < canned.tools.length; idx++) {
            if (streamRef.current !== aiId) return;
            const tool = canned.tools[idx];
            tools.push({ ...tool, status: 'running' });
            setMessages((prev) =>
              prev.map((m) => (m.id === aiId ? { ...m, tools: [...tools] } : m)),
            );
            await new Promise((r) => setTimeout(r, 700 + Math.random() * 600));
            if (idx === canned.tools.length - 1) {
              reply = await replyPromise;
            }
            tools[idx].status = 'done';
          }
          if (canned.tools.length === 0) reply = await replyPromise;
          widget = canned.widget;
        } else {
          tools = [{ name: 'thinking', label: '考え中', icon: 'sparkle', status: 'running' }];
          setMessages((prev) =>
            prev.map((m) => (m.id === aiId ? { ...m, tools: [...tools] } : m)),
          );
          await new Promise((r) => setTimeout(r, 800));
          tools[0].status = 'done';
          reply = '了解しました。これはサンプル応答です。';
        }

        const chars = [...reply];
        let i = 0;
        const tick = () => {
          if (streamRef.current !== aiId) return;
          i = Math.min(chars.length, i + Math.max(1, Math.round(chars.length / 60)));
          const partial = chars.slice(0, i).join('');
          setMessages((prev) =>
            prev.map((m) => (m.id === aiId ? { ...m, text: partial, tools } : m)),
          );
          if (i < chars.length) {
            setTimeout(tick, 28);
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiId ? { ...m, streaming: false, actions: true, widget } : m,
              ),
            );
            setStreaming(false);
            streamRef.current = null;
          }
        };
        setTimeout(tick, 200);
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId
              ? { ...m, text: 'エラーが発生しました。もう一度お試しください。', streaming: false }
              : m,
          ),
        );
        setStreaming(false);
        streamRef.current = null;
      }
    },
    [input, streaming],
  );

  const stop = useCallback(() => {
    streamRef.current = null;
    setStreaming(false);
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false, actions: true } : m)),
    );
  }, []);

  const sendFeedbackDetail = useCallback(
    (entry: FeedbackEntry) => {
      if (streaming) return;
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const sourceLabel =
        entry.source === 'github'
          ? 'GitHub フィードバック'
          : entry.source === 'appStore'
            ? 'App Store レビュー'
            : 'Google Play レビュー';
      const userText = entry.title
        ? `「${entry.title}」の詳細を教えて`
        : 'このレビューの詳細を教えて';
      const titleLine = entry.title ? `**${entry.title}**\n\n` : '';
      const bodyLine = entry.text || '(本文なし)';
      const starsPart = entry.stars > 0 ? `★${entry.stars} · ` : '';
      const reply = `${titleLine}${bodyLine}\n\n— ${sourceLabel} · ${starsPart}${entry.when} · ${entry.author}`;

      const aiId = 'a' + Date.now();
      const userMsg: Message = { id: 'u' + Date.now(), role: 'user', text: userText, time };
      const proxiedImages = entry.images?.map((u) => {
        try {
          const parsed = new URL(u);
          const needsProxy =
            parsed.protocol === 'https:' &&
            (parsed.hostname === 'github.com' ||
              parsed.hostname.endsWith('.githubusercontent.com'));
          return needsProxy ? `/api/github-image?url=${encodeURIComponent(u)}` : u;
        } catch {
          return u;
        }
      });
      const aiMsg: Message = {
        id: aiId,
        role: 'ai',
        text: '',
        time,
        streaming: true,
        tools: [],
        labels: entry.labels,
        images: proxiedImages,
      };
      setMessages((prev) => [...prev, userMsg, aiMsg]);
      setStreaming(true);
      streamRef.current = aiId;

      const chars = [...reply];
      let i = 0;
      const tick = () => {
        if (streamRef.current !== aiId) return;
        i = Math.min(chars.length, i + Math.max(1, Math.round(chars.length / 60)));
        const partial = chars.slice(0, i).join('');
        setMessages((prev) =>
          prev.map((m) => (m.id === aiId ? { ...m, text: partial } : m)),
        );
        if (i < chars.length) {
          setTimeout(tick, 28);
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiId ? { ...m, streaming: false, actions: true } : m,
            ),
          );
          setStreaming(false);
          streamRef.current = null;
        }
      };
      setTimeout(tick, 200);
    },
    [streaming],
  );

  return { messages, setMessages, input, setInput, send, stop, streaming, sendFeedbackDetail };
}
