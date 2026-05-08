import { useCallback, useRef, useState } from 'react';
import { addLocalTask } from '../data/tasks';
import { streamChat, type ChatTurn } from '../data/openclaw';
import { type FeedbackEntry, type Message, type ToolCall, type WidgetType } from '../types';

const SYSTEM_PROMPT = [
  'あなたは Nabla という個人向けデスクトップアシスタントの応答エージェントです。',
  '応答は日本語、です/ます調で簡潔に。Markdown は最小限に使ってよい。',
  '画面右側には天気・App Store 評価・新着レビュー・パフォーマンス・タスク・時計のウィジェットがあり、',
  'ユーザーが該当キーワードを言うと自動で関連ウィジェットが添えられる。ウィジェットの内容には踏み込まず、文章だけで答える。',
].join('\n');

function detectWidget(text: string): WidgetType | null {
  const t = text.toLowerCase();
  if (/天気|weather|気温|雨/.test(t)) return 'weather';
  if (/評価|レーティング|星|rating|store/.test(t)) return 'storeRating';
  if (/フィードバック|レビュー|feedback|review|声/.test(t)) return 'feedback';
  if (/パフォーマンス|クラッシュ|起動|perf|crash/.test(t)) return 'performance';
  if (/タスク|todo|task/.test(t)) return 'tasks';
  if (/時間|時刻|日時|日付|今何時/.test(t) || /\b(clock|time|date)\b/.test(t)) return 'clock';
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

function buildHistory(messages: Message[]): ChatTurn[] {
  const turns: ChatTurn[] = [{ role: 'system', content: SYSTEM_PROMPT }];
  for (const m of messages) {
    if (!m.text) continue;
    if (m.role === 'user') turns.push({ role: 'user', content: m.text });
    else if (m.role === 'ai') turns.push({ role: 'assistant', content: m.text });
  }
  return turns;
}

export function useChat(initialMessages: Message[] = []) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const streamRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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

      const historyBeforeUser = messages;
      setMessages((prev) => [...prev, userMsg, aiMsg]);
      setInput('');
      setStreaming(true);
      streamRef.current = aiId;

      const taskAddText = detectTaskAdd(text);

      try {
        if (taskAddText) {
          const tools: ToolCall[] = [
            { name: 'add_task', label: 'タスクを追加中', icon: 'check-square', status: 'running' },
          ];
          setMessages((prev) =>
            prev.map((m) => (m.id === aiId ? { ...m, tools: [...tools] } : m)),
          );
          await new Promise((r) => setTimeout(r, 250));
          if (streamRef.current !== aiId) return;
          const added = addLocalTask(taskAddText);
          tools[0].status = 'done';
          const reply = added
            ? `「${added.text}」をタスクに追加しました。完了したらチェックを入れてください。`
            : 'タスクの内容が空でした。もう一度お試しください。';
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiId
                ? { ...m, text: reply, tools, streaming: false, actions: true, widget: 'tasks' }
                : m,
            ),
          );
          setStreaming(false);
          streamRef.current = null;
          return;
        }

        const widget = detectWidget(text);
        const tools: ToolCall[] = [
          { name: 'openclaw', label: '考え中', icon: 'sparkle', status: 'running' },
        ];
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId ? { ...m, tools: [...tools], format: 'markdown' } : m,
          ),
        );

        const ctrl = new AbortController();
        abortRef.current = ctrl;
        const turns: ChatTurn[] = [
          ...buildHistory(historyBeforeUser),
          { role: 'user', content: text },
        ];
        let acc = '';
        let firstDelta = true;
        await streamChat({
          messages: turns,
          signal: ctrl.signal,
          onDelta: (delta) => {
            if (streamRef.current !== aiId) return;
            acc += delta;
            if (firstDelta) {
              firstDelta = false;
              tools[0].status = 'done';
            }
            setMessages((prev) =>
              prev.map((m) => (m.id === aiId ? { ...m, text: acc, tools: [...tools] } : m)),
            );
          },
        });
        if (streamRef.current !== aiId) return;
        if (firstDelta) tools[0].status = 'done';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId
              ? {
                  ...m,
                  text: acc || '(応答が空でした)',
                  tools: [...tools],
                  streaming: false,
                  actions: true,
                  widget,
                  format: 'markdown',
                }
              : m,
          ),
        );
        setStreaming(false);
        streamRef.current = null;
        abortRef.current = null;
      } catch (err) {
        if (streamRef.current !== aiId) return;
        const message =
          err instanceof Error && err.name === 'AbortError'
            ? '応答を停止しました。'
            : 'OpenClaw に接続できませんでした。gateway が起動しているか、`/v1/chat/completions` が有効化されているか確認してください。';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId ? { ...m, text: message, streaming: false, tools: [], actions: true } : m,
          ),
        );
        setStreaming(false);
        streamRef.current = null;
        abortRef.current = null;
      }
    },
    [input, streaming, messages],
  );

  const stop = useCallback(() => {
    streamRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
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
