import { useCallback, useRef, useState } from 'react';
import type { Message, ToolCall, WidgetType } from '../types';

interface QuickReply {
  tools: ToolCall[];
  text: string;
  widget?: WidgetType;
}

export const QUICK_REPLIES: Record<string, QuickReply> = {
  weather: {
    tools: [{ name: 'get_weather', label: '天気を取得中', icon: 'globe' }],
    text: '東京・渋谷は現在 18°、晴れ時々曇りです。体感は 17° で、降水確率は 10%。夕方にかけて少し雲が増えますが、雨の心配はなさそうです。',
    widget: 'weather',
  },
  rating: {
    tools: [
      { name: 'fetch_appstore', label: 'App Store から取得中', icon: 'star' },
      { name: 'fetch_playstore', label: 'Play Store から取得中', icon: 'star' },
    ],
    text: 'TrainLCD のストア評価は **★4.7**(1,284 レビュー)です。今週は +12 件の新規レビューがあり、評価は先月から 0.1 上昇しています。',
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
          for (const tool of canned.tools) {
            if (streamRef.current !== aiId) return;
            tools.push({ ...tool, status: 'running' });
            setMessages((prev) =>
              prev.map((m) => (m.id === aiId ? { ...m, tools: [...tools] } : m)),
            );
            await new Promise((r) => setTimeout(r, 700 + Math.random() * 600));
            tools[tools.length - 1].status = 'done';
          }
          reply = canned.text;
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
