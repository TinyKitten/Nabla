import { useState } from 'react';
import { Icon } from './Icon';
import { renderText, ToolTrace, MessageActions } from './MessageRender';
import { Widget } from './Widgets';
import type { GitHubLabel, Message, WidgetType } from '../types';

function labelForeground(hex: string): string {
  const m = /^([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#1f2328';
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return lum > 0.5 ? '#1f2328' : '#fff';
}

function ImageItem({ src }: { src: string }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  if (status === 'error') return null;
  const isLoaded = status === 'loaded';
  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="添付画像を開く"
      style={{
        display: 'inline-block',
        maxWidth: 360,
        width: '100%',
        position: 'relative',
      }}
    >
      <img
        src={src}
        alt=""
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
        style={{
          display: 'block',
          width: '100%',
          maxHeight: 280,
          objectFit: 'cover',
          borderRadius: 8,
          border: '1px solid var(--line)',
          aspectRatio: isLoaded ? 'auto' : '16 / 10',
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.4s ease',
        }}
      />
      <div
        className="skeleton-box"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 8,
          border: '1px solid var(--line)',
          opacity: isLoaded ? 0 : 1,
          transition: 'opacity 0.4s ease',
          pointerEvents: 'none',
        }}
      />
    </a>
  );
}

function LabelPills({ labels }: { labels: GitHubLabel[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
      {labels.map((l) => (
        <span
          key={l.name}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            height: 20,
            padding: '0 8px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 500,
            lineHeight: 1,
            background: `#${l.color}`,
            color: labelForeground(l.color),
            border: '1px solid rgba(0, 0, 0, 0.08)',
            whiteSpace: 'nowrap',
          }}
        >
          {l.name}
        </span>
      ))}
    </div>
  );
}

interface MessageRowProps {
  m: Message;
  pinnedTypes?: WidgetType[];
  onPinInline?: (type: WidgetType) => void;
}

export function MessageRow({ m, pinnedTypes, onPinInline }: MessageRowProps) {
  if (m.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 0' }}>
        <div className="msg-user-bubble jp-text" style={{ fontSize: 14 }}>
          {renderText(m.text)}
        </div>
      </div>
    );
  }
  return (
    <div className="msg-row">
      <div className="avatar avatar-ai" style={{ width: 28, height: 28 }}>
        <Icon name="logo" size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
        <ToolTrace tools={m.tools} />
        {m.images && m.images.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
            {m.images.map((src, i) => (
              <ImageItem key={i} src={src} />
            ))}
          </div>
        )}
        {m.text && (
          <div
            className="jp-text"
            style={{ color: 'var(--ink-2)', lineHeight: 1.7, fontSize: 14 }}
          >
            {renderText(m.text)}
            {m.streaming && <span className="caret-blink" />}
          </div>
        )}
        {m.labels && m.labels.length > 0 && !m.streaming && <LabelPills labels={m.labels} />}
        {m.widget && !m.streaming && (() => {
          const widgetType = m.widget;
          const alreadyPinned = !!(pinnedTypes && pinnedTypes.includes(widgetType));
          return (
            <div
              style={{
                marginTop: 12,
                display: 'inline-block',
                cursor: alreadyPinned ? 'default' : 'grab',
                opacity: 1,
                userSelect: 'none',
                position: 'relative',
              }}
              title={alreadyPinned ? 'すでにピン留め済み' : 'ピン留めへドラッグ'}
            >
              <Widget
                widget={{
                  id: 'h-inline-' + m.id,
                  type: widgetType,
                  size: 'md',
                  refreshInterval: 0,
                }}
                accent="var(--accent)"
                onPin={alreadyPinned || !onPinInline ? undefined : () => onPinInline(widgetType)}
                isPinned={alreadyPinned}
                dragHandleProps={
                  alreadyPinned
                    ? undefined
                    : {
                        draggable: true,
                        onDragStart: (e) => {
                          e.dataTransfer.effectAllowed = 'copy';
                          e.dataTransfer.setData('application/x-inline-type', widgetType);
                          window.__draggingInlineWidgetType = widgetType;
                        },
                        onDragEnd: () => {
                          window.__draggingInlineWidgetType = null;
                        },
                      }
                }
              />
              {alreadyPinned && (
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 7px',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 600,
                    pointerEvents: 'none',
                  }}
                >
                  <Icon name="pin" size={9} />
                  <span>ピン済み</span>
                </div>
              )}
            </div>
          );
        })()}
        {m.actions && <MessageActions />}
      </div>
    </div>
  );
}
