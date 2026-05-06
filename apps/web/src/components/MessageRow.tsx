import { Icon } from './Icon';
import { renderText, ToolTrace, MessageActions } from './MessageRender';
import { Widget } from './Widgets';
import type { Message, WidgetType } from '../types';

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
        {m.text && (
          <div
            className="jp-text"
            style={{ color: 'var(--ink-2)', lineHeight: 1.7, fontSize: 14 }}
          >
            {renderText(m.text)}
            {m.streaming && <span className="caret-blink" />}
          </div>
        )}
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
