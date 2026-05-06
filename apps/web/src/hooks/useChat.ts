import { useCallback, useRef, useState } from 'react';
import { fetchWeather, getCachedWeather } from '../data/weather';
import { fetchStoreRating, getCachedStoreRating } from '../data/storeRating';
import type { Message, ToolCall, WidgetType } from '../types';

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
    return `TrainLCD のストア評価は **★${r.stars}**(${r.reviews.toLocaleString()} レビュー)です。新規レビューは ${r.delta} です。`;
  } catch {
    return 'ストア評価を取得できませんでした。App Store Connect / Google Play の接続設定を確認してください。';
  }
}

export const QUICK_REPLIES: Record<string, QuickReply> = {
  weather: {
    tools: [{ name: 'get_weather', label: '天気を取得中', icon: 'globe' }],
    text: weatherReply,
    widget: 'weather',
  },
  rating: {
    tools: [
      { name: 'fetch_appstore', label: 'App Store から取得中', icon: 'star' },
      { name: 'fetch_playstore', label: 'Play Store から取得中', icon: 'star' },
    ],
    text: ratingReply,
    widget: 'storeRating',
  },
  feedback: {
    tools: [{ name: 'fetch_reviews', label: 'レビューを取得中', icon: 'history' }],
    text: '直近の新着フィードバックは 3 件です。「通勤で毎日使ってます」「中央線の英語表示お願いします」「デザインが綺麗で見やすい!」など。1件は機能要望なので、Issue化しますか?',
    widget: 'feedback',
  },
  perf: {
    tools: [{ name: 'fetch_metrics', label: 'パフォーマンス指標を取得中', icon: 'sparkle' }],
    text: '直近のパフォーマンスは良好です。クラッシュフリー率は **99.84%**(先週比 +0.05%)、コールドスタートは平均 1.21秒。週次トレンドは緩やかな改善傾向にあります。',
    widget: 'performance',
  },
  addWidget: {
    tools: [],
    text: 'どんなウィジェットを追加しますか?よく使われるのは以下です:\n\n- **天気** — 現在地の気温と天気\n- **ストア評価** — App Store / Play Store の星評価とトレンド\n- **新着フィードバック** — 直近のユーザーレビュー\n- **パフォーマンス** — クラッシュフリー率と起動時間\n- **タスク** — 進行中のタスク一覧\n\n名前を教えていただくか、「天気を追加して」のようにお伝えください。',
  },
};

function detectIntent(text: string): keyof typeof QUICK_REPLIES | null {
  const t = text.toLowerCase();
  if (/ウィジェットを追加|ウィジェット追加|widget add|add widget/.test(t)) return 'addWidget';
  if (/天気|weather|気温|雨/.test(t)) return 'weather';
  if (/評価|レーティング|星|rating|store/.test(t)) return 'rating';
  if (/フィードバック|レビュー|feedback|review|声/.test(t)) return 'feedback';
  if (/パフォーマンス|クラッシュ|起動|perf|crash/.test(t)) return 'perf';
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

      const intent = detectIntent(text);
      const canned = intent ? QUICK_REPLIES[intent] : null;

      try {
        let reply = '';
        let widget: WidgetType | undefined;
        let tools: ToolCall[] = [];

        if (canned) {
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

  return { messages, setMessages, input, setInput, send, stop, streaming };
}
