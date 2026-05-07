import { type DragEvent, Fragment } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Icon } from './Icon';
import { Widget } from './Widgets';
import { DropIndicator } from './DropIndicator';
import { usePinnedReorder } from '../hooks/usePinnedReorder';
import type { ShellContext } from './AppShell';

function computeIdxFromGrid(e: DragEvent, container: Element) {
  const items = Array.from(container.querySelectorAll('[data-dashboard-tile]'));
  for (let i = 0; i < items.length; i++) {
    const r = items[i].getBoundingClientRect();
    if (e.clientY < r.top) return i;
    if (e.clientY < r.bottom && e.clientX < r.left + r.width / 2) return i;
  }
  return items.length;
}

export function Dashboard() {
  const { pinned, setPinned, isMobile } = useOutletContext<ShellContext>();
  const { draggingId, dropIdx, dragHandleProps, containerProps } = usePinnedReorder({
    items: pinned,
    setItems: setPinned,
    computeIdx: computeIdxFromGrid,
  });

  if (pinned.length === 0) {
    return (
      <div
        className="jp-text"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: 'var(--ink-3)',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <Icon name="pin" size={22} style={{ color: 'var(--ink-4)' }} />
        <div style={{ fontSize: 13, fontWeight: 600 }}>ピン留めしたウィジェットがありません</div>
        <div style={{ fontSize: 12, color: 'var(--ink-4)', maxWidth: 320 }}>
          右パネルのウィジェットをピン留めすると、ここに表示されます。
        </div>
      </div>
    );
  }

  return (
    <div
      className="scroll-area"
      style={{ flex: 1, padding: isMobile ? '20px 14px 24px' : '24px 28px 28px' }}
    >
      <div
        {...containerProps}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'flex-start',
        }}
      >
        {pinned.map((w, i) => {
          const isDragging = draggingId === w.id;
          const showInsertBefore =
            dropIdx === i && draggingId !== null && draggingId !== w.id;
          return (
            <Fragment key={w.id}>
              {showInsertBefore && <DropIndicator />}
              <div
                data-dashboard-tile
                style={{
                  opacity: isDragging ? 0.4 : 1,
                  transition: 'opacity 0.12s',
                }}
              >
                <Widget
                  widget={{ ...w, size: 'md' }}
                  isPinned
                  dragHandleProps={dragHandleProps(w.id)}
                />
              </div>
            </Fragment>
          );
        })}
        {dropIdx === pinned.length && draggingId !== null && <DropIndicator />}
      </div>
    </div>
  );
}
