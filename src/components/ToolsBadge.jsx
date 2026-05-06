import { useState } from 'react';

const TOOLS = [
  { name: 'GitHub', desc: 'リポジトリ・PR・Issue' },
  { name: 'App Store Connect', desc: 'レビュー・売上データ' },
  { name: 'Google Calendar', desc: '予定の閲覧' },
  { name: 'OpenWeather', desc: '天気予報' },
  { name: 'Linear', desc: 'タスク・スプリント管理' },
];

export function ToolsBadge() {
  const [open, setOpen] = useState(false);
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
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e' }} />
      <span>5 ツール接続中 · 自動更新</span>
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
          {TOOLS.map((t) => (
            <div
              key={t.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 12px',
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: '#22c55e',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 500 }}>{t.name}</span>
              <span
                className="jp-text"
                style={{ fontSize: 10.5, color: 'var(--ink-4)', marginLeft: 'auto' }}
              >
                {t.desc}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
