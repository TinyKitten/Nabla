import { useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { PinnedStrip } from './PinnedStrip';
import { MessageRow } from './MessageRow';
import { ChatComposer } from './ChatComposer';
import { FEEDBACK_DETAIL_EVENT, WIDGET_DEFS } from './Widgets';
import type { FeedbackEntry, WidgetItem } from '../types';
import type { ShellContext } from './AppShell';

interface Shortcut {
  label: string;
  q: string;
  icon: IconName;
}

const SHORTCUTS: Shortcut[] = [
  { label: '今日の天気', q: '今日の天気は？', icon: 'cloud-sun' },
  { label: 'ストア評価', q: 'TrainLCDの評価', icon: 'star' },
  { label: '新着レビュー', q: '新しいレビューある？', icon: 'message-dots' },
  { label: 'パフォーマンス', q: 'パフォーマンス推移は？', icon: 'activity' },
];

export function ChatView() {
  const { pinned, setPinned, pinWidget, acceptInlineToPin, isMobile, chat } =
    useOutletContext<ShellContext>();
  const { messages, input, setInput, send, stop, streaming, sendFeedbackDetail } = chat;
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const onDetail = (e: Event) => {
      const ce = e as CustomEvent<FeedbackEntry>;
      if (ce.detail) sendFeedbackDetail(ce.detail);
    };
    window.addEventListener(FEEDBACK_DETAIL_EVENT, onDetail);
    return () => window.removeEventListener(FEEDBACK_DETAIL_EVENT, onDetail);
  }, [sendFeedbackDetail]);

  const openWidgetDetail = (w: WidgetItem) => {
    const def = WIDGET_DEFS[w.type];
    send(`${def.title}の詳しい状況を教えて`);
  };

  return (
    <>
      <PinnedStrip
        widgets={pinned}
        onReorder={setPinned}
        onOpen={openWidgetDetail}
        onRemove={(id) => setPinned((p) => p.filter((w) => w.id !== id))}
        onAcceptFromGrid={pinWidget}
        onAcceptInline={acceptInlineToPin}
        onAdd={() => send('新しいウィジェットを追加')}
      />

      <div
        ref={scrollRef}
        className="scroll-area"
        style={{ flex: 1, padding: isMobile ? '16px 14px 8px' : '24px 28px 8px' }}
      >
        <div style={{ maxWidth: 660, margin: '0 auto' }}>
          {messages.map((m) => (
            <MessageRow
              key={m.id}
              m={m}
              pinnedTypes={pinned.map((w) => w.type)}
              onPinInline={(type) => acceptInlineToPin(type)}
            />
          ))}
        </div>
      </div>

      <div style={{ padding: isMobile ? '8px 14px 0' : '8px 28px 0' }}>
        <div
          style={{
            maxWidth: 660,
            margin: '0 auto',
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          {SHORTCUTS.map((s) => (
            <button
              key={s.label}
              className="chip jp-text"
              onClick={() => send(s.q)}
              style={{
                fontSize: 12,
                padding: '5px 12px 5px 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Icon
                name={s.icon}
                size={12}
                stroke={1.7}
                style={{ color: 'var(--ink-3)', flexShrink: 0 }}
              />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: isMobile ? '10px 14px 16px' : '12px 28px 22px' }}>
        <div style={{ maxWidth: 660, margin: '0 auto' }}>
          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={() => send()}
            onStop={stop}
            streaming={streaming}
          />
        </div>
      </div>
    </>
  );
}
