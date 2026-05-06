import { Fragment, useState } from 'react';
import { Icon } from './Icon.jsx';

export function renderText(text) {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, li) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((p, pi) => {
      if (p.startsWith('**') && p.endsWith('**')) {
        return (
          <strong key={pi} style={{ fontWeight: 600, color: 'var(--ink)' }}>
            {p.slice(2, -2)}
          </strong>
        );
      }
      return <Fragment key={pi}>{p}</Fragment>;
    });
    return (
      <Fragment key={li}>
        {rendered}
        {li < lines.length - 1 && <br />}
      </Fragment>
    );
  });
}

export function ToolTrace({ tools }) {
  if (!tools || tools.length === 0) return null;
  return (
    <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {tools.map((t, i) => (
        <div
          key={i}
          className="jp-text"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 10px',
            background: 'var(--bg-sunken)',
            border: '1px solid var(--line)',
            borderRadius: 999,
            fontSize: 11,
            color: 'var(--ink-3)',
            width: 'fit-content',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {t.status === 'running' ? (
            <span style={{ width: 10, height: 10, position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: '1.5px solid var(--accent-mid)',
                  borderTopColor: 'var(--accent)',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
            </span>
          ) : (
            <Icon name="check" size={11} style={{ color: 'var(--accent)' }} />
          )}
          <span style={{ fontWeight: 500 }}>{t.label}</span>
        </div>
      ))}
    </div>
  );
}

export function MessageActions() {
  const [copied, setCopied] = useState(false);
  const items = [
    {
      name: 'copy',
      label: 'コピー',
      onClick: () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      },
    },
    { name: 'refresh', label: '再生成' },
    { name: 'thumb-up', label: 'いいね' },
    { name: 'thumb-down', label: 'よくない' },
  ];
  return (
    <div style={{ display: 'flex', gap: 2, marginTop: 8, opacity: 0.65 }}>
      {items.map((it) => (
        <button
          key={it.label}
          className="btn-icon"
          title={it.label}
          onClick={it.onClick}
          style={{ width: 26, height: 26 }}
        >
          {copied && it.name === 'copy' ? (
            <Icon name="check" size={13} />
          ) : (
            <Icon name={it.name} size={13} />
          )}
        </button>
      ))}
    </div>
  );
}
