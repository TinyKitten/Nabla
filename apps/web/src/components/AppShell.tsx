import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useChat } from '../hooks/useChat';
import { Icon } from './Icon';
import { ToolsBadge } from './ToolsBadge';
import { WidgetGrid } from './WidgetGrid';
import { buildWidgetDetailPrompt } from './Widgets';
import type { Message, WidgetItem, WidgetSize, WidgetType } from '../types';

const PINNED_INITIAL: WidgetItem[] = [
  { id: 'h2', type: 'storeRating', size: 'sm', refreshInterval: 1800 },
  { id: 'h3', type: 'reviews', size: 'sm', refreshInterval: 600 },
  { id: 'h4', type: 'feedback', size: 'sm', refreshInterval: 600 },
  { id: 'h5', type: 'tasks', size: 'sm', refreshInterval: 0 },
];

const PINNED_STORAGE_KEY = 'nabla.pinned.v1';
const VALID_WIDGET_TYPES: ReadonlySet<WidgetType> = new Set([
  'weather',
  'storeRating',
  'reviews',
  'feedback',
  'performance',
  'tasks',
  'clock',
]);
const VALID_WIDGET_SIZES: ReadonlySet<WidgetSize> = new Set(['sm', 'md', 'lg']);

function isPersistedPinnedItem(x: unknown): x is WidgetItem {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.type === 'string' &&
    VALID_WIDGET_TYPES.has(o.type as WidgetType) &&
    typeof o.size === 'string' &&
    VALID_WIDGET_SIZES.has(o.size as WidgetSize) &&
    typeof o.refreshInterval === 'number' &&
    Number.isFinite(o.refreshInterval) &&
    Number.isInteger(o.refreshInterval) &&
    o.refreshInterval >= 0
  );
}

function readPersistedPinned(): WidgetItem[] | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PINNED_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const seen = new Set<WidgetType>();
    const items: WidgetItem[] = [];
    for (const x of parsed) {
      if (!isPersistedPinnedItem(x)) continue;
      if (seen.has(x.type)) continue;
      seen.add(x.type);
      items.push(x);
    }
    if (parsed.length > 0 && items.length === 0) return null;
    return items;
  } catch {
    return null;
  }
}

function writePersistedPinned(items: WidgetItem[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage unavailable / quota — fall through silently
  }
}

const WIDGETS_INITIAL: WidgetItem[] = [
  { id: 'd0', type: 'weather', size: 'md', refreshInterval: 600 },
  { id: 'd1', type: 'storeRating', size: 'lg', refreshInterval: 1800 },
  { id: 'd2', type: 'performance', size: 'md', refreshInterval: 1800 },
  { id: 'd3', type: 'reviews', size: 'lg', refreshInterval: 600 },
  { id: 'd4', type: 'feedback', size: 'lg', refreshInterval: 600 },
  { id: 'd5', type: 'tasks', size: 'md', refreshInterval: 0 },
  { id: 'd6', type: 'clock', size: 'sm', refreshInterval: 0 },
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'hinit',
    role: 'ai',
    text: 'おはようございます、きったんさん。上のピン留めはいつでも見えるウィジェット、右パネルは追加のウィジェット一覧です。気になることがあれば声をかけてください。',
    time: '09:02',
  },
];

export interface ShellContext {
  pinned: WidgetItem[];
  widgets: WidgetItem[];
  setPinned: Dispatch<SetStateAction<WidgetItem[]>>;
  setWidgets: Dispatch<SetStateAction<WidgetItem[]>>;
  pinWidget: (id: string, beforeIdx?: number) => void;
  unpinWidget: (id: string) => void;
  acceptInlineToPin: (type: WidgetType, beforeIdx?: number) => void;
  isMobile: boolean;
  panelOpen: boolean;
  setPanelOpen: Dispatch<SetStateAction<boolean>>;
  chat: ReturnType<typeof useChat>;
  goChatAndSend: (text: string) => void;
}

const tabBtnStyle = (active: boolean) => ({
  width: 36,
  height: 36,
  borderRadius: 9,
  background: active ? 'var(--accent-soft)' : 'transparent',
  color: active ? 'var(--accent)' : 'var(--ink-3)',
  border: 'none',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.15s, color 0.15s',
  textDecoration: 'none',
});

export function AppShell() {
  const chat = useChat(INITIAL_MESSAGES);
  const navigate = useNavigate();
  const [pinned, setPinned] = useState<WidgetItem[]>(() => readPersistedPinned() ?? PINNED_INITIAL);
  const [widgets, setWidgets] = useState<WidgetItem[]>(WIDGETS_INITIAL);
  useEffect(() => {
    writePersistedPinned(pinned);
  }, [pinned]);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 720,
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 720);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const [panelOpen, setPanelOpen] = useState(false);

  const unpinWidget = (id: string) => {
    const w = pinned.find((x) => x.id === id);
    if (!w) return;
    setPinned((p) => p.filter((x) => x.id !== id));
    if (widgets.some((d) => d.type === w.type)) return;
    setWidgets((d) => [...d, { ...w, size: 'md' }]);
  };

  const pinWidget = (id: string, beforeIdx?: number) => {
    const w = widgets.find((x) => x.id === id);
    if (!w) return;
    if (pinned.some((p) => p.type === w.type)) return;
    const compact: WidgetItem = {
      id: 'p-' + w.id,
      type: w.type,
      size: 'sm',
      refreshInterval: w.refreshInterval,
    };
    setPinned((p) => {
      const next = [...p];
      const idx = beforeIdx == null ? next.length : beforeIdx;
      next.splice(idx, 0, compact);
      return next;
    });
  };

  const acceptInlineToPin = (type: WidgetType, beforeIdx?: number) => {
    if (pinned.some((p) => p.type === type)) return;
    const id = 'p-inline-' + Date.now();
    setPinned((p) => {
      const next = [...p];
      const idx = beforeIdx == null ? next.length : beforeIdx;
      next.splice(Math.min(idx, next.length), 0, {
        id,
        type,
        size: 'sm',
        refreshInterval: 1800,
      });
      return next;
    });
  };

  const goChatAndSend = (text: string) => {
    navigate('/chat');
    chat.send(text);
  };

  const context: ShellContext = {
    pinned,
    widgets,
    setPinned,
    setWidgets,
    pinWidget,
    unpinWidget,
    acceptInlineToPin,
    isMobile,
    panelOpen,
    setPanelOpen,
    chat,
    goChatAndSend,
  };

  return (
    <div className="chat-root" style={{ display: 'flex', height: '100%', background: 'var(--bg)' }}>
      <aside
        style={{
          width: isMobile ? 0 : 60,
          flexShrink: 0,
          borderRight: isMobile ? 'none' : '1px solid var(--line)',
          background: 'var(--bg-elev)',
          display: isMobile ? 'none' : 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '14px 0',
          gap: 4,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            background: 'var(--accent)',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
          }}
        >
          <Icon name="logo" size={17} />
        </div>
        <NavLink
          to="/"
          end
          title="ダッシュボード"
          style={({ isActive }) => tabBtnStyle(isActive)}
        >
          <Icon name="dashboard" size={16} />
        </NavLink>
        <NavLink
          to="/chat"
          title="チャット"
          style={({ isActive }) => tabBtnStyle(isActive)}
        >
          <Icon name="chat-bubble" size={16} />
        </NavLink>
        <div style={{ flex: 1 }} />
        <button className="btn-icon" title="設定">
          <Icon name="settings" size={16} />
        </button>
        <div className="avatar" style={{ marginTop: 4 }}>
          KT
        </div>
      </aside>

      <main
        style={{
          flex: '1 1 0%',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRight: panelOpen ? '1px solid var(--line)' : 'none',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: isMobile ? '10px 14px' : '12px 24px',
            borderBottom: '1px solid var(--line)',
            background: 'var(--bg)',
          }}
        >
          <div className="jp-text" style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>Nabla</div>
            <ToolsBadge />
          </div>
          <button
            className="btn-icon"
            onClick={() => setPanelOpen(!panelOpen)}
            title={panelOpen ? 'パネルを閉じる' : 'パネルを開く'}
            style={{
              background: panelOpen ? 'var(--accent-soft)' : 'transparent',
              color: panelOpen ? 'var(--accent)' : 'var(--ink-3)',
            }}
          >
            <Icon name="panel" size={16} />
          </button>
          <button className="btn-icon">
            <Icon name="more" size={16} />
          </button>
        </header>

        <Outlet context={context} />
      </main>

      {isMobile && panelOpen && (
        <div
          onClick={() => setPanelOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            background: 'rgba(0,0,0,0.32)',
            transition: 'opacity 0.2s',
          }}
        />
      )}
      <aside
        style={{
          flex: isMobile ? 'none' : panelOpen ? '0 0 332px' : '0 0 0px',
          width: isMobile ? (panelOpen ? 'min(332px, 88vw)' : 0) : panelOpen ? 332 : 0,
          background: 'var(--bg-sunken)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          opacity: panelOpen ? 1 : 0,
          transition:
            'flex-basis 0.28s cubic-bezier(0.4, 0, 0.2, 1), width 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease, transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: panelOpen ? 'auto' : 'none',
          ...(isMobile
            ? {
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                zIndex: 100,
                borderLeft: '1px solid var(--line)',
                boxShadow: panelOpen ? '0 0 40px rgba(0,0,0,0.18)' : 'none',
                transform: panelOpen ? 'translateX(0)' : 'translateX(100%)',
              }
            : {}),
        }}
      >
        <div
          style={{
            width: 332,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            transform: panelOpen ? 'translateX(0)' : 'translateX(20px)',
            transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <header
            style={{
              padding: '14px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              borderBottom: '1px solid var(--line)',
            }}
          >
            <Icon name="panel" size={14} style={{ color: 'var(--accent)' }} />
            <div
              className="jp-text"
              style={{ flex: 1, fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}
            >
              ウィジェット
            </div>
            <button
              className="btn-icon"
              title="ウィジェット追加"
              onClick={() => goChatAndSend('新しいウィジェットを追加')}
            >
              <Icon name="plus" size={15} />
            </button>
            {isMobile && (
              <button className="btn-icon" title="閉じる" onClick={() => setPanelOpen(false)}>
                <Icon name="x" size={15} />
              </button>
            )}
          </header>

          <div
            className="scroll-area"
            style={{ flex: 1, padding: '20px 24px 24px' }}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes('application/x-pinned-id')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }
            }}
            onDrop={(e) => {
              const id = e.dataTransfer.getData('application/x-pinned-id');
              if (id) {
                e.preventDefault();
                unpinWidget(id);
              }
            }}
          >
            <WidgetGrid
              widgets={widgets}
              onReorder={setWidgets}
              onOpen={(w) => goChatAndSend(buildWidgetDetailPrompt(w.type))}
              onRemove={(id) => setWidgets((d) => d.filter((w) => w.id !== id))}
              onPin={(id) => pinWidget(id, pinned.length)}
              onUnpin={(type) => setPinned((p) => p.filter((x) => x.type !== type))}
              pinnedTypes={pinned.map((w) => w.type)}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}
