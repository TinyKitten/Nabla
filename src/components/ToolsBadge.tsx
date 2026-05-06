import { useState } from 'react';
import { useToolConnections, type ToolName } from '../state/toolConnections';

interface ToolEntry {
  key: ToolName;
  name: string;
  desc: string;
}

const TOOLS: ToolEntry[] = [
  { key: 'openWeather', name: 'OpenWeather', desc: '天気予報' },
];

const COLOR_CONNECTED = '#22c55e';
const COLOR_DISCONNECTED = 'var(--ink-5)';

export function ToolsBadge() {
  const [open, setOpen] = useState(false);
  const conns = useToolConnections();
  const connectedCount = TOOLS.filter((t) => conns[t.key]).length;
  const anyConnected = connectedCount > 0;
  return (
    <div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{
        fontSize: 11,
        color: 'var(--ink-4)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        marginTop: 1,
        position: 'relative',
        cursor: 'default',
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: anyConnected ? COLOR_CONNECTED : COLOR_DISCONNECTED,
        }}
      />
      <span>{connectedCount} ツール接続中 · 自動更新</span>
      {open && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 50,
            background: 'var(--bg-elev)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            padding: '8px 4px',
            minWidth: 220,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: 'var(--ink-4)',
              letterSpacing: '0.04em',
              padding: '2px 12px 6px',
              textTransform: 'uppercase',
            }}
          >
            接続中の MCP ツール
          </div>
          {TOOLS.map((t) => {
            const connected = conns[t.key];
            return (
              <div
                key={t.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 12px',
                  opacity: connected ? 1 : 0.55,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: connected ? COLOR_CONNECTED : COLOR_DISCONNECTED,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 500 }}>
                  {t.name}
                </span>
                <span
                  className="jp-text"
                  style={{ fontSize: 10.5, color: 'var(--ink-4)', marginLeft: 'auto' }}
                >
                  {t.desc}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
