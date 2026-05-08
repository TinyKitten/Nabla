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
  const { pinned, setPinned, pinWidget, isMobile } = useOutletContext<ShellContext>();
  const { draggingId, dropIdx, acceptingExternal, dragHandleProps, containerProps } =
    usePinnedReorder({
      items: pinned,
      setItems: setPinned,
      computeIdx: computeIdxFromGrid,
      onAcceptFromGrid: pinWidget,
    });

  const tintBg =
    acceptingExternal === 'blocked'
      ? 'color-mix(in oklab, #e63946 5%, transparent)'
      : acceptingExternal
      ? 'color-mix(in oklab, var(--accent) 6%, transparent)'
      : 'transparent';

  if (pinned.length === 0) {
    const blocked = acceptingExternal === 'blocked';
    const accenting = acceptingExternal === true;
    return (
      <div
        {...containerProps}
        className="jp-text"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: blocked ? '#e63946' : accenting ? 'var(--accent)' : 'var(--ink-3)',
          padding: 24,
          textAlign: 'center',
          background: tintBg,
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        <Icon
          name="pin"
          size={22}
          style={{ color: blocked ? '#e63946' : accenting ? 'var(--accent)' : 'var(--ink-4)' }}
        />
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          {blocked
            ? 'すでにピン留め済み'
            : accenting
            ? 'ここにドロップしてピン留め'
            : 'ピン留めしたウィジェットがありません'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-4)', maxWidth: 320 }}>
          右パネルのウィジェットをここにドラッグするか、ピン留めすると表示されます。
        </div>
      </div>
    );
  }

  return (
    <div
      {...containerProps}
      className="scroll-area"
      style={{
        flex: 1,
        padding: isMobile ? '20px 14px 24px' : '24px 28px 28px',
        background: tintBg,
        transition: 'background 0.15s',
      }}
    >
      <div
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
            dropIdx === i &&
            (acceptingExternal === true || (draggingId !== null && draggingId !== w.id));
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
                  onRemove={() => setPinned((p) => p.filter((x) => x.id !== w.id))}
                  onUnpin={() => setPinned((p) => p.filter((x) => x.id !== w.id))}
                  dragHandleProps={dragHandleProps(w.id)}
                />
              </div>
            </Fragment>
          );
        })}
        {dropIdx === pinned.length && (acceptingExternal === true || draggingId !== null) && (
          <DropIndicator />
        )}
      </div>
    </div>
  );
}
